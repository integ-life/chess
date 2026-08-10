package main

import (
	"bytes"
	"cmp"
	"context"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"chess/backend/internal/engine"
	"chess/backend/internal/qipu"
)

const (
	communityRepo = "https://github.com/chasoft/community-xiangqi-games-database.git"
	wxfURL        = "https://drive.usercontent.google.com/download?id=1XYJ2mdUj23ARZ7JJd3C0UyW4KZW5aoZP&export=download&confirm=t"
	dpxqURL       = "https://drive.usercontent.google.com/download?id=1iEz5tsv7Yg6SnXznKgheHabyx_TSqFRS&export=download&confirm=t"
)

func main() {
	once := flag.Bool("once", false, "pull, import and analyze until caught up")
	limit := flag.Int("limit", envInt("QIPU_LIMIT", 0), "maximum games per import/analysis pass; 0 means all")
	flag.Parse()

	sourcesDir := cmp.Or(os.Getenv("QIPU_SOURCES_DIR"), "qipu-sources")
	dbPath := cmp.Or(os.Getenv("DB_PATH"), "qipu-dataset.db")
	depth := envInt("QIPU_ANALYSIS_DEPTH", 8)
	samples := envInt("QIPU_ANALYSIS_SAMPLES", 5)
	interval := envDuration("QIPU_SYNC_INTERVAL", 6*time.Hour)
	if os.Getenv("XIANGQI_ENGINE") == "" {
		_ = os.Setenv("XIANGQI_ENGINE", "pikafish")
	}

	dataset, err := qipu.OpenDataset(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer dataset.Close()
	eng := engine.New(engine.ConfigFromEnv())
	defer eng.Close()

	for {
		ctx := context.Background()
		if err := run(ctx, dataset, eng, sourcesDir, depth, samples, *limit); err != nil {
			log.Printf("qipu: run failed: %v", err)
		}
		if *once {
			return
		}
		time.Sleep(interval)
	}
}

func run(ctx context.Context, dataset *qipu.Dataset, eng *engine.Engine, sourcesDir string, depth, samples, limit int) error {
	sources, err := syncSources(ctx, sourcesDir)
	if err != nil {
		return err
	}
	for _, source := range sources {
		if err := dataset.UpsertSource(source); err != nil {
			return err
		}
	}
	remaining := limit
	for _, source := range sources {
		count, err := importSource(ctx, dataset, source, remaining)
		if err != nil {
			return err
		}
		if remaining > 0 {
			remaining -= count
			if remaining <= 0 {
				break
			}
		}
	}
	stats, err := dataset.Stats()
	if err != nil {
		return err
	}
	log.Printf("qipu: graph ready sources=%d games=%d provenances=%d positions=%d edges=%d", stats.Sources, stats.Games, stats.Provenances, stats.Positions, stats.Edges)
	return analyzeGames(ctx, dataset, eng, depth, samples, limit)
}

func syncSources(ctx context.Context, root string) ([]qipu.Source, error) {
	communityDir := filepath.Join(root, "community-xiangqi-games-database")
	if err := syncGit(ctx, communityRepo, communityDir); err != nil {
		return nil, err
	}
	revision, err := commandOutput(ctx, "git", "-C", communityDir, "rev-parse", "HEAD")
	if err != nil {
		return nil, err
	}
	cglemonDir := filepath.Join(root, "cglemon")
	if err := os.MkdirAll(cglemonDir, 0o755); err != nil {
		return nil, err
	}
	wxfPath := filepath.Join(cglemonDir, "WXF-41743games.pgns")
	dpxqPath := filepath.Join(cglemonDir, "dpxq-99813games.pgns")
	if err := download(ctx, wxfURL, wxfPath); err != nil {
		return nil, err
	}
	if err := download(ctx, dpxqURL, dpxqPath); err != nil {
		return nil, err
	}
	return []qipu.Source{
		{ID: "chasoft-community", Name: "Vietcotuong Community Database", URL: communityRepo, Format: "DhtmlXQ", LocalPath: filepath.Join(communityDir, "data"), Revision: strings.TrimSpace(revision)},
		{ID: "cglemon-wxf", Name: "World Xiangqi Federation 41743", URL: "https://github.com/CGLemon/chess-PGN", Format: "ICCS PGN", LocalPath: wxfPath, Revision: fileRevision(wxfPath)},
		{ID: "cglemon-dpxq", Name: "Dongping Xiangqi 99813", URL: "https://github.com/CGLemon/chess-PGN", Format: "ICCS PGN", LocalPath: dpxqPath, Revision: fileRevision(dpxqPath)},
	}, nil
}

func syncGit(ctx context.Context, repoURL, repoDir string) error {
	var cmd *exec.Cmd
	cloning := false
	if _, err := os.Stat(filepath.Join(repoDir, ".git")); err == nil {
		cmd = exec.CommandContext(ctx, "git", "-C", repoDir, "pull", "--ff-only")
	} else {
		if err := os.MkdirAll(filepath.Dir(repoDir), 0o755); err != nil {
			return err
		}
		cloning = true
		cmd = exec.CommandContext(ctx, "git", "clone", "--depth=1", "--filter=blob:none", "--sparse", repoURL, repoDir)
	}
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	if err := cmd.Run(); err != nil {
		return err
	}
	if cloning {
		cmd = exec.CommandContext(ctx, "git", "-C", repoDir, "sparse-checkout", "set", "data")
		cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
		return cmd.Run()
	}
	return nil
}

func download(ctx context.Context, url, path string) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodHead, url, nil)
	res, err := http.DefaultClient.Do(req)
	if err == nil {
		_ = res.Body.Close()
		if info, statErr := os.Stat(path); statErr == nil && res.StatusCode == http.StatusOK && res.ContentLength == info.Size() {
			return nil
		}
	}
	log.Printf("qipu: downloading %s", filepath.Base(path))
	req, _ = http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	res, err = http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("download %s: %s", path, res.Status)
	}
	tmp := path + ".part"
	file, err := os.Create(tmp)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(file, res.Body)
	closeErr := file.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(tmp, path)
}

