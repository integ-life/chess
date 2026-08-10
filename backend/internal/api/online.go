package api

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"chess/backend/internal/store"
	"chess/backend/internal/chess"
)

const (
	onlineInitialTimeMs = int64(10 * 60 * 1000)
	defaultIncrementMs  = int64(15 * 1000)
	defaultBotAfterMs   = int64(8 * 1000)
)

type onlineHub struct {
	mu      sync.Mutex
	waiting *onlineMatch
	matches map[string]*onlineMatch
	rooms   map[string]*onlineMatch
}

type onlinePlayer struct {
	UserID   int64         `json:"-"`
	Username string        `json:"username"`
	Color    chess.Color `json:"-"`
}

type onlineMatch struct {
	ID           string
	RoomCode     string
	Status       string
	OpponentType string
	BotLevel     int
	BotThinking  bool
	InitialFEN   string
	Position     *chess.Position
	Moves        []string
	Red          onlinePlayer
	Black        onlinePlayer
	RedTimeMs    int64
	BlackTimeMs  int64
	IncrementMs  int64
	LastTick     time.Time
	WaitingUntil time.Time
	Result       string
	ResultReason string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type startOnlineMatchRequest struct {
	BotAfterMs    int64 `json:"botAfterMs"`
	BotLevel      int   `json:"botLevel"`
	InitialTimeMs int64 `json:"initialTimeMs"`
	IncrementMs   int64 `json:"incrementMs"`
}

type onlineMoveRequest struct {
	Move string `json:"move"`
}

type onlinePlayerSnapshot struct {
	UserID   int64  `json:"userId"`
	Username string `json:"username"`
	Color    string `json:"color"`
}

type onlineMatchSnapshot struct {
	ID             string               `json:"id"`
	RoomCode       string               `json:"roomCode"`
	Status         string               `json:"status"`
	OpponentType   string               `json:"opponentType"`
	BotLevel       int                  `json:"botLevel"`
	BotThinking    bool                 `json:"botThinking"`
	InitialFEN     string               `json:"initialFen"`
	FEN            string               `json:"fen"`
	Moves          []string             `json:"moves"`
	Red            onlinePlayerSnapshot `json:"red"`
	Black          onlinePlayerSnapshot `json:"black"`
	RedTimeMs      int64                `json:"redTimeMs"`
	BlackTimeMs    int64                `json:"blackTimeMs"`
	IncrementMs    int64                `json:"incrementMs"`
	LastTickMs     int64                `json:"lastTickMs"`
	WaitingUntilMs int64                `json:"waitingUntilMs"`
	Result         string               `json:"result"`
	ResultReason   string               `json:"resultReason"`
	CreatedAtMs    int64                `json:"createdAtMs"`
	UpdatedAtMs    int64                `json:"updatedAtMs"`
}

type onlineMatchResponse struct {
	ID           string   `json:"id"`
	RoomCode     string   `json:"roomCode,omitempty"`
	Status       string   `json:"status"`
	OpponentType string   `json:"opponentType"`
	BotLevel     int      `json:"botLevel,omitempty"`
	BotThinking  bool     `json:"botThinking"`
	PlayerColor  string   `json:"playerColor"`
	Turn         string   `json:"turn"`
	InitialFEN   string   `json:"initialFen"`
	FEN          string   `json:"fen"`
	Moves        []string `json:"moves"`
	RedPlayer    string   `json:"redPlayer"`
	BlackPlayer  string   `json:"blackPlayer"`
	RedTimeMs    int64    `json:"redTimeMs"`
	BlackTimeMs  int64    `json:"blackTimeMs"`
	IncrementMs  int64    `json:"incrementMs"`
	WaitingUntil int64    `json:"waitingUntil,omitempty"`
	Result       string   `json:"result"`
	ResultReason string   `json:"resultReason,omitempty"`
}

func newOnlineHub() *onlineHub {
	return &onlineHub{matches: map[string]*onlineMatch{}, rooms: map[string]*onlineMatch{}}
}

func (s *Server) onlineHub() *onlineHub {
	if s.Online == nil {
		s.Online = newOnlineHub()
	}
	return s.Online
}

func (s *Server) handleCreateOnlineRoom(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	var req startOnlineMatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	normalizeTimeControl(&req)

	hub := s.onlineHub()
	hub.mu.Lock()
	defer hub.mu.Unlock()

	roomCode := hub.newRoomCodeLocked()
	matchID := "room-" + randomID()
	now := time.Now()
	m := &onlineMatch{
		ID:           matchID,
		RoomCode:     roomCode,
		Status:       "waiting",
		OpponentType: "human",
		InitialFEN:   chess.StartFEN,
		Position:     mustStartPosition(),
		Red:          onlinePlayer{UserID: user.ID, Username: user.Username, Color: chess.Red},
		RedTimeMs:    req.InitialTimeMs,
		BlackTimeMs:  req.InitialTimeMs,
		IncrementMs:  req.IncrementMs,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	hub.matches[matchID] = m
	hub.rooms[roomCode] = m
	hub.persistOnlineStateLocked(m, s)
	writeJSON(w, http.StatusOK, m.responseFor(user.ID))
}

func (s *Server) handleJoinOnlineRoom(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	roomCode := normalizeRoomCode(r.PathValue("code"))
	hub := s.onlineHub()
	hub.mu.Lock()
	defer hub.mu.Unlock()

	m := hub.rooms[roomCode]
	if m == nil {
		m = hub.restoreRoomLocked(roomCode, s)
	}
	if m == nil {
		writeError(w, http.StatusNotFound, "room not found")
		return
	}
	hub.tickLocked(m, time.Now(), s)
	if m.Red.UserID == user.ID || m.Black.UserID == user.ID {
		writeJSON(w, http.StatusOK, m.responseFor(user.ID))
		return
	}
	if m.Status != "waiting" || m.Black.UserID != 0 {
		writeError(w, http.StatusConflict, "room is already full")
		return
	}
	m.Status = "active"
	m.Black = onlinePlayer{UserID: user.ID, Username: user.Username, Color: chess.Black}
	m.LastTick = time.Now()
	m.UpdatedAt = m.LastTick
	hub.persistMatchLocked(m, s)
	hub.persistOnlineStateLocked(m, s)
	writeJSON(w, http.StatusOK, m.responseFor(user.ID))
}

func (s *Server) handleStartOnlineMatch(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	var req startOnlineMatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.BotAfterMs <= 0 {
		req.BotAfterMs = defaultBotAfterMs
	}
	if req.BotLevel <= 0 {
		req.BotLevel = 3
	}
	req.BotLevel = min(max(req.BotLevel, 1), 10)
	normalizeTimeControl(&req)

	hub := s.onlineHub()
	hub.mu.Lock()
	defer hub.mu.Unlock()
	hub.expireWaitingLocked(time.Now(), s)

	if hub.waiting != nil && hub.waiting.Red.UserID != user.ID {
		m := hub.waiting
		hub.waiting = nil
		m.Status = "active"
		m.OpponentType = "human"
		m.Black = onlinePlayer{UserID: user.ID, Username: user.Username, Color: chess.Black}
		m.LastTick = time.Now()
		m.UpdatedAt = m.LastTick
		hub.persistMatchLocked(m, s)
		hub.persistOnlineStateLocked(m, s)
		writeJSON(w, http.StatusOK, m.responseFor(user.ID))
		return
	}
	if hub.waiting != nil && hub.waiting.Red.UserID == user.ID {
		writeJSON(w, http.StatusOK, hub.waiting.responseFor(user.ID))
		return
	}

	matchID := "online-" + randomID()
	m := &onlineMatch{
		ID:           matchID,
		Status:       "waiting",
		OpponentType: "human",
		InitialFEN:   chess.StartFEN,
		Position:     mustStartPosition(),
		Red:          onlinePlayer{UserID: user.ID, Username: user.Username, Color: chess.Red},
		BotLevel:     req.BotLevel,
		RedTimeMs:    req.InitialTimeMs,
		BlackTimeMs:  req.InitialTimeMs,
		IncrementMs:  req.IncrementMs,
		WaitingUntil: time.Now().Add(time.Duration(req.BotAfterMs) * time.Millisecond),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	hub.matches[matchID] = m
	hub.waiting = m
	hub.persistOnlineStateLocked(m, s)
	writeJSON(w, http.StatusOK, m.responseFor(user.ID))
}

func (s *Server) handleResumeOnlineMatch(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	hub := s.onlineHub()
	hub.mu.Lock()
	defer hub.mu.Unlock()

	if m := hub.openMatchForUserLocked(user.ID); m != nil {
		hub.expireWaitingLocked(time.Now(), s)
		hub.tickLocked(m, time.Now(), s)
		writeJSON(w, http.StatusOK, m.responseFor(user.ID))
		return
	}
	m := hub.restoreLatestForUserLocked(user.ID, user.Username, s)
	if m == nil {
		writeJSON(w, http.StatusOK, nil)
		return
	}
	hub.expireWaitingLocked(time.Now(), s)
	hub.tickLocked(m, time.Now(), s)
	writeJSON(w, http.StatusOK, m.responseFor(user.ID))
}

func (s *Server) handleGetOnlineMatch(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	m, ok := s.onlineMatchForRequest(w, r, user.ID)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, m.responseFor(user.ID))
}

func (s *Server) handleCancelOnlineMatch(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	hub := s.onlineHub()
	hub.mu.Lock()
	defer hub.mu.Unlock()

	m, ok := hub.matchForUserOrRestoreLocked(r.PathValue("id"), user.ID, s)
	if !ok {
		writeError(w, http.StatusNotFound, "match not found")
		return
	}
	if m.Status != "waiting" {
		writeError(w, http.StatusConflict, "only waiting matches can be cancelled")
		return
	}
	if hub.waiting == m {
		hub.waiting = nil
	}
	if m.RoomCode != "" {
		delete(hub.rooms, m.RoomCode)
	}
	delete(hub.matches, m.ID)
	_ = s.Store.DeleteOnlineMatch(m.ID)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleOnlineMove(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	var req onlineMoveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	move, err := chess.MoveFromICCS(req.Move)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	hub := s.onlineHub()
	var botFen string
	var botLevel int
	var matchID string

	hub.mu.Lock()
	m, ok := hub.matchForUserOrRestoreLocked(r.PathValue("id"), user.ID, s)
	if !ok {
		hub.mu.Unlock()
		writeError(w, http.StatusNotFound, "match not found")
		return
	}
	hub.tickLocked(m, time.Now(), s)
	if m.Status != "active" {
		hub.mu.Unlock()
		writeJSON(w, http.StatusOK, m.responseFor(user.ID))
		return
	}
	if m.BotThinking {
		hub.mu.Unlock()
		writeError(w, http.StatusConflict, "opponent is thinking")
		return
	}
	if colorName(m.Position.Turn) != m.responseFor(user.ID).PlayerColor {
		hub.mu.Unlock()
		writeError(w, http.StatusConflict, "not your turn")
		return
	}
	if !m.Position.IsLegal(move) {
		hub.mu.Unlock()
		writeError(w, http.StatusUnprocessableEntity, "illegal move")
		return
	}
	hub.applyMoveLocked(m, move, s)
	if m.Status == "active" && m.OpponentType == "bot" && m.Position.Turn == chess.Black {
		m.BotThinking = true
		hub.persistOnlineStateLocked(m, s)
		botFen = m.Position.FEN()
		botLevel = m.BotLevel
		matchID = m.ID
	}
	resp := m.responseFor(user.ID)
	hub.mu.Unlock()

	if botFen != "" {
		go s.playBotMove(matchID, botFen, botLevel)
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleOnlineResign(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	hub := s.onlineHub()
	hub.mu.Lock()
	defer hub.mu.Unlock()
	m, ok := hub.matchForUserOrRestoreLocked(r.PathValue("id"), user.ID, s)
	if !ok {
		writeError(w, http.StatusNotFound, "match not found")
		return
	}
	hub.tickLocked(m, time.Now(), s)
	if m.Status == "active" || m.Status == "waiting" {
		if hub.waiting == m {
			hub.waiting = nil
		}
		if m.RoomCode != "" {
			delete(hub.rooms, m.RoomCode)
		}
		m.Status = "finished"
		m.ResultReason = "resign"
		if m.Red.UserID == user.ID {
			m.Result = "0-1"
		} else {
			m.Result = "1-0"
		}
		m.UpdatedAt = time.Now()
		hub.persistMatchLocked(m, s)
		hub.persistOnlineStateLocked(m, s)
	}
	writeJSON(w, http.StatusOK, m.responseFor(user.ID))
}

func (s *Server) onlineMatchForRequest(w http.ResponseWriter, r *http.Request, userID int64) (*onlineMatch, bool) {
	hub := s.onlineHub()
	hub.mu.Lock()
	defer hub.mu.Unlock()
	hub.expireWaitingLocked(time.Now(), s)
	m, ok := hub.matchForUserOrRestoreLocked(r.PathValue("id"), userID, s)
	if !ok {
		writeError(w, http.StatusNotFound, "match not found")
		return nil, false
	}
	hub.tickLocked(m, time.Now(), s)
	return m, true
}

func (hub *onlineHub) expireWaitingLocked(now time.Time, s *Server) {
	if hub.waiting == nil || now.Before(hub.waiting.WaitingUntil) {
		return
	}
	m := hub.waiting
	hub.waiting = nil
	m.Status = "active"
	m.OpponentType = "bot"
	if m.BotLevel <= 0 {
		m.BotLevel = 3
	}
	m.Black = onlinePlayer{Username: fmt.Sprintf("电脑(%d级)", m.BotLevel), Color: chess.Black}
	m.LastTick = now
	m.UpdatedAt = now
	hub.persistMatchLocked(m, s)
	hub.persistOnlineStateLocked(m, s)
}

func (hub *onlineHub) openMatchForUserLocked(userID int64) *onlineMatch {
	for _, m := range hub.matches {
		if (m.Status == "waiting" || m.Status == "active") && (m.Red.UserID == userID || m.Black.UserID == userID) {
			return m
		}
	}
	return nil
}

func (hub *onlineHub) matchForUserLocked(id string, userID int64) (*onlineMatch, bool) {
	m := hub.matches[id]
	if m == nil {
		return nil, false
	}
	if m.Red.UserID == userID || m.Black.UserID == userID {
		return m, true
	}
	return nil, false
}

func (hub *onlineHub) matchForUserOrRestoreLocked(id string, userID int64, s *Server) (*onlineMatch, bool) {
	if m, ok := hub.matchForUserLocked(id, userID); ok {
		return m, true
	}
	record, err := s.Store.OnlineMatchByID(id)
	if err != nil || record == nil {
		return nil, false
	}
	m := hub.restoreRecordLocked(record, s)
	if m == nil || (m.Red.UserID != userID && m.Black.UserID != userID) {
		return nil, false
	}
	return m, true
}

func (hub *onlineHub) tickLocked(m *onlineMatch, now time.Time, s *Server) {
	if m.Status != "active" || m.LastTick.IsZero() {
		return
	}
	elapsed := now.Sub(m.LastTick).Milliseconds()
	if elapsed <= 0 {
		return
	}
	if m.Position.Turn == chess.Red {
		m.RedTimeMs -= elapsed
		if m.RedTimeMs <= 0 {
			m.RedTimeMs = 0
			m.Status = "finished"
			m.Result = "0-1"
			m.ResultReason = "timeout"
		}
	} else {
		m.BlackTimeMs -= elapsed
		if m.BlackTimeMs <= 0 {
			m.BlackTimeMs = 0
			m.Status = "finished"
			m.Result = "1-0"
			m.ResultReason = "timeout"
		}
	}
	m.LastTick = now
	m.UpdatedAt = now
	if m.Status == "finished" {
		if m.RoomCode != "" {
			delete(hub.rooms, m.RoomCode)
		}
		hub.persistMatchLocked(m, s)
	}
	hub.persistOnlineStateLocked(m, s)
}

func (hub *onlineHub) applyMoveLocked(m *onlineMatch, move chess.Move, s *Server) {
	mover := m.Position.Turn
	m.Position.Apply(move)
	m.Moves = append(m.Moves, move.ICCS())
	if mover == chess.Red {
		m.RedTimeMs += m.IncrementMs
	} else {
		m.BlackTimeMs += m.IncrementMs
	}
	m.LastTick = time.Now()
	m.UpdatedAt = m.LastTick
	switch chess.Status(m.Position) {
	case chess.Checkmate:
		m.Status = "finished"
		m.ResultReason = "checkmate"
	case chess.Stalemate:
		m.Status = "finished"
		m.ResultReason = "stalemate"
	}
	if m.Status == "finished" {
		if m.RoomCode != "" {
			delete(hub.rooms, m.RoomCode)
		}
		if m.Position.Turn == chess.Black {
			m.Result = "1-0"
		} else {
			m.Result = "0-1"
		}
	}
	hub.persistMatchLocked(m, s)
	hub.persistOnlineStateLocked(m, s)
}

func (hub *onlineHub) persistMatchLocked(m *onlineMatch, s *Server) {
	now := time.Now().UnixMilli()
	players := []onlinePlayer{m.Red}
	if m.Black.UserID != 0 {
		players = append(players, m.Black)
	}
	for _, p := range players {
		if p.UserID == 0 {
			continue
		}
		id := m.ID + "-" + strconv.FormatInt(p.UserID, 10)
		moves, _ := json.Marshal(m.Moves)
		g := &store.Game{
			ID:          id,
			UserID:      p.UserID,
			Title:       "在线对局 " + time.UnixMilli(now).Format("2006-01-02"),
			RedPlayer:   m.Red.Username,
			BlackPlayer: m.Black.Username,
			Result:      resultOrOngoing(m.Result),
			InitialFEN:  m.InitialFEN,
			Moves:       moves,
			Source:      "online",
			CreatedAt:   m.CreatedAt.UnixMilli(),
			UpdatedAt:   now,
			Deleted:     false,
		}
		ensureGameTree(g)
		_, _ = s.Store.UpsertGame(g)
	}
}

func (hub *onlineHub) persistOnlineStateLocked(m *onlineMatch, s *Server) {
	if m == nil {
		return
	}
	if m.Status == "finished" {
		_ = s.Store.DeleteOnlineMatch(m.ID)
		return
	}
	raw, err := json.Marshal(matchSnapshot(m))
	if err != nil {
		return
	}
	_ = s.Store.UpsertOnlineMatch(store.OnlineMatchRecord{
		ID:          m.ID,
		Status:      m.Status,
		RoomCode:    m.RoomCode,
		RedUserID:   m.Red.UserID,
		BlackUserID: m.Black.UserID,
		UpdatedAt:   m.UpdatedAt.UnixMilli(),
		Payload:     string(raw),
	})
}

func (hub *onlineHub) restoreLatestForUserLocked(userID int64, username string, s *Server) *onlineMatch {
	record, err := s.Store.LatestOpenOnlineMatchForUser(userID)
	if err == nil && record != nil {
		return hub.restoreRecordLocked(record, s)
	}
	return hub.restoreLegacyGameLocked(userID, username, s)
}

func (hub *onlineHub) restoreRoomLocked(roomCode string, s *Server) *onlineMatch {
	record, err := s.Store.OnlineMatchByRoomCode(roomCode)
	if err != nil || record == nil {
		return nil
	}
	return hub.restoreRecordLocked(record, s)
}

func (hub *onlineHub) restoreRecordLocked(record *store.OnlineMatchRecord, s *Server) *onlineMatch {
	if existing := hub.matches[record.ID]; existing != nil {
		return existing
	}
	m, err := matchFromSnapshot(record.Payload)
	if err != nil || m.Status == "finished" {
		_ = s.Store.DeleteOnlineMatch(record.ID)
		return nil
	}
	now := time.Now()
	if m.Status == "active" {
		m.LastTick = now
		m.UpdatedAt = now
	}
	hub.matches[m.ID] = m
	if m.Status == "waiting" {
		if m.RoomCode != "" {
			hub.rooms[m.RoomCode] = m
		} else if hub.waiting == nil || m.UpdatedAt.After(hub.waiting.UpdatedAt) {
			hub.waiting = m
		}
	}
	hub.persistOnlineStateLocked(m, s)
	if m.Status == "active" && m.OpponentType == "bot" && m.BotThinking {
		go s.playBotMove(m.ID, m.Position.FEN(), m.BotLevel)
	}
	return m
}

func (hub *onlineHub) restoreLegacyGameLocked(userID int64, username string, s *Server) *onlineMatch {
	game, err := s.Store.LatestOngoingOnlineGameForUser(userID)
	if err != nil || game == nil {
		return nil
	}
	suffix := "-" + strconv.FormatInt(userID, 10)
	if !strings.HasSuffix(game.ID, suffix) {
		return nil
	}
	matchID := strings.TrimSuffix(game.ID, suffix)
	rows, err := s.Store.OngoingOnlineGamesByMatchID(matchID)
	if err != nil {
		return nil
	}
	pos, moves, err := replayGamePosition(game.InitialFEN, game.Moves)
	if err != nil {
		return nil
	}
	now := time.Now()
	m := &onlineMatch{
		ID:           matchID,
		Status:       "active",
		OpponentType: "human",
		InitialFEN:   game.InitialFEN,
		Position:     pos,
		Moves:        moves,
		RedTimeMs:    onlineInitialTimeMs,
		BlackTimeMs:  onlineInitialTimeMs,
		IncrementMs:  defaultIncrementMs,
		LastTick:     now,
		CreatedAt:    time.UnixMilli(game.CreatedAt),
		UpdatedAt:    now,
	}
	if m.CreatedAt.IsZero() {
		m.CreatedAt = now
	}
	for _, row := range rows {
		if row.RedPlayer == game.RedPlayer {
			if row.UserID == userID {
				m.Red = onlinePlayer{UserID: userID, Username: username, Color: chess.Red}
			} else {
				m.Red = onlinePlayer{UserID: row.UserID, Username: row.RedPlayer, Color: chess.Red}
			}
		}
		if row.BlackPlayer == game.BlackPlayer {
			if row.UserID == userID {
				m.Black = onlinePlayer{UserID: userID, Username: username, Color: chess.Black}
			} else if !strings.HasPrefix(row.BlackPlayer, "电脑") {
				m.Black = onlinePlayer{UserID: row.UserID, Username: row.BlackPlayer, Color: chess.Black}
			}
		}
	}
	if m.Red.Username == "" {
		m.Red = onlinePlayer{Username: game.RedPlayer, Color: chess.Red}
		if game.RedPlayer == username {
			m.Red.UserID = userID
		}
	}
	if m.Black.Username == "" {
		m.Black = onlinePlayer{Username: game.BlackPlayer, Color: chess.Black}
		if game.BlackPlayer == username {
			m.Black.UserID = userID
		}
	}
	if strings.HasPrefix(m.Black.Username, "电脑") {
		m.OpponentType = "bot"
		m.BotLevel = 3
	}
	if m.Red.UserID != userID && m.Black.UserID != userID {
		return nil
	}
	hub.matches[m.ID] = m
	hub.persistOnlineStateLocked(m, s)
	return m
}

func (s *Server) playBotMove(matchID, fen string, level int) {
	pos, err := chess.ParseFEN(fen)
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	res, err := s.Engine.BestMove(ctx, pos.FEN(), level)
	hub := s.onlineHub()
	hub.mu.Lock()
	defer hub.mu.Unlock()
	m := hub.matches[matchID]
	if m == nil || m.Status != "active" || m.Position.FEN() != fen || !m.BotThinking {
		return
	}
	m.BotThinking = false
	var move chess.Move
	if err == nil {
		move, err = chess.MoveFromICCS(res.BestMove)
	}
	if err != nil || !m.Position.IsLegal(move) {
		legal := chess.LegalMoves(m.Position)
		if len(legal) == 0 {
			return
		}
		move = legal[rand.Intn(len(legal))]
	}
	hub.tickLocked(m, time.Now(), s)
	if m.Status != "active" {
		return
	}
	hub.applyMoveLocked(m, move, s)
}

func (m *onlineMatch) responseFor(userID int64) onlineMatchResponse {
	playerColor := ""
	if m.Red.UserID == userID {
		playerColor = colorName(chess.Red)
	} else if m.Black.UserID == userID {
		playerColor = colorName(chess.Black)
	}
	waitingUntil := int64(0)
	if !m.WaitingUntil.IsZero() && m.Status == "waiting" {
		waitingUntil = m.WaitingUntil.UnixMilli()
	}
	return onlineMatchResponse{
		ID:           m.ID,
		RoomCode:     m.RoomCode,
		Status:       m.Status,
		OpponentType: m.OpponentType,
		BotLevel:     m.BotLevel,
		BotThinking:  m.BotThinking,
		PlayerColor:  playerColor,
		Turn:         colorName(m.Position.Turn),
		InitialFEN:   m.InitialFEN,
		FEN:          m.Position.FEN(),
		Moves:        nonNilMoves(m.Moves),
		RedPlayer:    m.Red.Username,
		BlackPlayer:  m.Black.Username,
		RedTimeMs:    m.RedTimeMs,
		BlackTimeMs:  m.BlackTimeMs,
		IncrementMs:  m.IncrementMs,
		WaitingUntil: waitingUntil,
		Result:       resultOrOngoing(m.Result),
		ResultReason: m.ResultReason,
	}
}

func mustStartPosition() *chess.Position {
	pos, err := chess.ParseFEN(chess.StartFEN)
	if err != nil {
		panic(err)
	}
	return pos
}

func colorName(c chess.Color) string {
	if c == chess.Red {
		return "r"
	}
	return "b"
}

func resultOrOngoing(result string) string {
	if result == "" {
		return "*"
	}
	return result
}

func normalizeTimeControl(req *startOnlineMatchRequest) {
	if req.InitialTimeMs <= 0 {
		req.InitialTimeMs = onlineInitialTimeMs
	}
	if req.IncrementMs <= 0 {
		req.IncrementMs = defaultIncrementMs
	}
	req.InitialTimeMs = min(max(req.InitialTimeMs, int64(60*1000)), int64(60*60*1000))
	req.IncrementMs = min(max(req.IncrementMs, int64(0)), int64(60*1000))
}

func randomID() string {
	return strconv.FormatInt(time.Now().UnixNano(), 36) + "-" + strconv.FormatInt(rand.Int63(), 36)
}

func (hub *onlineHub) newRoomCodeLocked() string {
	for {
		code := strconv.FormatInt(rand.Int63n(36*36*36*36), 36)
		for len(code) < 4 {
			code = "0" + code
		}
		code = normalizeRoomCode(code)
		if hub.rooms[code] == nil {
			return code
		}
	}
}

func normalizeRoomCode(code string) string {
	out := make([]byte, 0, len(code))
	for i := range code {
		c := code[i]
		if c >= 'a' && c <= 'z' {
			c -= 'a' - 'A'
		}
		if (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') {
			out = append(out, c)
		}
	}
	return string(out)
}

func nonNilMoves(moves []string) []string {
	if moves == nil {
		return []string{}
	}
	return slices.Clone(moves)
}

func matchSnapshot(m *onlineMatch) onlineMatchSnapshot {
	return onlineMatchSnapshot{
		ID:           m.ID,
		RoomCode:     m.RoomCode,
		Status:       m.Status,
		OpponentType: m.OpponentType,
		BotLevel:     m.BotLevel,
		BotThinking:  m.BotThinking,
		InitialFEN:   m.InitialFEN,
		FEN:          m.Position.FEN(),
		Moves:        nonNilMoves(m.Moves),
		Red: onlinePlayerSnapshot{
			UserID:   m.Red.UserID,
			Username: m.Red.Username,
			Color:    colorName(m.Red.Color),
		},
		Black: onlinePlayerSnapshot{
			UserID:   m.Black.UserID,
			Username: m.Black.Username,
			Color:    colorName(m.Black.Color),
		},
		RedTimeMs:      m.RedTimeMs,
		BlackTimeMs:    m.BlackTimeMs,
		IncrementMs:    m.IncrementMs,
		LastTickMs:     timeToUnixMilli(m.LastTick),
		WaitingUntilMs: timeToUnixMilli(m.WaitingUntil),
		Result:         m.Result,
		ResultReason:   m.ResultReason,
		CreatedAtMs:    timeToUnixMilli(m.CreatedAt),
		UpdatedAtMs:    timeToUnixMilli(m.UpdatedAt),
	}
}

func matchFromSnapshot(raw string) (*onlineMatch, error) {
	var snap onlineMatchSnapshot
	if err := json.Unmarshal([]byte(raw), &snap); err != nil {
		return nil, err
	}
	pos, err := chess.ParseFEN(snap.FEN)
	if err != nil {
		return nil, err
	}
	m := &onlineMatch{
		ID:           snap.ID,
		RoomCode:     snap.RoomCode,
		Status:       snap.Status,
		OpponentType: snap.OpponentType,
		BotLevel:     snap.BotLevel,
		BotThinking:  snap.BotThinking,
		InitialFEN:   snap.InitialFEN,
		Position:     pos,
		Moves:        nonNilMoves(snap.Moves),
		Red: onlinePlayer{
			UserID:   snap.Red.UserID,
			Username: snap.Red.Username,
			Color:    parseColor(snap.Red.Color),
		},
		Black: onlinePlayer{
			UserID:   snap.Black.UserID,
			Username: snap.Black.Username,
			Color:    parseColor(snap.Black.Color),
		},
		RedTimeMs:    snap.RedTimeMs,
		BlackTimeMs:  snap.BlackTimeMs,
		IncrementMs:  snap.IncrementMs,
		LastTick:     unixMilliToTime(snap.LastTickMs),
		WaitingUntil: unixMilliToTime(snap.WaitingUntilMs),
		Result:       snap.Result,
		ResultReason: snap.ResultReason,
		CreatedAt:    unixMilliToTime(snap.CreatedAtMs),
		UpdatedAt:    unixMilliToTime(snap.UpdatedAtMs),
	}
	if m.InitialFEN == "" {
		m.InitialFEN = chess.StartFEN
	}
	if m.OpponentType == "" {
		m.OpponentType = "human"
	}
	if m.Status == "" {
		m.Status = "active"
	}
	if m.IncrementMs == 0 {
		m.IncrementMs = defaultIncrementMs
	}
	if m.RedTimeMs == 0 {
		m.RedTimeMs = onlineInitialTimeMs
	}
	if m.BlackTimeMs == 0 {
		m.BlackTimeMs = onlineInitialTimeMs
	}
	now := time.Now()
	if m.CreatedAt.IsZero() {
		m.CreatedAt = now
	}
	if m.UpdatedAt.IsZero() {
		m.UpdatedAt = now
	}
	return m, nil
}

func replayGamePosition(initialFEN string, movesJSON json.RawMessage) (*chess.Position, []string, error) {
	if initialFEN == "" {
		initialFEN = chess.StartFEN
	}
	pos, err := chess.ParseFEN(initialFEN)
	if err != nil {
		return nil, nil, err
	}
	moves := []string{}
	if len(movesJSON) > 0 && string(movesJSON) != "null" {
		if err := json.Unmarshal(movesJSON, &moves); err != nil {
			return nil, nil, err
		}
	}
	for _, iccs := range moves {
		move, err := chess.MoveFromICCS(iccs)
		if err != nil {
			return nil, nil, err
		}
		if !pos.IsLegal(move) {
			return nil, nil, &illegalMoveError{iccs}
		}
		pos.Apply(move)
	}
	return pos, moves, nil
}

func parseColor(name string) chess.Color {
	if name == "b" {
		return chess.Black
	}
	return chess.Red
}

func timeToUnixMilli(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.UnixMilli()
}

func unixMilliToTime(ms int64) time.Time {
	if ms == 0 {
		return time.Time{}
	}
	return time.UnixMilli(ms)
}
