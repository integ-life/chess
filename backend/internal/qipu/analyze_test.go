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
		"R3k4/1R7/9/9/9/9/9/9/9/4K4 b - - 0 1",
		"3k5/4R4/9/9/9/9/9/9/9/4K4 b - - 0 1",
	} {
		got, terminal, err := terminalEvaluation(fen)
		if err != nil || !terminal || got.Mate != 1 || got.BestMove != "" {
			t.Fatalf("terminalEvaluation(%q) = %+v, %v, %v", fen, got, terminal, err)
		}
	}
}
