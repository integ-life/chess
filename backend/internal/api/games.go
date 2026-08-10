package api

import (
	"encoding/json"
	"net/http"
	"time"

	"chess/backend/internal/store"
	"chess/backend/internal/chess"
)

func (s *Server) handleListGames(w http.ResponseWriter, r *http.Request) {
	games, err := s.Store.ListGames(currentUserID(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, games)
}

func (s *Server) handleListPublicGames(w http.ResponseWriter, r *http.Request) {
	games, err := s.Store.ListPublicGames(store.PublicGameFilter{
		Category: r.URL.Query().Get("category"),
		Search:   r.URL.Query().Get("q"),
		Sort:     r.URL.Query().Get("sort"),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, games)
}

func (s *Server) handleGetGame(w http.ResponseWriter, r *http.Request) {
	g, err := s.Store.GetGame(currentUserID(r), r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if g == nil {
		writeError(w, http.StatusNotFound, "game not found")
		return
	}
	writeJSON(w, http.StatusOK, g)
}

// validateGameMoves 从初始局面重放校验所有着法
func validateGameMoves(initialFEN string, movesJSON json.RawMessage) error {
	pos, err := chess.ParseFEN(initialFEN)
	if err != nil {
		return err
	}
	var moves []string
	if err := json.Unmarshal(movesJSON, &moves); err != nil {
		return err
	}
	for _, iccs := range moves {
		m, err := chess.MoveFromICCS(iccs)
		if err != nil {
			return err
		}
		if !pos.IsLegal(m) {
			return &illegalMoveError{iccs}
		}
		pos.Apply(m)
	}
	return nil
}

type illegalMoveError struct{ move string }

func (e *illegalMoveError) Error() string { return "illegal move: " + e.move }

func (s *Server) handlePutGame(w http.ResponseWriter, r *http.Request) {
	var g store.Game
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	g.ID = r.PathValue("id")
	g.UserID = currentUserID(r)
	if g.ID == "" {
		writeError(w, http.StatusBadRequest, "missing id")
		return
	}
	now := time.Now().UnixMilli()
	if g.CreatedAt == 0 {
		g.CreatedAt = now
	}
	if g.UpdatedAt == 0 {
		g.UpdatedAt = now
	}
	if g.InitialFEN == "" {
		g.InitialFEN = chess.StartFEN
	}
	if len(g.Moves) == 0 {
		g.Moves = json.RawMessage("[]")
	}
	ensureGameTree(&g)
	if !g.Deleted {
		if err := validateGameMoves(g.InitialFEN, g.Moves); err != nil {
			writeError(w, http.StatusUnprocessableEntity, err.Error())
			return
		}
	}
	applied, err := s.Store.UpsertGame(&g)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"applied": applied})
}

func (s *Server) handleDeleteGame(w http.ResponseWriter, r *http.Request) {
	if err := s.Store.DeleteGame(currentUserID(r), r.PathValue("id"), time.Now().UnixMilli()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
