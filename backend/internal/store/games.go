package store

import (
	"database/sql"
	"encoding/json"
	"strings"
)

type Game struct {
	ID            string          `json:"id"`
	UserID        int64           `json:"-"`
	Title         string          `json:"title"`
	RedPlayer     string          `json:"redPlayer"`
	BlackPlayer   string          `json:"blackPlayer"`
	Result        string          `json:"result"`
	InitialFEN    string          `json:"initialFen"`
	Moves         json.RawMessage `json:"moves"` // ICCS 字符串数组
	Tree          json.RawMessage `json:"tree,omitempty"`
	Source        string          `json:"source"` // 'play' | 'manual' | 'online'
	IsPublic      bool            `json:"isPublic"`
	Category      string          `json:"category,omitempty"`
	Collection    string          `json:"collection,omitempty"`
	Opening       string          `json:"opening,omitempty"`
	QualityScore  *int            `json:"qualityScore,omitempty"`
	AverageLossCP *int            `json:"averageLossCp,omitempty"`
	BlunderCount  int             `json:"blunderCount,omitempty"`
	EngineName    string          `json:"engineName,omitempty"`
	SourceURL     string          `json:"sourceUrl,omitempty"`
	SourceVersion string          `json:"-"`
	AnalyzedAt    int64           `json:"analyzedAt,omitempty"`
	CreatedAt     int64           `json:"createdAt"`
	UpdatedAt     int64           `json:"updatedAt"`
	Deleted       bool            `json:"deleted"`
}

const gameCols = "id, user_id, title, red_player, black_player, result, initial_fen, moves, tree, source, is_public, category, collection, opening, quality_score, average_loss_cp, blunder_count, engine_name, source_url, source_version, analyzed_at, created_at, updated_at, deleted"

func normalizeGame(g *Game) {
	if len(g.Moves) == 0 || string(g.Moves) == "null" {
		g.Moves = json.RawMessage("[]")
	}
}

type rowScanner interface{ Scan(...any) error }

func scanGame(row rowScanner) (Game, error) {
	var g Game
	var moves, tree string
	err := row.Scan(&g.ID, &g.UserID, &g.Title, &g.RedPlayer, &g.BlackPlayer, &g.Result,
		&g.InitialFEN, &moves, &tree, &g.Source, &g.IsPublic, &g.Category, &g.Collection,
		&g.Opening, &g.QualityScore, &g.AverageLossCP, &g.BlunderCount, &g.EngineName,
		&g.SourceURL, &g.SourceVersion, &g.AnalyzedAt, &g.CreatedAt, &g.UpdatedAt, &g.Deleted)
	if err != nil {
		return g, err
	}
	g.Moves = json.RawMessage(moves)
	if tree != "" {
		g.Tree = json.RawMessage(tree)
	}
	normalizeGame(&g)
	return g, nil
}

