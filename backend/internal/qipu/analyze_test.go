package qipu

import (
	"reflect"
	"testing"
)

func TestSampleIndices(t *testing.T) {
	if got, want := sampleIndices(60, 5), []int{10, 20, 30, 40, 50}; !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	if got, want := sampleIndices(2, 6), []int{0, 1}; !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestTerminalEvaluation(t *testing.T) {
	for _, fen := range []string{
		"7k/6Q1/5K2/8/8/8/8/8 b - - 0 1",
		"R5k1/8/6K1/8/8/8/8/8 b - - 0 1",
	} {
		got, terminal, err := terminalEvaluation(fen)
		if err != nil || !terminal || got.Mate != 1 || got.BestMove != "" {
			t.Fatalf("terminalEvaluation(%q) = %+v, %v, %v", fen, got, terminal, err)
		}
	}
}
