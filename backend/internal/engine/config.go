package engine

import (
	"cmp"
	"os"
	"strings"
)

type Protocol string

const (
	ProtocolUCI  Protocol = "uci"
	ProtocolUCCI Protocol = "ucci"
)

type Config struct {
	Name     string
	Protocol Protocol
	BinPath  string
	EvalFile string
	Threads  int
	HashMB   int
}

type PublicConfig struct {
	Name     string `json:"name"`
	Protocol string `json:"protocol"`
}

func ConfigFromEnv() Config {
	name := strings.ToLower(strings.TrimSpace(os.Getenv("CHESS_ENGINE")))
	if name == "" {
		name = "stockfish"
	}

	cfg := Config{Threads: 2, HashMB: 128}
	switch name {
	case "stockfish":
		cfg.Name = "Stockfish"
		cfg.Protocol = ProtocolUCI
		cfg.BinPath = cmp.Or(os.Getenv("CHESS_ENGINE_PATH"), os.Getenv("STOCKFISH_PATH"), "engines/stockfish")
		cfg.EvalFile = os.Getenv("STOCKFISH_NNUE")
	default:
		cfg.Name = name
		cfg.Protocol = ProtocolUCI
		cfg.BinPath = cmp.Or(os.Getenv("CHESS_ENGINE_PATH"), name)
		cfg.EvalFile = os.Getenv("CHESS_ENGINE_EVAL_FILE")
	}

	if protocol := normalizeProtocol(os.Getenv("CHESS_ENGINE_PROTOCOL")); protocol != "" {
		cfg.Protocol = protocol
	}
	return cfg
}

func normalizeProtocol(v string) Protocol {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "uci":
		return ProtocolUCI
	case "ucci":
		return ProtocolUCCI
	default:
		return ""
	}
}

func (c Config) Public() PublicConfig {
	return PublicConfig{Name: c.Name, Protocol: string(c.Protocol)}
}
