package qipu

import "testing"

func TestParseDhtmlXQ(t *testing.T) {
	data := []byte(`[DhtmlXQ]
[DhtmlXQ_title]测试对局[/DhtmlXQ_title]
[DhtmlXQ_red]红方[/DhtmlXQ_red]
[DhtmlXQ_black]黑方[/DhtmlXQ_black]
[DhtmlXQ_result]和局[/DhtmlXQ_result]
[DhtmlXQ_open]中炮[/DhtmlXQ_open]
[DhtmlXQ_binit]0919293949596979891777062646668600102030405060708012720323436383[/DhtmlXQ_binit]
[DhtmlXQ_movelist]7747[/DhtmlXQ_movelist]
[/DhtmlXQ]`)
	g, err := ParseDhtmlXQ("tournaments/测试赛事/测试对局", data)
	if err != nil {
		t.Fatal(err)
	}
	if g.Category != "赛事实战" || g.Collection != "测试赛事" || g.Result != "1/2-1/2" {
		t.Fatalf("unexpected metadata: %+v", g)
	}
	if g.InitialFEN != "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1" {
		t.Fatalf("initial FEN = %s", g.InitialFEN)
	}
	if len(g.Moves) != 1 || g.Moves[0] != "h2e2" {
		t.Fatalf("unexpected moves: %v", g.Moves)
	}
}
