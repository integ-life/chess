package qipu

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"chess/backend/internal/engine"
	"chess/backend/internal/chess"

	_ "modernc.org/sqlite"
)

type Dataset struct{ DB *sql.DB }

type Source struct {
	ID        string
	Name      string
	URL       string
	Format    string
	LocalPath string
	Revision  string
}

type Stats struct {
	Sources     int `json:"sources"`
	Games       int `json:"games"`
	Provenances int `json:"provenances"`
	Positions   int `json:"positions"`
	Edges       int `json:"edges"`
	GameEdges   int `json:"gameEdges"`
	Analyzed    int `json:"analyzed"`
}

func OpenDataset(path string) (*Dataset, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(datasetSchema); err != nil {
		db.Close()
		return nil, err
	}
	return &Dataset{DB: db}, nil
}

func (d *Dataset) Close() error { return d.DB.Close() }

func (d *Dataset) UpsertSource(source Source) error {
	_, err := d.DB.Exec(`
		INSERT INTO qipu_sources (id, name, url, format, local_path, revision, last_pulled_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET name=excluded.name, url=excluded.url, format=excluded.format,
			local_path=excluded.local_path, revision=excluded.revision, last_pulled_at=excluded.last_pulled_at`,
		source.ID, source.Name, source.URL, source.Format, source.LocalPath, source.Revision, time.Now().UnixMilli())
	return err
}

