package main

import (
	"cmp"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"chess/backend/internal/api"
	"chess/backend/internal/engine"
	"chess/backend/internal/store"
	metricssdk "github.com/integ-life/integ-metrics/sdk/go"
)

var (
	version   = "dev"
	buildTime = "dev"
	commit    = "dev"
)

func main() {
	port := cmp.Or(os.Getenv("PORT"), "8080")
	engineConfig := engine.ConfigFromEnv()

	if abs, err := os.Getwd(); err == nil {
		log.Printf("server: cwd=%s", abs)
	}

	dbPath := cmp.Or(os.Getenv("DB_PATH"), "app.db")
	st, err := store.Open(dbPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer st.Close()

	requestLogPath := cmp.Or(os.Getenv("REQUEST_LOG_PATH"), "request-response.log")
	requestLogFile, err := os.OpenFile(requestLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		log.Fatalf("open request log: %v", err)
	}
	defer requestLogFile.Close()
	if err := requestLogFile.Chmod(0o600); err != nil {
		log.Fatalf("secure request log: %v", err)
	}
	requestLogger := log.New(requestLogFile, "", 0)
	log.Printf("server: request log=%s", requestLogPath)

	eng := engine.New(engineConfig)
	defer eng.Close()

	handler := (&api.Server{
		Engine: eng, Store: st, Version: version, BuildTime: buildTime, Commit: commit, RequestLogger: requestLogger,
	}).Router()
	metricsClient := newMetricsClient()
	if metricsClient != nil {
		handler = metricsClient.HTTPMiddleware(handler, chessFeature)
		defer func() {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			_ = metricsClient.Close(ctx)
		}()
	}
	srv := &http.Server{
		Addr:              ":" + port,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
		Handler:           handler,
	}

	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
		<-sig
		eng.Close()
		_ = srv.Close()
	}()

	log.Printf("server: listening on :%s, version=%s, build_time=%s, commit=%s", port, version, buildTime, commit)
	fmt.Printf("server build info: version=%s build_time=%s commit=%s\n", version, buildTime, commit)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func newMetricsClient() *metricssdk.Client {
	endpoint, key := os.Getenv("INTEG_METRICS_ENDPOINT"), os.Getenv("INTEG_METRICS_SERVER_WRITE_KEY")
	if endpoint == "" || key == "" {
		return nil
	}
	environment := cmp.Or(os.Getenv("INTEG_METRICS_ENVIRONMENT"), "production")
	release := cmp.Or(os.Getenv("INTEG_METRICS_RELEASE"), version)
	client, err := metricssdk.New(metricssdk.Config{Endpoint: endpoint, WriteKey: key, Environment: environment, Release: release, Service: "chess-backend"})
	if err != nil {
		log.Printf("metrics disabled: %v", err)
		return nil
	}
	log.Printf("Integ Metrics enabled for chess-backend")
	return client
}

func chessFeature(r *http.Request, status int) string {
	if status >= 500 || r.Method == http.MethodGet {
		return ""
	}
	switch {
	case strings.Contains(r.URL.Path, "/move") || strings.Contains(r.URL.Path, "/engine/"):
		return "game.move"
	case strings.Contains(r.URL.Path, "/online/rooms") || r.URL.Path == "/api/online/match":
		return "game.start"
	case strings.Contains(r.URL.Path, "/resign") || (r.Method == http.MethodPut && strings.Contains(r.URL.Path, "/games/")):
		return "game.complete"
	case r.URL.Path == "/api/sync/push":
		return "sync.push"
	}
	return ""
}
