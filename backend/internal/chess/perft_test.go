package chess

import (
	"encoding/json"
	"os"
	"testing"
)

type fixtureFile struct {
	Fixtures []struct {
		Name  string            `json:"name"`
		FEN   string            `json:"fen"`
		Perft map[string]uint64 `json:"perft"`
	} `json:"fixtures"`
}

// depth 5（1.3 亿节点）用 -short 跳过
func TestPerft(t *testing.T) {
	data, err := os.ReadFile("../../../shared/perft-fixtures.json")
	if err != nil {
		t.Fatal(err)
	}
	var ff fixtureFile
	if err := json.Unmarshal(data, &ff); err != nil {
		t.Fatal(err)
	}
	maxDepth := "5"
	if testing.Short() {
		maxDepth = "4"
	}
	for _, fx := range ff.Fixtures {
		for depth, want := range fx.Perft {
			if depth > maxDepth {
				continue
			}
			t.Run(fx.Name+"_d"+depth, func(t *testing.T) {
				pos, err := ParseFEN(fx.FEN)
				if err != nil {
					t.Fatal(err)
				}
				d := int(depth[0] - '0')
				if got := Perft(pos, d); got != want {
					t.Errorf("perft(%d) = %d, want %d", d, got, want)
				}
			})
		}
	}
}

func TestFENRoundTrip(t *testing.T) {
	pos, err := ParseFEN(StartFEN)
	if err != nil {
		t.Fatal(err)
	}
	if got := pos.FEN(); got != StartFEN {
		t.Errorf("FEN() = %q, want %q", got, StartFEN)
	}
}

func TestStatus(t *testing.T) {
	cases := []struct {
		name string
		fen  string
		want GameStatus
	}{
		{"start", StartFEN, Ongoing},
		{"queen mate", "7k/6Q1/5K2/8/8/8/8/8 b - - 0 1", Checkmate},
		{"stalemate", "7k/5Q2/5K2/8/8/8/8/8 b - - 0 1", Stalemate},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			pos, err := ParseFEN(c.fen)
			if err != nil {
				t.Fatal(err)
			}
			if got := Status(pos); got != c.want {
				t.Errorf("Status = %v, want %v", got, c.want)
			}
		})
	}
}
