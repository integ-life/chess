package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"unicode"

	"chess/backend/internal/store"
)

type contextKey string

const userContextKey contextKey = "user"

type authRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type authResponse struct {
	Token     string      `json:"token"`
	ExpiresAt int64       `json:"expiresAt"`
	User      *store.User `json:"user"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	if !s.registerLimiter.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "too many requests")
		return
	}
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	username, password, ok := normalizeCredentials(req.Username, req.Password, w)
	if !ok {
		return
	}
	user, err := s.Store.CreateUser(username, password)
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "username already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.writeAuthResponse(w, user)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	username := strings.ToLower(strings.TrimSpace(req.Username))
	if !s.loginLimiter.allow(username) {
		writeError(w, http.StatusTooManyRequests, "too many requests")
		return
	}
	if len(req.Password) > 128 {
		writeError(w, http.StatusUnauthorized, "invalid username or password")
		return
	}
	user, err := s.Store.AuthenticateUser(username, req.Password)
	if errors.Is(err, store.ErrInvalidCredentials) {
		writeError(w, http.StatusUnauthorized, "invalid username or password")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.writeAuthResponse(w, user)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, currentUser(r))
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	token := bearerToken(r)
	if token != "" {
		_ = s.Store.DeleteSession(token)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) writeAuthResponse(w http.ResponseWriter, user *store.User) {
	token, expiresAt, err := s.Store.CreateSession(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, authResponse{Token: token, ExpiresAt: expiresAt, User: user})
}

func normalizeCredentials(username, password string, w http.ResponseWriter) (string, string, bool) {
	username = strings.ToLower(strings.TrimSpace(username))
	if len(username) < 3 || len(username) > 32 {
		writeError(w, http.StatusBadRequest, "username must be 3-32 characters")
		return "", "", false
	}
	for _, r := range username {
		if !(unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '-') {
			writeError(w, http.StatusBadRequest, "username can only use letters, numbers, _ and -")
			return "", "", false
		}
	}
	if len(password) < 6 || len(password) > 128 {
		writeError(w, http.StatusBadRequest, "password must be 6-128 bytes")
		return "", "", false
	}
	return username, password, true
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		if token == "" {
			writeError(w, http.StatusUnauthorized, "login required")
			return
		}
		user, err := s.Store.UserBySession(token)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if user == nil {
			writeError(w, http.StatusUnauthorized, "login required")
			return
		}
		ctx := context.WithValue(r.Context(), userContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func currentUser(r *http.Request) *store.User {
	u, _ := r.Context().Value(userContextKey).(*store.User)
	return u
}

func currentUserID(r *http.Request) int64 {
	u := currentUser(r)
	if u == nil {
		return 0
	}
	return u.ID
}

func bearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
}

func isUniqueViolation(err error) bool {
	if errors.Is(err, sql.ErrNoRows) {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "unique")
}