func importSource(ctx context.Context, dataset *qipu.Dataset, source qipu.Source, limit int) (int, error) {
	if source.Format == "DhtmlXQ" {
		return importDhtml(ctx, dataset, source, limit)
	}
	file, err := os.Open(source.LocalPath)
	if err != nil {
		return 0, err
	}
	defer file.Close()
	count := 0
	err = qipu.ParsePGN(file, source.ID, source.URL, filepath.Base(source.LocalPath), func(record qipu.Record) error {
		if limit > 0 && count >= limit {
			return fs.SkipAll
		}
		current, err := dataset.SourceRecordCurrent(record.SourceID, record.SourceKey, record.SourceVersion)
		if err != nil || current {
			return err
		}
		if err := dataset.Ingest(record); err != nil {
			return err
		}
		count++
		if count%1000 == 0 {
			log.Printf("qipu: imported %s %d", source.ID, count)
		}
		return nil
	}, func(err error) { log.Printf("qipu: skip %s: %v", source.ID, err) })
	if err == fs.SkipAll {
		err = nil
	}
	return count, err
}

func importDhtml(ctx context.Context, dataset *qipu.Dataset, source qipu.Source, limit int) (int, error) {
	count := 0
	err := filepath.WalkDir(source.LocalPath, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if ext == ".json" || ext == ".md" || ext == ".png" || ext == ".jpg" || ext == ".jpeg" {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil || !bytes.Contains(data, []byte("[DhtmlXQ_movelist]")) {
			return err
		}
		rel, _ := filepath.Rel(source.LocalPath, path)
		record, err := qipu.ParseDhtmlXQ(rel, data)
		if err != nil {
			log.Printf("qipu: skip %s: %v", rel, err)
			return nil
		}
		current, err := dataset.SourceRecordCurrent(record.SourceID, record.SourceKey, record.SourceVersion)
		if err != nil || current {
			return err
		}
		if err := dataset.Ingest(record); err != nil {
			return err
		}
		count++
		if count%1000 == 0 {
			log.Printf("qipu: imported %s %d", source.ID, count)
		}
		if limit > 0 && count >= limit {
			return fs.SkipAll
		}
		return nil
	})
	if err == fs.SkipAll {
		err = nil
	}
	return count, err
}

func analyzeGames(ctx context.Context, dataset *qipu.Dataset, eng *engine.Engine, depth, samples, limit int) error {
	analyzed := 0
	for limit == 0 || analyzed < limit {
		record, ok, err := dataset.NextUnanalyzedGame()
		if err != nil || !ok {
			return err
		}
		result, err := qipu.AnalyzeGame(ctx, eng, dataset, record, depth, samples)
		if err != nil {
			return err
		}
		if err := dataset.SaveGameAnalysis(record.ID, eng.Config().Name, depth, result); err != nil {
			return err
		}
		analyzed++
		if analyzed%100 == 0 {
			log.Printf("qipu: analyzed %d games", analyzed)
		}
	}
	return nil
}

func commandOutput(ctx context.Context, name string, args ...string) (string, error) {
	out, err := exec.CommandContext(ctx, name, args...).Output()
	return string(out), err
}

func fileRevision(path string) string {
	info, err := os.Stat(path)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%d:%d", info.Size(), info.ModTime().Unix())
}

func envInt(name string, fallback int) int {
	if value, err := strconv.Atoi(os.Getenv(name)); err == nil && value >= 0 {
		return value
	}
	return fallback
}

func envDuration(name string, fallback time.Duration) time.Duration {
	if value, err := time.ParseDuration(os.Getenv(name)); err == nil && value > 0 {
		return value
	}
	return fallback
}

func init() {
	log.SetFlags(log.LstdFlags | log.LUTC)
	flag.Usage = func() {
		fmt.Fprintln(flag.CommandLine.Output(), "Build a local, state-deduplicated Xiangqi dataset.")
	}
}
