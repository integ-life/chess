package api

import (
	"testing"
	"time"

	"chess/backend/internal/chess"
)

func TestStalemateIsDrawnOnlineMatch(t *testing.T) {
	s, _ := testServerAndToken(t)
	pos, err := chess.ParseFEN("7k/Q7/5K2/8/8/8/8/8 w - - 0 1")
	if err != nil {
		t.Fatal(err)
	}
	move, err := chess.MoveFromICCS("a7f7")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	m := &onlineMatch{
		ID: "stalemate-1", Status: "active", OpponentType: "human", InitialFEN: "7k/Q7/5K2/8/8/8/8/8 w - - 0 1",
		Position: pos, Moves: []string{},
		Red:      onlinePlayer{UserID: 1, Username: "white", Color: chess.Red},
		Black:    onlinePlayer{UserID: 2, Username: "black", Color: chess.Black},
		LastTick: now, CreatedAt: now, UpdatedAt: now,
	}
	hub := newOnlineHub()
	hub.applyMoveLocked(m, move, s)
	if chess.Status(m.Position) != chess.Stalemate {
		t.Fatalf("expected stalemate position, got %v", chess.Status(m.Position))
	}
	if m.Status != "finished" || m.Result != "1/2-1/2" || m.ResultReason != "stalemate" {
		t.Fatalf("stalemate must be a finished draw: %+v", m)
	}
}
