package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"chess/backend/internal/store"
	"chess/backend/internal/chess"
)

type syncPushRequest struct {
	Games          []store.Game           `json:"games"`
	Explorations   []store.Exploration    `json:"explorations"`
	CourseProgress []store.CourseProgress `json:"courseProgress"`
}

type syncPushResponse struct {
	Applied    []string `json:"applied"`
	Conflicts  []string `json:"conflicts,omitempty"`
	Rejected   []string `json:"rejected,omitempty"`
	ServerTime int64    `json:"serverTime"`
}

// 批量上行：逐行 LWW upsert；非法棋谱行拒绝但不影响其余
func (s *Server) handleSyncPush(w http.ResponseWriter, r *http.Request) {
	var req syncPushRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	resp := syncPushResponse{Applied: []string{}}
	userID := currentUserID(r)
	for i := range req.Games {
		g := &req.Games[i]
		g.UserID = userID
		ensureGameTree(g)
		if !g.Deleted && validateGameMoves(g.InitialFEN, g.Moves) != nil {
			resp.Rejected = append(resp.Rejected, g.ID)
			continue
		}
		applied, err := s.Store.UpsertGame(g)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if applied {
			resp.Applied = append(resp.Applied, g.ID)
		} else {
			resp.Conflicts = append(resp.Conflicts, g.ID)
		}
	}
	for i := range req.Explorations {
		e := &req.Explorations[i]
		e.UserID = userID
		if !e.Deleted {
			if _, err := chess.ParseFEN(e.RootFEN); err != nil || len(e.Tree) == 0 {
				resp.Rejected = append(resp.Rejected, e.ID)
				continue
			}
		}
		applied, err := s.Store.UpsertExploration(e)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if applied {
			resp.Applied = append(resp.Applied, e.ID)
		} else {
			resp.Conflicts = append(resp.Conflicts, e.ID)
		}
	}
	for i := range req.CourseProgress {
		progress := &req.CourseProgress[i]
		progress.UserID = userID
		var done []bool
		if progress.LessonKey == "" || len(progress.LessonKey) > 120 || progress.PlannedAt <= 0 || progress.UpdatedAt <= 0 || json.Unmarshal(progress.Done, &done) != nil || len(done) != 3 {
			resp.Rejected = append(resp.Rejected, progress.LessonKey)
			continue
		}
		applied, err := s.Store.UpsertCourseProgress(progress)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if applied {
			resp.Applied = append(resp.Applied, progress.LessonKey)
		} else {
			resp.Conflicts = append(resp.Conflicts, progress.LessonKey)
		}
	}
	resp.ServerTime = time.Now().UnixMilli()
	writeJSON(w, http.StatusOK, resp)
}

// 增量下行（含墓碑）；客户端以返回的 serverTime 作为下次 since
func (s *Server) handleSyncPull(w http.ResponseWriter, r *http.Request) {
	since, _ := strconv.ParseInt(r.URL.Query().Get("since"), 10, 64)
	userID := currentUserID(r)
	games, err := s.Store.ListGamesSince(userID, since)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	exps, err := s.Store.ListExplorationsSince(userID, since)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	courseProgress, err := s.Store.ListCourseProgressSince(userID, since)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"games":          games,
		"explorations":   exps,
		"courseProgress": courseProgress,
		"serverTime":     time.Now().UnixMilli(),
	})
}