func (d *Dataset) SourceRecordCurrent(sourceID, sourceKey, version string) (bool, error) {
	var found int
	err := d.DB.QueryRow(`SELECT 1 FROM qipu_game_sources WHERE source_id=? AND source_key=? AND source_version=?`,
		sourceID, sourceKey, version).Scan(&found)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

func (d *Dataset) Ingest(record Record) error {
	positions, err := replay(record)
	if err != nil {
		return err
	}
	metadata, _ := json.Marshal(record.Metadata)
	now := time.Now().UnixMilli()
	tx, err := d.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var gameExists bool
	var existing int
	if err := tx.QueryRow(`SELECT 1 FROM qipu_games WHERE id=?`, record.ID).Scan(&existing); err == nil {
		gameExists = true
	} else if err != sql.ErrNoRows {
		return err
	}
	_, err = tx.Exec(`
		INSERT INTO qipu_games (id, title, event, site, played_at, round, red_player, black_player,
			red_team, black_team, result, opening, category, collection, initial_fen, imported_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			title=CASE WHEN qipu_games.title IN ('', '-') THEN excluded.title ELSE qipu_games.title END,
			event=CASE WHEN qipu_games.event IN ('', '-') THEN excluded.event ELSE qipu_games.event END,
			site=CASE WHEN qipu_games.site IN ('', '-') THEN excluded.site ELSE qipu_games.site END,
			played_at=CASE WHEN qipu_games.played_at IN ('', '-') THEN excluded.played_at ELSE qipu_games.played_at END,
			round=CASE WHEN qipu_games.round IN ('', '-') THEN excluded.round ELSE qipu_games.round END,
			red_player=CASE WHEN qipu_games.red_player IN ('', '-') THEN excluded.red_player ELSE qipu_games.red_player END,
			black_player=CASE WHEN qipu_games.black_player IN ('', '-') THEN excluded.black_player ELSE qipu_games.black_player END,
			red_team=CASE WHEN qipu_games.red_team IN ('', '-') THEN excluded.red_team ELSE qipu_games.red_team END,
			black_team=CASE WHEN qipu_games.black_team IN ('', '-') THEN excluded.black_team ELSE qipu_games.black_team END,
			opening=CASE WHEN qipu_games.opening IN ('', '-') THEN excluded.opening ELSE qipu_games.opening END`,
		record.ID, record.Title, record.Event, record.Site, record.Date, record.Round,
		record.RedPlayer, record.BlackPlayer, record.RedTeam, record.BlackTeam, record.Result,
		record.Opening, record.Category, record.Collection, record.InitialFEN, now)
	if err != nil {
		return err
	}
	_, err = tx.Exec(`
		INSERT INTO qipu_game_sources (source_id, source_key, game_id, source_url, source_version, metadata, imported_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(source_id, source_key) DO UPDATE SET game_id=excluded.game_id,
			source_url=excluded.source_url, source_version=excluded.source_version,
			metadata=excluded.metadata, imported_at=excluded.imported_at`,
		record.SourceID, record.SourceKey, record.ID, record.SourceURL, record.SourceVersion, metadata, now)
	if err != nil {
		return err
	}
	if !gameExists {
		for i, move := range record.Moves {
			fromID, err := positionID(tx, positions[i].FEN())
			if err != nil {
				return err
			}
			toID, err := positionID(tx, positions[i+1].FEN())
			if err != nil {
				return err
			}
			edgeID, err := edgeID(tx, fromID, move, toID)
			if err != nil {
				return err
			}
			if _, err := tx.Exec(`INSERT INTO qipu_game_edges (game_id, ply, edge_id) VALUES (?, ?, ?)`, record.ID, i+1, edgeID); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}

func positionID(tx *sql.Tx, fen string) (int64, error) {
	if _, err := tx.Exec(`INSERT OR IGNORE INTO qipu_positions (fen) VALUES (?)`, fen); err != nil {
		return 0, err
	}
	var id int64
	err := tx.QueryRow(`SELECT id FROM qipu_positions WHERE fen=?`, fen).Scan(&id)
	return id, err
}

func edgeID(tx *sql.Tx, fromID int64, move string, toID int64) (int64, error) {
	if _, err := tx.Exec(`INSERT OR IGNORE INTO qipu_edges (from_position_id, move, to_position_id) VALUES (?, ?, ?)`, fromID, move, toID); err != nil {
		return 0, err
	}
	var id int64
	err := tx.QueryRow(`SELECT id FROM qipu_edges WHERE from_position_id=? AND move=? AND to_position_id=?`, fromID, move, toID).Scan(&id)
	return id, err
}

func replay(record Record) ([]*chess.Position, error) {
	pos, err := chess.ParseFEN(record.InitialFEN)
	if err != nil {
		return nil, err
	}
	positions := make([]*chess.Position, 1, len(record.Moves)+1)
	positions[0] = pos
	for _, iccs := range record.Moves {
		move, err := chess.MoveFromICCS(iccs)
		if err != nil || !pos.IsLegal(move) {
			return nil, fmt.Errorf("illegal move %s", iccs)
		}
		next := *pos
		next.Apply(move)
		pos = &next
		positions = append(positions, pos)
	}
	return positions, nil
}

func (d *Dataset) NextUnanalyzedGame() (Record, bool, error) {
	var record Record
	err := d.DB.QueryRow(`
		SELECT id, title, event, site, played_at, round, red_player, black_player, red_team, black_team,
			result, opening, category, collection, initial_fen
		FROM qipu_games WHERE analyzed_at=0 ORDER BY imported_at, id LIMIT 1`).Scan(
		&record.ID, &record.Title, &record.Event, &record.Site, &record.Date, &record.Round,
		&record.RedPlayer, &record.BlackPlayer, &record.RedTeam, &record.BlackTeam, &record.Result,
		&record.Opening, &record.Category, &record.Collection, &record.InitialFEN)
	if err == sql.ErrNoRows {
		return Record{}, false, nil
	}
	if err != nil {
		return Record{}, false, err
	}
	rows, err := d.DB.Query(`
		SELECT e.move FROM qipu_game_edges ge JOIN qipu_edges e ON e.id=ge.edge_id
		WHERE ge.game_id=? ORDER BY ge.ply`, record.ID)
	if err != nil {
		return Record{}, false, err
	}
	defer rows.Close()
	for rows.Next() {
		var move string
		if err := rows.Scan(&move); err != nil {
			return Record{}, false, err
		}
		record.Moves = append(record.Moves, move)
	}
	return record, true, rows.Err()
}

func (d *Dataset) PositionEvaluation(fen, engineName string, depth int) (engine.Evaluation, bool, error) {
	var result engine.Evaluation
	var storedEngine string
	var storedDepth, analyzedAt int
	err := d.DB.QueryRow(`SELECT score_cp, score_mate, best_move, engine_name, analysis_depth, analyzed_at FROM qipu_positions WHERE fen=?`, fen).
		Scan(&result.ScoreCP, &result.Mate, &result.BestMove, &storedEngine, &storedDepth, &analyzedAt)
	if err != nil {
		return result, false, err
	}
	return result, analyzedAt > 0 && storedEngine == engineName && storedDepth >= depth, nil
}

func (d *Dataset) SavePositionEvaluation(fen, engineName string, depth int, result engine.Evaluation) error {
	_, err := d.DB.Exec(`UPDATE qipu_positions SET score_cp=?, score_mate=?, best_move=?, engine_name=?, analysis_depth=?, analyzed_at=? WHERE fen=?`,
		result.ScoreCP, result.Mate, result.BestMove, engineName, depth, time.Now().UnixMilli(), fen)
	return err
}

func (d *Dataset) SaveGameAnalysis(id, engineName string, depth int, result Analysis) error {
	_, err := d.DB.Exec(`UPDATE qipu_games SET quality_score=?, average_loss_cp=?, blunder_count=?, engine_name=?, analysis_depth=?, analyzed_at=? WHERE id=?`,
		result.QualityScore, result.AverageLossCP, result.BlunderCount, engineName, depth, time.Now().UnixMilli(), id)
	return err
}

func (d *Dataset) Stats() (Stats, error) {
	var stats Stats
	queries := []struct {
		query string
		value *int
	}{
		{`SELECT COUNT(*) FROM qipu_sources`, &stats.Sources},
		{`SELECT COUNT(*) FROM qipu_games`, &stats.Games},
		{`SELECT COUNT(*) FROM qipu_game_sources`, &stats.Provenances},
		{`SELECT COUNT(*) FROM qipu_positions`, &stats.Positions},
		{`SELECT COUNT(*) FROM qipu_edges`, &stats.Edges},
		{`SELECT COUNT(*) FROM qipu_game_edges`, &stats.GameEdges},
		{`SELECT COUNT(*) FROM qipu_games WHERE analyzed_at>0`, &stats.Analyzed},
	}
	for _, item := range queries {
		if err := d.DB.QueryRow(item.query).Scan(item.value); err != nil {
			return stats, err
		}
	}
	return stats, nil
}

const datasetSchema = `
CREATE TABLE IF NOT EXISTS qipu_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  format TEXT NOT NULL,
  local_path TEXT NOT NULL,
  revision TEXT NOT NULL DEFAULT '',
  last_pulled_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS qipu_games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '', event TEXT NOT NULL DEFAULT '', site TEXT NOT NULL DEFAULT '',
  played_at TEXT NOT NULL DEFAULT '', round TEXT NOT NULL DEFAULT '',
  red_player TEXT NOT NULL DEFAULT '', black_player TEXT NOT NULL DEFAULT '',
  red_team TEXT NOT NULL DEFAULT '', black_team TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '*', opening TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '', collection TEXT NOT NULL DEFAULT '',
  initial_fen TEXT NOT NULL,
  quality_score INTEGER, average_loss_cp INTEGER, blunder_count INTEGER NOT NULL DEFAULT 0,
  engine_name TEXT NOT NULL DEFAULT '', analysis_depth INTEGER NOT NULL DEFAULT 0,
  analyzed_at INTEGER NOT NULL DEFAULT 0, imported_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS qipu_game_sources (
  source_id TEXT NOT NULL REFERENCES qipu_sources(id),
  source_key TEXT NOT NULL,
  game_id TEXT NOT NULL REFERENCES qipu_games(id),
  source_url TEXT NOT NULL DEFAULT '', source_version TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}', imported_at INTEGER NOT NULL,
  PRIMARY KEY (source_id, source_key)
);
CREATE INDEX IF NOT EXISTS idx_qipu_game_sources_game ON qipu_game_sources(game_id);
CREATE TABLE IF NOT EXISTS qipu_positions (
  id INTEGER PRIMARY KEY,
  fen TEXT NOT NULL UNIQUE,
  score_cp INTEGER NOT NULL DEFAULT 0, score_mate INTEGER NOT NULL DEFAULT 0,
  best_move TEXT NOT NULL DEFAULT '', engine_name TEXT NOT NULL DEFAULT '',
  analysis_depth INTEGER NOT NULL DEFAULT 0, analyzed_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS qipu_edges (
  id INTEGER PRIMARY KEY,
  from_position_id INTEGER NOT NULL REFERENCES qipu_positions(id),
  move TEXT NOT NULL,
  to_position_id INTEGER NOT NULL REFERENCES qipu_positions(id),
  UNIQUE (from_position_id, move, to_position_id)
);
CREATE INDEX IF NOT EXISTS idx_qipu_edges_from ON qipu_edges(from_position_id);
CREATE TABLE IF NOT EXISTS qipu_game_edges (
  game_id TEXT NOT NULL REFERENCES qipu_games(id),
  ply INTEGER NOT NULL,
  edge_id INTEGER NOT NULL REFERENCES qipu_edges(id),
  PRIMARY KEY (game_id, ply)
);
CREATE INDEX IF NOT EXISTS idx_qipu_game_edges_edge ON qipu_game_edges(edge_id);
`
