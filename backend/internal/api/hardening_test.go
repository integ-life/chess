package api

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"chess/backend/internal/store"
	"chess/backend/internal/chess"
)

type flushRecorder struct {
	*httptest.ResponseRecorder
	flushed bool
}

func (r *flushRecorder) Flush() { r.flushed = true }

func TestRequestLoggerKeepsOnlyMetadataAndFlush(t *testing.T) {
	var logs bytes.Buffer
	s := &Server{RequestLogger: log.New(&logs, "", 0)}
	h := s.logMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.(http.Flusher).Flush()
		_, _ = w.Write([]byte(`{"token":"response-secret"}`))
	}))
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login?password=query-secret", strings.NewReader(`{"password":"body-secret"}`))
	req.Header.Set("Authorization", "Bearer header-secret")
	recorder := &flushRecorder{ResponseRecorder: httptest.NewRecorder()}
	h.ServeHTTP(recorder, req)
	if !recorder.flushed {
		t.Fatal("Flush was not forwarded")
	}
	for _, secret := range []string{"body-secret", "query-secret", "header-secret", "response-secret"} {
		if strings.Contains(logs.String(), secret) {
			t.Fatalf("request log contains %q: %s", secret, logs.String())
		}
	}
	if !strings.Contains(logs.String(), `"status":201`) || !strings.Contains(logs.String(), `"path":"/api/auth/login"`) {
		t.Fatalf("request metadata missing: %s", logs.String())
	}
}

func TestBodyLimitAndEngineAuthRateLimit(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example")
	s, token := testServerAndToken(t)
	s.engineMoveLimiter = newFixedWindowLimiter(1, time.Minute)
	h := s.Router()

	large := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader("{}"))
	large.ContentLength = maxRequestBodyBytes + 1
	large.Header.Set("Origin", "https://app.example")
	largeResponse := serve(h, large)
	if largeResponse.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("large request status = %d", largeResponse.Code)
	}
	if got := largeResponse.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example" {
		t.Fatalf("large request CORS origin = %q", got)
	}

	if got := serve(h, httptest.NewRequest(http.MethodPost, "/api/engine/move", strings.NewReader("{}"))).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous engine status = %d", got)
	}
	if got := serve(h, httptest.NewRequest(http.MethodGet, "/api/engine/analyze?fen=bad", nil)).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous analysis status = %d", got)
	}
	authed := func() *http.Request {
		r := httptest.NewRequest(http.MethodPost, "/api/engine/move", strings.NewReader(`{"fen":"bad"}`))
		r.Header.Set("Authorization", "Bearer "+token)
		return r
	}
	if got := serve(h, authed()).Code; got != http.StatusBadRequest {
		t.Fatalf("first engine request status = %d", got)
	}
	if got := serve(h, authed()).Code; got != http.StatusTooManyRequests {
		t.Fatalf("rate-limited engine status = %d", got)
	}
}

func TestFixedWindowLimiterCapsKeys(t *testing.T) {
	limiter := newFixedWindowLimiter(2, time.Minute)
	limiter.maxKeys = 2
	if !limiter.allow("one") || !limiter.allow("two") {
		t.Fatal("limiter rejected keys below capacity")
	}
	if limiter.allow("three") {
		t.Fatal("limiter accepted a key beyond capacity")
	}
	if !limiter.allow("one") {
		t.Fatal("limiter rejected an existing key below its request limit")
	}
}

func TestClientIPPrefersCloudflare(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "192.0.2.4:1234"
	req.Header.Set("CF-Connecting-IP", " 203.0.113.10 ")
	req.Header.Set("X-Forwarded-For", "198.51.100.2, 198.51.100.3")
	req.Header.Set("X-Real-IP", "198.51.100.4")
	if got := clientIP(req); got != "203.0.113.10" {
		t.Fatalf("client IP = %q", got)
	}
}

