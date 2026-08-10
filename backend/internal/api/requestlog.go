package api

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"time"
)

type requestLogEntry struct {
	Time       string `json:"time"`
	Method     string `json:"method"`
	Path       string `json:"path"`
	Status     int    `json:"status"`
	DurationMs int64  `json:"durationMs"`
	IP         string `json:"ip"`
	UserAgent  string `json:"userAgent"`
}

type responseLogWriter struct {
	http.ResponseWriter
	status int
}

func (w *responseLogWriter) WriteHeader(status int) {
	if w.status != 0 {
		return
	}
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *responseLogWriter) Write(p []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(p)
}

func (w *responseLogWriter) Flush() {
	if w.status == 0 {
		w.status = http.StatusOK
		w.ResponseWriter.WriteHeader(http.StatusOK)
	}
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (s *Server) logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		lw := &responseLogWriter{ResponseWriter: w}
		next.ServeHTTP(lw, r)
		if lw.status == 0 {
			lw.status = http.StatusOK
		}

		entry := requestLogEntry{
			Time:       start.Format(time.RFC3339Nano),
			Method:     r.Method,
			Path:       r.URL.Path,
			Status:     lw.status,
			DurationMs: time.Since(start).Milliseconds(),
			IP:         clientIP(r),
			UserAgent:  r.UserAgent(),
		}
		if b, err := json.Marshal(entry); err == nil && s.RequestLogger != nil {
			s.RequestLogger.Println(string(b))
		}
	})
}

func clientIP(r *http.Request) string {
	if connectingIP := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); connectingIP != "" {
		return connectingIP
	}
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		return strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
