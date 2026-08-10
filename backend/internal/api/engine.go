package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"chess/backend/internal/engine"
	"chess/backend/internal/chess"
)

type engineMoveRequest struct {
	FEN   string `json:"fen"`
	Level int    `json:"level"`
}

func (s *Server) handleEngineMove(w http.ResponseWriter, r *http.Request) {
	if !s.engineMoveLimiter.allow(stringID(currentUserID(r))) {
		writeError(w, http.StatusTooManyRequests, "too many requests")
		return
	}
	var req engineMoveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	pos, err := chess.ParseFEN(req.FEN)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid FEN: "+err.Error())
		return
	}
	if chess.Status(pos) != chess.Ongoing {
		writeError(w, http.StatusUnprocessableEntity, "game is already over")
		return
	}
	// 传规范化后的 FEN 给引擎，避免透传畸形输入
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	res, err := s.Engine.BestMove(ctx, pos.FEN(), req.Level)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "engine error: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

type analysisEvent struct {
	Depth   int                 `json:"depth"`
	ScoreCP *int                `json:"scoreCp,omitempty"`
	Mate    *int                `json:"scoreMate,omitempty"`
	PV      []string            `json:"pv,omitempty"`
	Done    bool                `json:"done,omitempty"`
	Engine  engine.PublicConfig `json:"engine"`
}

// SSE 流式分析；分数归一为红方视角；客户端断开即停止搜索
func (s *Server) handleAnalyze(w http.ResponseWriter, r *http.Request) {
	if !s.engineAnalyzeLimiter.allow(stringID(currentUserID(r))) {
		writeError(w, http.StatusTooManyRequests, "too many requests")
		return
	}
	pos, err := chess.ParseFEN(r.URL.Query().Get("fen"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid FEN: "+err.Error())
		return
	}
	if chess.Status(pos) != chess.Ongoing {
		writeError(w, http.StatusUnprocessableEntity, "game is already over")
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)

	sign := 1
	if pos.Turn == chess.Black {
		sign = -1
	}
	send := func(ev analysisEvent) {
		data, _ := json.Marshal(ev)
		_, _ = w.Write(append(append([]byte("data: "), data...), '\n', '\n'))
		flusher.Flush()
	}
	err = s.Engine.Analyze(r.Context(), pos.FEN(), func(in engine.Info) {
		ev := analysisEvent{Depth: in.Depth, PV: in.PV, Engine: s.Engine.Config()}
		if in.Mate != 0 {
			m := in.Mate * sign
			ev.Mate = &m
		} else {
			cp := in.ScoreCP * sign
			ev.ScoreCP = &cp
		}
		send(ev)
	})
	if err != nil {
		return
	}
	send(analysisEvent{Done: true, Engine: s.Engine.Config()})
}

func stringID(id int64) string { return strconv.FormatInt(id, 10) }
