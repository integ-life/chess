// Package api 提供 HTTP 接口层。
package api

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"chess/backend/internal/engine"
	"chess/backend/internal/store"
)

type Server struct {
	Engine        *engine.Engine
	Store         *store.Store
	Online        *onlineHub
	Version       string
	BuildTime     string
	Commit        string
	RequestLogger interface {
		Println(v ...any)
	}
	loginLimiter         *fixedWindowLimiter
	registerLimiter      *fixedWindowLimiter
	engineMoveLimiter    *fixedWindowLimiter
	engineAnalyzeLimiter *fixedWindowLimiter
}

func (s *Server) Router() http.Handler {
	if s.loginLimiter == nil {
		s.loginLimiter = newFixedWindowLimiter(10, 5*time.Minute)
	}
	if s.registerLimiter == nil {
		s.registerLimiter = newFixedWindowLimiter(5, time.Hour)
	}
	if s.engineMoveLimiter == nil {
		s.engineMoveLimiter = newFixedWindowLimiter(30, time.Minute)
	}
	if s.engineAnalyzeLimiter == nil {
		s.engineAnalyzeLimiter = newFixedWindowLimiter(6, time.Minute)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/version", func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, http.StatusOK, currentBuildVersion("integ-life/chess", "chess-api")) })
	mux.HandleFunc("POST /api/auth/register", s.handleRegister)
	mux.HandleFunc("POST /api/auth/login", s.handleLogin)
	mux.HandleFunc("GET /api/auth/integ/start", s.handleIntegAuthStart)
	mux.HandleFunc("GET /api/auth/integ/callback", s.handleIntegAuthCallback)
	mux.Handle("POST /api/engine/move", s.requireAuth(http.HandlerFunc(s.handleEngineMove)))
	mux.Handle("GET /api/engine/analyze", s.requireAuth(http.HandlerFunc(s.handleAnalyze)))
	mux.Handle("GET /api/auth/me", s.requireAuth(http.HandlerFunc(s.handleMe)))
	mux.Handle("POST /api/auth/logout", s.requireAuth(http.HandlerFunc(s.handleLogout)))
	mux.Handle("POST /api/online/rooms", s.requireAuth(http.HandlerFunc(s.handleCreateOnlineRoom)))
	mux.Handle("POST /api/online/rooms/{code}/join", s.requireAuth(http.HandlerFunc(s.handleJoinOnlineRoom)))
	mux.Handle("POST /api/online/match", s.requireAuth(http.HandlerFunc(s.handleStartOnlineMatch)))
	mux.Handle("POST /api/online/resume", s.requireAuth(http.HandlerFunc(s.handleResumeOnlineMatch)))
	mux.Handle("GET /api/online/matches/{id}", s.requireAuth(http.HandlerFunc(s.handleGetOnlineMatch)))
	mux.Handle("POST /api/online/matches/{id}/cancel", s.requireAuth(http.HandlerFunc(s.handleCancelOnlineMatch)))
	mux.Handle("POST /api/online/matches/{id}/move", s.requireAuth(http.HandlerFunc(s.handleOnlineMove)))
	mux.Handle("POST /api/online/matches/{id}/resign", s.requireAuth(http.HandlerFunc(s.handleOnlineResign)))
	mux.Handle("GET /api/games", s.requireAuth(http.HandlerFunc(s.handleListGames)))
	mux.Handle("GET /api/games/public", s.requireAuth(http.HandlerFunc(s.handleListPublicGames)))
	mux.Handle("GET /api/games/{id}", s.requireAuth(http.HandlerFunc(s.handleGetGame)))
	mux.Handle("PUT /api/games/{id}", s.requireAuth(http.HandlerFunc(s.handlePutGame)))
	mux.Handle("DELETE /api/games/{id}", s.requireAuth(http.HandlerFunc(s.handleDeleteGame)))
	mux.Handle("GET /api/explorations", s.requireAuth(http.HandlerFunc(s.handleListExplorations)))
	mux.Handle("GET /api/explorations/{id}", s.requireAuth(http.HandlerFunc(s.handleGetExploration)))
	mux.Handle("PUT /api/explorations/{id}", s.requireAuth(http.HandlerFunc(s.handlePutExploration)))
	mux.Handle("DELETE /api/explorations/{id}", s.requireAuth(http.HandlerFunc(s.handleDeleteExploration)))
	mux.Handle("POST /api/sync/push", s.requireAuth(http.HandlerFunc(s.handleSyncPush)))
	mux.Handle("GET /api/sync/pull", s.requireAuth(http.HandlerFunc(s.handleSyncPull)))
	return s.logMiddleware(corsMiddleware(bodyLimitMiddleware(mux)))
}

const maxRequestBodyBytes = 1 << 20

func bodyLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.ContentLength > maxRequestBodyBytes {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
		next.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	allowedRaw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if allowedRaw == "" {
		allowedRaw = "*"
	}
	allowed := strings.Split(allowedRaw, ",")
	for i := range allowed {
		allowed[i] = strings.TrimSpace(allowed[i])
	}
	if len(allowed) == 0 {
		allowed = []string{"*"}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowOrigin := chooseAllowOrigin(origin, allowed)
		if allowOrigin != "" {
			w.Header().Set("Access-Control-Allow-Origin", allowOrigin)
			w.Header().Set("Vary", "Origin")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		requestHeaders := r.Header.Get("Access-Control-Request-Headers")
		if requestHeaders == "" {
			requestHeaders = "Content-Type"
		}
		w.Header().Set("Access-Control-Allow-Headers", requestHeaders)
		w.Header().Set("Access-Control-Max-Age", "600")

		if r.Method == http.MethodOptions {
			if origin != "" && allowOrigin == "" {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func allowedOrigin(origin string, allowed []string) bool {
	origin = normalizeOrigin(origin)
	if origin == "" {
		return false
	}
	for _, v := range allowed {
		v = normalizeOrigin(v)
		if v == "*" {
			return true
		}
		if origin == v {
			return true
		}
		if strings.HasPrefix(v, "*.") && strings.HasSuffix(origin, strings.TrimPrefix(v, "*.")) {
			return true
		}
	}
	return false
}

func chooseAllowOrigin(origin string, allowed []string) string {
	normOrigin := normalizeOrigin(origin)
	if normOrigin == "" {
		return ""
	}
	for _, v := range allowed {
		v = normalizeOrigin(v)
		if v == "*" {
			return "*"
		}
		if v == normOrigin {
			return normOrigin
		}
		if strings.HasPrefix(v, "*.") && strings.HasSuffix(normOrigin, strings.TrimPrefix(v, "*.")) {
			return normOrigin
		}
	}
	return ""
}

func normalizeOrigin(origin string) string {
	if origin == "" {
		return ""
	}
	return strings.TrimSuffix(strings.TrimSpace(origin), "/")
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"version":   s.Version,
		"buildTime": s.BuildTime,
		"commit":    s.Commit,
		"engine":    s.Engine.Config(),
	})
}
