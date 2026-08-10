package qipu

import (
	"context"
	"fmt"
	"time"

	"chess/backend/internal/engine"
	"chess/backend/internal/chess"
)

type Analysis struct {
	QualityScore  int
	AverageLossCP int
	BlunderCount  int
}

func AnalyzeGame(ctx context.Context, eng *engine.Engine, dataset *Dataset, game Record, depth, samples int) (Analysis, error) {
	if len(game.Moves) == 0 {
		return Analysis{}, fmt.Errorf("game has no moves")
	}
	pos, err := chess.ParseFEN(game.InitialFEN)
	if err != nil {
		return Analysis{}, err
	}
	positions := make([]*chess.Position, 1, len(game.Moves)+1)
	positions[0] = pos
	for _, iccs := range game.Moves {
		move, err := chess.MoveFromICCS(iccs)
		if err != nil || !pos.IsLegal(move) {
			return Analysis{}, fmt.Errorf("illegal move %s", iccs)
		}
		next := *pos
		next.Apply(move)
		pos = &next
		positions = append(positions, pos)
	}

	indices := sampleIndices(len(game.Moves), samples)
	totalLoss, blunders := 0, 0
	for _, i := range indices {
		before, err := evaluatePosition(ctx, eng, dataset, positions[i].FEN(), depth)
		if err != nil {
			return Analysis{}, err
		}
		after, err := evaluatePosition(ctx, eng, dataset, positions[i+1].FEN(), depth)
		if err != nil {
			return Analysis{}, err
		}
		loss := score(before) - score(after)
		if positions[i].Turn == chess.Black {
			loss = -loss
		}
		if loss < 0 {
			loss = 0
		}
		if loss > 2000 {
			loss = 2000
		}
		totalLoss += loss
		if loss >= 300 {
			blunders++
		}
	}
	average := totalLoss / len(indices)
	quality := 100 - average/6
	if quality < 0 {
		quality = 0
	}
	return Analysis{QualityScore: quality, AverageLossCP: average, BlunderCount: blunders}, nil
}

func evaluatePosition(ctx context.Context, eng *engine.Engine, dataset *Dataset, fen string, depth int) (engine.Evaluation, error) {
	if result, ok, err := dataset.PositionEvaluation(fen, eng.Config().Name, depth); err != nil {
		return result, err
	} else if ok {
		return result, nil
	}
	if result, terminal, err := terminalEvaluation(fen); err != nil {
		return result, err
	} else if terminal {
		return result, dataset.SavePositionEvaluation(fen, eng.Config().Name, depth, result)
	}
	result, err := evaluateWithTimeout(ctx, eng, fen, depth)
	if err == nil {
		err = dataset.SavePositionEvaluation(fen, eng.Config().Name, depth, result)
	}
	return result, err
}

func terminalEvaluation(fen string) (engine.Evaluation, bool, error) {
	pos, err := chess.ParseFEN(fen)
	if err != nil || chess.Status(pos) == chess.Ongoing {
		return engine.Evaluation{}, false, err
	}
	mate := 1
	if pos.Turn == chess.Red {
		mate = -1
	}
	return engine.Evaluation{Mate: mate}, true, nil
}

func evaluateWithTimeout(ctx context.Context, eng *engine.Engine, fen string, depth int) (engine.Evaluation, error) {
	searchCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	return eng.Evaluate(searchCtx, fen, depth)
}

func score(e engine.Evaluation) int {
	if e.Mate > 0 {
		return 10000 - e.Mate
	}
	if e.Mate < 0 {
		return -10000 - e.Mate
	}
	return e.ScoreCP
}

func sampleIndices(moveCount, samples int) []int {
	if samples < 1 {
		samples = 1
	}
	if samples > moveCount {
		samples = moveCount
	}
	indices := make([]int, samples)
	for i := range samples {
		indices[i] = (i + 1) * moveCount / (samples + 1)
	}
	return indices
}
