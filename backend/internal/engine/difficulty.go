package engine

import (
	"context"
	"fmt"
	"math/rand/v2"
	"strings"
)

// 难度实现：Pikafish（2026-01 版）已移除 Skill Level/UCI_Elo，
// 故采用 Stockfish Skill 的内部原理自行实现：
// 限深/限时 + MultiPV 候选 + 距最佳分数 margin 窗口内随机选着。
var levels = [11]struct {
	goCmd   string
	multiPV int
	margin  int // centipawn
}{
	{},                                   // 0 不使用
	{"go depth 1", 12, 700},              // 1
	{"go depth 2", 8, 500},               // 2
	{"go depth 3", 6, 350},               // 3
	{"go depth 4", 5, 250},               // 4
	{"go depth 6", 4, 180},               // 5
	{"go depth 8", 3, 120},               // 6
	{"go depth 10 movetime 800", 3, 80},  // 7
	{"go depth 14 movetime 1500", 2, 40}, // 8
	{"go movetime 2500", 1, 0},           // 9
	{"go movetime 4000", 1, 0},           // 10
}

const MaxLevel = 10

// MoveResult 的分数已归一为红方视角
type MoveResult struct {
	BestMove string       `json:"bestMove"`
	ScoreCP  *int         `json:"scoreCp,omitempty"`
	Mate     *int         `json:"scoreMate,omitempty"`
	PV       []string     `json:"pv,omitempty"`
	Engine   PublicConfig `json:"engine"`
}

type Evaluation struct {
	ScoreCP  int
	Mate     int
	BestMove string
}

// Evaluate runs one deterministic single-PV search and normalizes the score to red's perspective.
func (e *Engine) Evaluate(ctx context.Context, fen string, depth int) (Evaluation, error) {
	if depth < 1 {
		return Evaluation{}, fmt.Errorf("depth must be positive")
	}
	best, infos, err := e.search(ctx, fen, fmt.Sprintf("go depth %d", depth), 1, nil)
	if err != nil {
		return Evaluation{}, err
	}
	in := infos[1]
	sign := 1
	if strings.Contains(fen, " b ") {
		sign = -1
	}
	return Evaluation{ScoreCP: in.ScoreCP * sign, Mate: in.Mate * sign, BestMove: best}, nil
}

// mate n 折算成一个大分值参与排序/窗口比较
func effectiveScore(in Info) int {
	if in.Mate != 0 {
		if in.Mate > 0 {
			return 100000 - in.Mate
		}
		return -100000 - in.Mate
	}
	return in.ScoreCP
}

// Analyze 全力分析局面（深度 30 或 60 秒封顶），info 分数为走子方视角。
// ctx 取消（如 SSE 客户端断开）时向引擎发 stop。
func (e *Engine) Analyze(ctx context.Context, fen string, onInfo func(Info)) error {
	_, _, err := e.search(ctx, fen, "go depth 30 movetime 60000", 1, onInfo)
	if err != nil && ctx.Err() != nil {
		return nil // 客户端主动断开不算错误
	}
	return err
}

// BestMove 按难度等级出着。fen 的走子方即引擎执子方。
func (e *Engine) BestMove(ctx context.Context, fen string, level int) (*MoveResult, error) {
	if level < 1 || level > MaxLevel {
		return nil, fmt.Errorf("level must be 1..%d", MaxLevel)
	}
	cfg := levels[level]
	best, infos, err := e.search(ctx, fen, cfg.goCmd, cfg.multiPV, nil)
	if err != nil {
		return nil, err
	}

	chosen := Info{PV: []string{best}}
	if in, ok := infos[1]; ok {
		chosen = in
	}
	if cfg.multiPV > 1 && len(infos) > 1 {
		bestScore := effectiveScore(infos[1])
		var candidates []Info
		for i := 1; i <= cfg.multiPV; i++ {
			in, ok := infos[i]
			if !ok || len(in.PV) == 0 {
				continue
			}
			if effectiveScore(in) >= bestScore-cfg.margin {
				candidates = append(candidates, in)
			}
		}
		if len(candidates) > 0 {
			chosen = candidates[rand.IntN(len(candidates))]
		}
	}

	res := &MoveResult{BestMove: chosen.PV[0], PV: chosen.PV, Engine: e.Config()}
	// 分数归一为红方视角（引擎报的是走子方视角）
	sign := 1
	if strings.Contains(fen, " b ") {
		sign = -1
	}
	if chosen.Mate != 0 {
		m := chosen.Mate * sign
		res.Mate = &m
	} else {
		cp := chosen.ScoreCP * sign
		res.ScoreCP = &cp
	}
	return res, nil
}
