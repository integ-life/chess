package api

import (
	"encoding/json"
	"net/http"
	"time"

	"chess/backend/internal/store"
	"chess/backend/internal/chess"
)

func (s *Server) handleListExplorations(w http.ResponseWriter, r *http.Request) {
	out, err := s.Store.ListExplorations(currentUserID(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleGetExploration(w http.ResponseWriter, r *http.Request) {
	e, err := s.Store.GetExploration(currentUserID(r), r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if e == nil {
		writeError(w, http.StatusNotFound, "exploration not found")
		return
	}
	writeJSON(w, http.StatusOK, e)
}

func (s *Server) handlePutExploration(w http.ResponseWriter, r *http.Request) {
	var e store.Exploration
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	e.ID = r.PathValue("id")
	e.UserID = currentUserID(r)
	if e.ID == "" {
		writeError(w, http.StatusBadRequest, "missing id")
		return
	}
	now := time.Now().UnixMilli()
	if e.CreatedAt == 0 {
		e.CreatedAt = now
	}
	if e.UpdatedAt == 0 {
		e.UpdatedAt = now
	}
	if e.RootFEN == "" {
		e.RootFEN = chess.StartFEN
	}
	if _, err := chess.ParseFEN(e.RootFEN); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid rootFen: "+err.Error())
		return
	}
	if len(e.Tree) == 0 {
		writeError(w, http.StatusBadRequest, "missing tree")
		return
	}
	applied, err := s.Store.UpsertExploration(&e)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"applied": applied})
}

func (s *Server) handleDeleteExploration(w http.ResponseWriter, r *http.Request) {
	if err := s.Store.DeleteExploration(currentUserID(r), r.PathValue("id"), time.Now().UnixMilli()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
