// Package engine 管理 Pikafish UCI 子进程：生命周期、请求串行化、崩溃重启。
package engine

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Info 是引擎 info 行的解析结果，分数为走子方视角
type Info struct {
	Depth   int
	MultiPV int
	ScoreCP int
	// Mate != 0 时表示 n 步杀（正=走子方胜）；此时 ScoreCP 无效
	Mate int
	PV   []string
}

type proc struct {
	cmd   *exec.Cmd
	stdin *bufio.Writer
	lines chan string
	dead  chan struct{}
}

type Engine struct {
	mu     sync.Mutex // 串行化所有引擎请求
	config Config
	p      *proc
}

func New(config Config) *Engine {
	return &Engine{config: config}
}

func (e *Engine) Config() PublicConfig {
	return e.config.Public()
}

func (e *Engine) start() error {
	cmd := exec.Command(e.config.BinPath)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start engine: %w", err)
	}
	p := &proc{
		cmd:   cmd,
		stdin: bufio.NewWriter(stdin),
		lines: make(chan string, 256),
		dead:  make(chan struct{}),
	}
	go func() {
		sc := bufio.NewScanner(stdout)
		sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for sc.Scan() {
			select {
			case p.lines <- sc.Text():
			case <-p.dead:
				return
			}
		}
		close(p.dead)
		_ = cmd.Wait()
		if err := sc.Err(); err != nil {
			log.Printf("engine: stdout scanner error: %v", err)
		}
		log.Printf("engine: process exited")
	}()
	e.p = p

	if err := e.send(string(e.config.Protocol)); err != nil {
		return err
	}
	if _, err := e.waitFor(string(e.config.Protocol)+"ok", 10*time.Second); err != nil {
		return err
	}
	for _, opt := range e.options() {
		if err := e.send(opt); err != nil {
			return err
		}
	}
	if err := e.send("isready"); err != nil {
		return err
	}
	if _, err := e.waitFor("readyok", 30*time.Second); err != nil {
		return err
	}
	log.Printf("engine: %s ready (%s, %s)", e.config.Name, e.config.Protocol, e.config.BinPath)
	return nil
}

func (e *Engine) options() []string {
	if e.config.Protocol == ProtocolUCCI {
		return []string{
			"setoption usehash true",
			fmt.Sprintf("setoption hashsize %d", e.config.HashMB),
			fmt.Sprintf("setoption threads %d", e.config.Threads),
		}
	}
	options := []string{
		fmt.Sprintf("setoption name Threads value %d", e.config.Threads),
		fmt.Sprintf("setoption name Hash value %d", e.config.HashMB),
	}
	if e.config.EvalFile != "" {
		options = append([]string{"setoption name EvalFile value " + e.config.EvalFile}, options...)
	}
	return options
}

func (e *Engine) alive() bool {
	if e.p == nil {
		return false
	}
	select {
	case <-e.p.dead:
		return false
	default:
		return true
	}
}

func (e *Engine) ensure() error {
	if e.alive() {
		return nil
	}
	e.kill()
	return e.start()
}

func (e *Engine) kill() {
	if e.p == nil {
		return
	}
	_ = e.p.cmd.Process.Kill()
	e.p = nil
}

func (e *Engine) send(line string) error {
	if _, err := e.p.stdin.WriteString(line + "\n"); err != nil {
		return err
	}
	return e.p.stdin.Flush()
}

func (e *Engine) waitFor(prefix string, timeout time.Duration) (string, error) {
	deadline := time.After(timeout)
	for {
		select {
		case line := <-e.p.lines:
			if strings.HasPrefix(line, prefix) {
				return line, nil
			}
		case <-e.p.dead:
			return "", fmt.Errorf("engine process died waiting for %q", prefix)
		case <-deadline:
			return "", fmt.Errorf("timeout waiting for %q", prefix)
		}
	}
}

// search 执行一次搜索。onInfo 对每条解析出的 info 行回调（可为 nil）。
// 返回 bestmove 与各 multipv 的最终 info。
// 关键不变量：拿到 bestmove 前绝不发起下一次 go；取消时发 stop 并等 bestmove。
func (e *Engine) search(ctx context.Context, fen, goCmd string, multiPV int, onInfo func(Info)) (string, map[int]Info, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if err := e.ensure(); err != nil {
		return "", nil, err
	}
	commands := []string{"position fen " + fen, e.goCommand(goCmd)}
	if e.config.Protocol == ProtocolUCI {
		commands = append([]string{fmt.Sprintf("setoption name MultiPV value %d", multiPV)}, commands...)
	}
	for _, cmd := range commands {
		if err := e.send(cmd); err != nil {
			e.kill()
			return "", nil, err
		}
	}

	infos := make(map[int]Info)
	stopped := false
	ctxC := ctx.Done()
	var graceC <-chan time.Time // stop 后等 bestmove 的宽限期
	for {
		select {
		case line := <-e.p.lines:
			if strings.HasPrefix(line, "info ") {
				if info, ok := parseInfo(line); ok {
					infos[info.MultiPV] = info
					if onInfo != nil && !stopped {
						onInfo(info)
					}
				}
			} else if strings.HasPrefix(line, "bestmove ") {
				fields := strings.Fields(line)
				if len(fields) < 2 || fields[1] == "(none)" {
					return "", infos, fmt.Errorf("engine returned no move")
				}
				return fields[1], infos, nil
			} else if strings.HasPrefix(line, "nobestmove") {
				return "", infos, fmt.Errorf("engine returned no move")
			}
		case <-e.p.dead:
			e.p = nil
			return "", nil, fmt.Errorf("engine process died during search")
		case <-ctxC:
			ctxC = nil // 只处理一次取消
			stopped = true
			if err := e.send("stop"); err != nil {
				e.kill()
				return "", nil, err
			}
			graceC = time.After(3 * time.Second)
		case <-graceC:
			e.kill()
			return "", nil, ctx.Err()
		}
	}
}

func (e *Engine) goCommand(goCmd string) string {
	if e.config.Protocol == ProtocolUCCI {
		return strings.ReplaceAll(goCmd, "movetime", "time")
	}
	return goCmd
}

func parseInfo(line string) (Info, bool) {
	fields := strings.Fields(line)
	info := Info{MultiPV: 1}
	seenScore := false
	for i := 0; i < len(fields); i++ {
		switch fields[i] {
		case "depth":
			if i+1 < len(fields) {
				info.Depth, _ = strconv.Atoi(fields[i+1])
			}
		case "multipv":
			if i+1 < len(fields) {
				info.MultiPV, _ = strconv.Atoi(fields[i+1])
			}
		case "score":
			if i+2 < len(fields) && (fields[i+1] == "cp" || fields[i+1] == "mate") {
				n, _ := strconv.Atoi(fields[i+2])
				if fields[i+1] == "mate" {
					info.Mate = n
				} else {
					info.ScoreCP = n
				}
				seenScore = true
			} else if i+1 < len(fields) {
				info.ScoreCP, _ = strconv.Atoi(fields[i+1])
				seenScore = true
			}
		case "pv":
			info.PV = fields[i+1:]
			i = len(fields)
		}
	}
	return info, seenScore && len(info.PV) > 0
}

// Close 退出引擎进程
func (e *Engine) Close() {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.alive() {
		_ = e.send("quit")
		select {
		case <-e.p.dead:
		case <-time.After(2 * time.Second):
			e.kill()
		}
	}
	e.p = nil
}
