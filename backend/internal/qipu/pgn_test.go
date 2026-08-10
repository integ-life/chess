package qipu

import (
	"strings"
	"testing"
)

func TestParsePGN(t *testing.T) {
	input := `[Game "Chinese Chess"]
[Event "坏棋谱"]
[Format "ICCS"]
1. H2-E2 E3-E4
*

[Game "Chinese Chess"]
[Event "测试赛"]
[Site "上海"]
[Date "2026-07-10"]
[Round "1"]
[RedTeam "红队"]
[Red "红棋手"]
[BlackTeam "黑队"]
[Black "黑棋手"]
[Result "1-0"]
[Opening "中炮"]
[FEN "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1"]
[Format "ICCS"]
1. H2-E2 H9-G7
2. H0-G2 B9-C7
1-0
`
	var records []Record
	var rejected []error
	if err := ParsePGN(strings.NewReader(input), "test-source", "https://example.com", "test.pgns", func(r Record) error {
		records = append(records, r)
		return nil
	}, func(err error) { rejected = append(rejected, err) }); err != nil {
		t.Fatal(err)
	}
	if len(rejected) != 1 || !strings.Contains(rejected[0].Error(), "game 1 illegal move e3e4") {
		t.Fatalf("rejected = %v", rejected)
	}
	if len(records) != 1 {
		t.Fatalf("got %d records", len(records))
	}
	r := records[0]
	if r.SourceKey != "test.pgns#2" || r.Event != "测试赛" || r.Site != "上海" || r.RedTeam != "红队" || r.Opening != "中炮" {
		t.Fatalf("missing metadata: %+v", r)
	}
	if got := strings.Join(r.Moves, ","); got != "h2e2,h9g7,h0g2,b9c7" {
		t.Fatalf("moves = %s", got)
	}
}
