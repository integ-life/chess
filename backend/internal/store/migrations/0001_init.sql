CREATE TABLE IF NOT EXISTS games (
  id           TEXT PRIMARY KEY,              -- 客户端 UUID
  user_id      INTEGER NOT NULL DEFAULT 0,
  title        TEXT NOT NULL DEFAULT '',
  red_player   TEXT NOT NULL DEFAULT '',
  black_player TEXT NOT NULL DEFAULT '',
  result       TEXT NOT NULL DEFAULT '*',     -- '1-0' | '0-1' | '1/2-1/2' | '*'
  initial_fen  TEXT NOT NULL,
  moves        TEXT NOT NULL DEFAULT '[]',    -- ICCS 字符串 JSON 数组
  tree         TEXT NOT NULL DEFAULT '',      -- VariationTree JSON；moves 是主线摘要
  source       TEXT NOT NULL DEFAULT 'play',  -- 'play' | 'manual'
  is_public    INTEGER NOT NULL DEFAULT 0,
  category     TEXT NOT NULL DEFAULT '',
  collection   TEXT NOT NULL DEFAULT '',
  opening      TEXT NOT NULL DEFAULT '',
  quality_score INTEGER,
  average_loss_cp INTEGER,
  blunder_count INTEGER NOT NULL DEFAULT 0,
  engine_name  TEXT NOT NULL DEFAULT '',
  source_url   TEXT NOT NULL DEFAULT '',
  source_version TEXT NOT NULL DEFAULT '',
  analyzed_at  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,              -- unix ms
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS explorations (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL DEFAULT 0,
  title      TEXT NOT NULL DEFAULT '',
  root_fen   TEXT NOT NULL,
  game_id    TEXT,
  tree       TEXT NOT NULL,                   -- 整棵变着树 JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_games_updated ON games(updated_at);
CREATE INDEX IF NOT EXISTS idx_explorations_updated ON explorations(updated_at);

CREATE TABLE IF NOT EXISTS users (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  username           TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  integ_auth_subject TEXT,
  created_at         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_games_user_updated ON games(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_games_public_updated ON games(is_public, updated_at);
CREATE INDEX IF NOT EXISTS idx_games_public_quality ON games(is_public, category, quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_explorations_user_updated ON explorations(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS course_progress (
  user_id     INTEGER NOT NULL,
  lesson_key TEXT NOT NULL,
  planned_at INTEGER NOT NULL,
  done        TEXT NOT NULL DEFAULT '[false,false,false]',
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, lesson_key)
);

CREATE INDEX IF NOT EXISTS idx_course_progress_user_updated ON course_progress(user_id, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_integ_auth_subject ON users(integ_auth_subject);

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
