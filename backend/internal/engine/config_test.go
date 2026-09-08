package engine

import "testing"

func TestConfigFromEnvDefaultsToStockfish(t *testing.T) {
	cfg := ConfigFromEnv()
	if cfg.Name != "Stockfish" {
		t.Fatalf("Name = %q, want Stockfish", cfg.Name)
	}
	if cfg.Protocol != ProtocolUCI {
		t.Fatalf("Protocol = %q, want %q", cfg.Protocol, ProtocolUCI)
	}
	if cfg.BinPath != "engines/stockfish" {
		t.Fatalf("BinPath = %q, want engines/stockfish", cfg.BinPath)
	}
}

func TestConfigFromEnvStockfishPath(t *testing.T) {
	t.Setenv("CHESS_ENGINE", "stockfish")
	t.Setenv("STOCKFISH_PATH", "/usr/games/stockfish")

	cfg := ConfigFromEnv()
	if cfg.Name != "Stockfish" {
		t.Fatalf("Name = %q, want Stockfish", cfg.Name)
	}
	if cfg.Protocol != ProtocolUCI {
		t.Fatalf("Protocol = %q, want %q", cfg.Protocol, ProtocolUCI)
	}
	if cfg.BinPath != "/usr/games/stockfish" {
		t.Fatalf("BinPath = %q, want /usr/games/stockfish", cfg.BinPath)
	}
}

func TestParseInfoUCCIScore(t *testing.T) {
	info, ok := parseInfo("info depth 8 score 42 pv h2e2 h9g7")
	if !ok {
		t.Fatal("parseInfo returned !ok")
	}
	if info.Depth != 8 || info.ScoreCP != 42 {
		t.Fatalf("info = %+v, want depth 8 score 42", info)
	}
	if got := info.PV[0]; got != "h2e2" {
		t.Fatalf("PV[0] = %q, want h2e2", got)
	}
}
