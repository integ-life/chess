package qipu

import (
	"path/filepath"
	"testing"

	"chess/backend/internal/engine"
	"chess/backend/internal/chess"
)

func TestDatasetDeduplicatesGamesPrefixesAndTranspositions(t *testing.T) {
	dataset, err := OpenDataset(filepath.Join(t.TempDir(), "qipu.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer dataset.Close()
	for _, source := range []Source{{ID: "a", Name: "A"}, {ID: "b", Name: "B"}, {ID: "c", Name: "C"}} {
		if err := dataset.UpsertSource(source); err != nil {
			t.Fatal(err)
		}
	}

	first := Record{
		SourceID: "a", SourceKey: "game-1", SourceVersion: "1", Title: "A",
		InitialFEN: chess.StartFEN, Moves: []string{"c3c4", "c6c5", "g3g4", "g6g5"}, Result: "1-0",
	}
	first.SetID()
	if err := dataset.Ingest(first); err != nil {
		t.Fatal(err)
	}
	duplicate := first
	duplicate.SourceID, duplicate.SourceKey, duplicate.SourceVersion = "b", "same-game", "2"
	if err := dataset.Ingest(duplicate); err != nil {
		t.Fatal(err)
	}
	transpose := Record{
		SourceID: "c", SourceKey: "game-2", SourceVersion: "1", Title: "B",
		InitialFEN: chess.StartFEN, Moves: []string{"g3g4", "g6g5", "c3c4", "c6c5"}, Result: "0-1",
	}
	transpose.SetID()
	if err := dataset.Ingest(transpose); err != nil {
		t.Fatal(err)
	}

	stats, err := dataset.Stats()
	if err != nil {
		t.Fatal(err)
	}
	if stats.Games != 2 || stats.Provenances != 3 || stats.Positions != 8 || stats.Edges != 8 || stats.GameEdges != 8 {
		t.Fatalf("unexpected dedupe stats: %+v", stats)
	}
	positions, _ := replay(first)
	want := engine.Evaluation{ScoreCP: 42, BestMove: "a0a1"}
	if err := dataset.SavePositionEvaluation(positions[len(positions)-1].FEN(), "Pikafish", 8, want); err != nil {
		t.Fatal(err)
	}
	got, ok, err := dataset.PositionEvaluation(positions[len(positions)-1].FEN(), "Pikafish", 8)
	if err != nil || !ok || got != want {
		t.Fatalf("cached evaluation = %+v, %v, %v", got, ok, err)
	}
}
