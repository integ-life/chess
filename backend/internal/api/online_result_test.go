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

func TestPruneFinishedMatches(t *testing.T) {
	now := time.Now()
	hub := newOnlineHub()
	hub.matches["old"] = &onlineMatch{ID: "old", Status: "finished", RoomCode: "AAAA", UpdatedAt: now.Add(-11 * time.Minute)}
	hub.rooms["AAAA"] = hub.matches["old"]
	hub.matches["recent"] = &onlineMatch{ID: "recent", Status: "finished", UpdatedAt: now.Add(-time.Minute)}
	hub.matches["active"] = &onlineMatch{ID: "active", Status: "active", UpdatedAt: now.Add(-time.Hour)}

	hub.pruneFinishedLocked(now)
	if _, ok := hub.matches["old"]; ok {
		t.Fatal("old finished match should be pruned")
	}
	if hub.rooms["AAAA"] != nil {
		t.Fatal("room entry for pruned match should be removed")
	}
	if _, ok := hub.matches["recent"]; !ok {
		t.Fatal("recently finished match must be kept")
	}
	if _, ok := hub.matches["active"]; !ok {
		t.Fatal("active match must be kept")
	}
}
