// Package store 提供 SQLite 持久化。
package store

import (
	"database/sql"
	_ "embed"
	"fmt"

	_ "modernc.org/sqlite"
)

//go:embed migrations/0001_init.sql
var migration string

type Store struct {
	DB *sql.DB
}

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // 单写者，避免 SQLITE_BUSY
	if err := migrateExistingDB(db); err != nil {
		db.Close()
		return nil, err
	}
	if _, err := db.Exec(migration); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{DB: db}, nil
}

func (s *Store) Close() error { return s.DB.Close() }

func migrateExistingDB(db *sql.DB) error {
	if err := addColumnIfMissing(db, "games", "user_id", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "games", "is_public", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "games", "tree", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	gameColumns := []struct{ name, definition string }{
		{"category", "TEXT NOT NULL DEFAULT ''"},
		{"collection", "TEXT NOT NULL DEFAULT ''"},
		{"opening", "TEXT NOT NULL DEFAULT ''"},
		{"quality_score", "INTEGER"},
		{"average_loss_cp", "INTEGER"},
		{"blunder_count", "INTEGER NOT NULL DEFAULT 0"},
		{"engine_name", "TEXT NOT NULL DEFAULT ''"},
		{"source_url", "TEXT NOT NULL DEFAULT ''"},
		{"source_version", "TEXT NOT NULL DEFAULT ''"},
		{"analyzed_at", "INTEGER NOT NULL DEFAULT 0"},
	}
	for _, column := range gameColumns {
		if err := addColumnIfMissing(db, "games", column.name, column.definition); err != nil {
			return err
		}
	}
	if err := addColumnIfMissing(db, "explorations", "user_id", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "users", "integ_auth_subject", "TEXT"); err != nil {
		return err
	}
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS online_matches (
		  id            TEXT PRIMARY KEY,
		  status        TEXT NOT NULL,
		  room_code     TEXT NOT NULL DEFAULT '',
		  red_user_id   INTEGER NOT NULL DEFAULT 0,
		  black_user_id INTEGER NOT NULL DEFAULT 0,
		  updated_at    INTEGER NOT NULL,
		  payload       TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_online_matches_red ON online_matches(red_user_id, status, updated_at);
		CREATE INDEX IF NOT EXISTS idx_online_matches_black ON online_matches(black_user_id, status, updated_at);
		CREATE INDEX IF NOT EXISTS idx_online_matches_room ON online_matches(room_code);
	`); err != nil {
		return err
	}
	return nil
}

func addColumnIfMissing(db *sql.DB, table, column, definition string) error {
	exists, err := tableExists(db, table)
	if err != nil {
		return err
	}
	if !exists {
		return nil
	}
	rows, err := db.Query("PRAGMA table_info(" + table + ")")
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, colType string
		var notNull int
		var defaultValue any
		var pk int
		if err := rows.Scan(&cid, &name, &colType, &notNull, &defaultValue, &pk); err != nil {
			return err
		}
		if name == column {
			return rows.Err()
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	_, err = db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, definition))
	return err
}

func tableExists(db *sql.DB, table string) (bool, error) {
	var name string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", table).Scan(&name)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}