func TestSyncPushReportsAppliedConflictsAndRejected(t *testing.T) {
	s, token := testServerAndToken(t)
	user, err := s.Store.UserBySession(token)
	if err != nil || user == nil {
		t.Fatalf("session user: %v", err)
	}
	seedGame := store.Game{ID: "old-game", UserID: user.ID, InitialFEN: chess.StartFEN, Moves: json.RawMessage("[]"), CreatedAt: 1, UpdatedAt: 200}
	if applied, err := s.Store.UpsertGame(&seedGame); err != nil || !applied {
		t.Fatalf("seed game: applied=%v err=%v", applied, err)
	}
	seedExp := store.Exploration{ID: "old-exp", UserID: user.ID, RootFEN: chess.StartFEN, Tree: json.RawMessage(`{"root":{}}`), CreatedAt: 1, UpdatedAt: 200}
	if applied, err := s.Store.UpsertExploration(&seedExp); err != nil || !applied {
		t.Fatalf("seed exploration: applied=%v err=%v", applied, err)
	}
	seedProgress := store.CourseProgress{LessonKey: "old-lesson", UserID: user.ID, PlannedAt: 1, Done: json.RawMessage(`[true,false,false]`), UpdatedAt: 200}
	if applied, err := s.Store.UpsertCourseProgress(&seedProgress); err != nil || !applied {
		t.Fatalf("seed course progress: applied=%v err=%v", applied, err)
	}

	payload := syncPushRequest{
		Games: []store.Game{
			{ID: "old-game", Title: "stale", InitialFEN: chess.StartFEN, Moves: json.RawMessage("[]"), CreatedAt: 1, UpdatedAt: 100},
			{ID: "new-game", InitialFEN: chess.StartFEN, Moves: json.RawMessage("[]"), CreatedAt: 1, UpdatedAt: 100},
			{ID: "bad-game", InitialFEN: chess.StartFEN, Moves: json.RawMessage(`["a0a9"]`), CreatedAt: 1, UpdatedAt: 100},
		},
		Explorations: []store.Exploration{
			{ID: "old-exp", RootFEN: chess.StartFEN, Tree: json.RawMessage(`{"root":{}}`), CreatedAt: 1, UpdatedAt: 100},
			{ID: "new-exp", RootFEN: chess.StartFEN, Tree: json.RawMessage(`{"root":{}}`), CreatedAt: 1, UpdatedAt: 100},
			{ID: "bad-exp", RootFEN: "bad", Tree: json.RawMessage(`{"root":{}}`), CreatedAt: 1, UpdatedAt: 100},
		},
		CourseProgress: []store.CourseProgress{
			{LessonKey: "old-lesson", PlannedAt: 1, Done: json.RawMessage(`[true,true,false]`), UpdatedAt: 100},
			{LessonKey: "new-lesson", PlannedAt: 1, Done: json.RawMessage(`[true,false,false]`), UpdatedAt: 100},
			{LessonKey: "bad-lesson", PlannedAt: 1, Done: json.RawMessage(`[true]`), UpdatedAt: 100},
		},
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/sync/push", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	res := serve(s.Router(), req)
	if res.Code != http.StatusOK {
		t.Fatalf("sync status=%d body=%s", res.Code, res.Body.String())
	}
	var got syncPushResponse
	if err := json.Unmarshal(res.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if strings.Join(got.Applied, ",") != "new-game,new-exp,new-lesson" || strings.Join(got.Conflicts, ",") != "old-game,old-exp,old-lesson" || strings.Join(got.Rejected, ",") != "bad-game,bad-exp,bad-lesson" {
		t.Fatalf("unexpected push response: %+v", got)
	}
	stored, _ := s.Store.GetGame(user.ID, "old-game")
	if stored.Title == "stale" || stored.UpdatedAt != 200 {
		t.Fatalf("stale game overwrote server row: %+v", stored)
	}
}

func TestOnlineSnapshotRoundTripKeepsParticipantIsolation(t *testing.T) {
	pos, _ := chess.ParseFEN(chess.StartFEN)
	now := time.Now().Truncate(time.Millisecond)
	original := &onlineMatch{
		ID: "match-1", Status: "active", OpponentType: "human", InitialFEN: chess.StartFEN, Position: pos,
		Moves: []string{}, Red: onlinePlayer{UserID: 11, Username: "red", Color: chess.Red},
		Black: onlinePlayer{UserID: 22, Username: "black", Color: chess.Black}, RedTimeMs: 1000, BlackTimeMs: 2000,
		IncrementMs: 500, LastTick: now, CreatedAt: now, UpdatedAt: now,
	}
	raw, _ := json.Marshal(matchSnapshot(original))
	restored, err := matchFromSnapshot(string(raw))
	if err != nil {
		t.Fatal(err)
	}
	hub := newOnlineHub()
	hub.matches[restored.ID] = restored
	if _, ok := hub.matchForUserLocked(restored.ID, 11); !ok {
		t.Fatal("red participant cannot restore match")
	}
	if _, ok := hub.matchForUserLocked(restored.ID, 22); !ok {
		t.Fatal("black participant cannot restore match")
	}
	if _, ok := hub.matchForUserLocked(restored.ID, 33); ok {
		t.Fatal("non-participant can access restored match")
	}
}

func testServerAndToken(t *testing.T) (*Server, string) {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	user, err := st.CreateUser("test-user", "test-password")
	if err != nil {
		t.Fatal(err)
	}
	token, _, err := st.CreateSession(user.ID)
	if err != nil {
		t.Fatal(err)
	}
	return &Server{Store: st}, token
}

func serve(h http.Handler, req *http.Request) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w
}
