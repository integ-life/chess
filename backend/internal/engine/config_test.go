package engine

import "testing"

func TestConfigFromEnvDefaultsToElephantEye(t *testing.T) {
	cfg := ConfigFromEnv()
	if cfg.Name != "ElephantEye" {
		t.Fatalf("Name = %q, want ElephantEye", cfg.Name)
	}
	if cfg.Protocol != ProtocolUCCI {
		t.Fatalf("Protocol = %q, want %q", cfg.Protocol, ProtocolUCCI)
	}
	if cfg.BinPath != "engines/eleeye" {
		t.Fatalf("BinPath = %q, want engines/eleeye", cfg.BinPath)
	}
}

func TestConfigFromEnvElephantEye(t *testing.T) {
	t.Setenv("XIANGQI_ENGINE", "elephanteye")
	t.Setenv("ELEPHANTEYE_PATH", "/opt/eleeye")

	cfg := ConfigFromEnv()
	if cfg.Name != "ElephantEye" {
		t.Fatalf("Name = %q, want ElephantEye", cfg.Name)
	}
	if cfg.Protocol != ProtocolUCCI {
		t.Fatalf("Protocol = %q, want %q", cfg.Protocol, ProtocolUCCI)
	}
	if cfg.BinPath != "/opt/eleeye" {
		t.Fatalf("BinPath = %q, want /opt/eleeye", cfg.BinPath)
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