func (s *Store) ListGames(userID int64) ([]Game, error) {
	rows, err := s.DB.Query("SELECT "+gameCols+" FROM games WHERE user_id = ? AND deleted = 0 ORDER BY updated_at DESC", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	games := []Game{}
	for rows.Next() {
		g, err := scanGame(rows)
		if err != nil {
			return nil, err
		}
		games = append(games, g)
	}
	return games, rows.Err()
}

type PublicGameFilter struct {
	Category string
	Search   string
	Sort     string
}

func (s *Store) ListPublicGames(filter PublicGameFilter) ([]Game, error) {
	query := "SELECT " + gameCols + " FROM games WHERE is_public = 1 AND deleted = 0"
	args := []any{}
	if filter.Category != "" {
		query += " AND category = ?"
		args = append(args, filter.Category)
	}
	if search := strings.TrimSpace(filter.Search); search != "" {
		query += " AND (title LIKE ? OR red_player LIKE ? OR black_player LIKE ? OR opening LIKE ? OR collection LIKE ?)"
		like := "%" + search + "%"
		args = append(args, like, like, like, like, like)
	}
	if filter.Sort == "newest" {
		query += " ORDER BY updated_at DESC"
	} else {
		query += " ORDER BY quality_score IS NULL, quality_score DESC, analyzed_at DESC, updated_at DESC"
	}
	rows, err := s.DB.Query(query+" LIMIT 100", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	games := []Game{}
	for rows.Next() {
		g, err := scanGame(rows)
		if err != nil {
			return nil, err
		}
		games = append(games, g)
	}
	return games, rows.Err()
}

func (s *Store) GetGame(userID int64, id string) (*Game, error) {
	g, err := scanGame(s.DB.QueryRow("SELECT "+gameCols+" FROM games WHERE id = ? AND deleted = 0 AND (user_id = ? OR is_public = 1)", id, userID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &g, nil
}

// ListGamesSince 返回 updated_at > since 的所有行（含墓碑），用于同步下行
func (s *Store) ListGamesSince(userID int64, since int64) ([]Game, error) {
	rows, err := s.DB.Query("SELECT "+gameCols+" FROM games WHERE user_id = ? AND updated_at > ?", userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	games := []Game{}
	for rows.Next() {
		g, err := scanGame(rows)
		if err != nil {
			return nil, err
		}
		games = append(games, g)
	}
	return games, rows.Err()
}

func (s *Store) LatestOngoingOnlineGameForUser(userID int64) (*Game, error) {
	g, err := scanGame(s.DB.QueryRow("SELECT "+gameCols+" FROM games WHERE user_id = ? AND source = 'online' AND result = '*' AND deleted = 0 ORDER BY updated_at DESC LIMIT 1", userID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func (s *Store) OngoingOnlineGamesByMatchID(matchID string) ([]Game, error) {
	rows, err := s.DB.Query("SELECT "+gameCols+" FROM games WHERE id LIKE ? AND source = 'online' AND result = '*' AND deleted = 0", matchID+"-%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	games := []Game{}
	for rows.Next() {
		g, err := scanGame(rows)
		if err != nil {
			return nil, err
		}
		games = append(games, g)
	}
	return games, rows.Err()
}

// UpsertGame LWW：仅当来者 updated_at 更新时应用；返回是否应用
func (s *Store) UpsertGame(g *Game) (bool, error) {
	normalizeGame(g)
	res, err := s.DB.Exec(`
		INSERT INTO games (`+gameCols+`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			user_id=excluded.user_id,
			title=excluded.title, red_player=excluded.red_player, black_player=excluded.black_player,
			result=excluded.result, initial_fen=excluded.initial_fen, moves=excluded.moves, tree=excluded.tree,
			source=excluded.source, is_public=excluded.is_public, updated_at=excluded.updated_at, deleted=excluded.deleted
		WHERE games.user_id = excluded.user_id AND excluded.updated_at > games.updated_at`,
		g.ID, g.UserID, g.Title, g.RedPlayer, g.BlackPlayer, g.Result,
		g.InitialFEN, string(g.Moves), string(g.Tree), g.Source, g.IsPublic, g.Category, g.Collection,
		g.Opening, g.QualityScore, g.AverageLossCP, g.BlunderCount, g.EngineName, g.SourceURL,
		g.SourceVersion, g.AnalyzedAt, g.CreatedAt, g.UpdatedAt, g.Deleted)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (s *Store) ImportedGameState(id string) (version string, analyzed bool, err error) {
	err = s.DB.QueryRow("SELECT source_version, analyzed_at > 0 FROM games WHERE id = ? AND user_id = 0", id).Scan(&version, &analyzed)
	if err == sql.ErrNoRows {
		err = nil
	}
	return
}

func (s *Store) UpsertImportedGame(g *Game) error {
	normalizeGame(g)
	_, err := s.DB.Exec(`
		INSERT INTO games (`+gameCols+`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			title=excluded.title, red_player=excluded.red_player, black_player=excluded.black_player,
			result=excluded.result, initial_fen=excluded.initial_fen, moves=excluded.moves,
			source=excluded.source, is_public=1, category=excluded.category, collection=excluded.collection,
			opening=excluded.opening, quality_score=excluded.quality_score,
			average_loss_cp=excluded.average_loss_cp, blunder_count=excluded.blunder_count,
			engine_name=excluded.engine_name, source_url=excluded.source_url,
			source_version=excluded.source_version, analyzed_at=excluded.analyzed_at,
			updated_at=excluded.updated_at, deleted=0
		WHERE games.user_id = 0`,
		g.ID, int64(0), g.Title, g.RedPlayer, g.BlackPlayer, g.Result, g.InitialFEN,
		string(g.Moves), "", g.Source, true, g.Category, g.Collection, g.Opening,
		g.QualityScore, g.AverageLossCP, g.BlunderCount, g.EngineName, g.SourceURL,
		g.SourceVersion, g.AnalyzedAt, g.CreatedAt, g.UpdatedAt, false)
	return err
}

// DeleteGame 打墓碑
func (s *Store) DeleteGame(userID int64, id string, now int64) error {
	_, err := s.DB.Exec("UPDATE games SET deleted = 1, updated_at = ? WHERE user_id = ? AND id = ?", now, userID, id)
	return err
}
