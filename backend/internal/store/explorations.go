package store

import (
	"database/sql"
	"encoding/json"
)

type Exploration struct {
	ID        string          `json:"id"`
	UserID    int64           `json:"-"`
	Title     string          `json:"title"`
	RootFEN   string          `json:"rootFen"`
	GameID    *string         `json:"gameId,omitempty"`
	Tree      json.RawMessage `json:"tree"`
	CreatedAt int64           `json:"createdAt"`
	UpdatedAt int64           `json:"updatedAt"`
	Deleted   bool            `json:"deleted"`
}

const expCols = "id, user_id, title, root_fen, game_id, tree, created_at, updated_at, deleted"

func scanExploration(scan func(...any) error) (*Exploration, error) {
	var e Exploration
	var tree string
	if err := scan(&e.ID, &e.UserID, &e.Title, &e.RootFEN, &e.GameID, &tree, &e.CreatedAt, &e.UpdatedAt, &e.Deleted); err != nil {
		return nil, err
	}
	e.Tree = json.RawMessage(tree)
	return &e, nil
}

func (s *Store) ListExplorations(userID int64) ([]Exploration, error) {
	rows, err := s.DB.Query("SELECT "+expCols+" FROM explorations WHERE user_id = ? AND deleted = 0 ORDER BY updated_at DESC", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Exploration{}
	for rows.Next() {
		e, err := scanExploration(rows.Scan)
		if err != nil {
			return nil, err
		}
		out = append(out, *e)
	}
	return out, rows.Err()
}

func (s *Store) GetExploration(userID int64, id string) (*Exploration, error) {
	e, err := scanExploration(s.DB.QueryRow("SELECT "+expCols+" FROM explorations WHERE user_id = ? AND id = ? AND deleted = 0", userID, id).Scan)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return e, err
}

// ListExplorationsSince 返回 updated_at > since 的所有行（含墓碑），用于同步下行
func (s *Store) ListExplorationsSince(userID int64, since int64) ([]Exploration, error) {
	rows, err := s.DB.Query("SELECT "+expCols+" FROM explorations WHERE user_id = ? AND updated_at > ?", userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Exploration{}
	for rows.Next() {
		e, err := scanExploration(rows.Scan)
		if err != nil {
			return nil, err
		}
		out = append(out, *e)
	}
	return out, rows.Err()
}

// UpsertExploration LWW：仅当来者 updated_at 更新时应用
func (s *Store) UpsertExploration(e *Exploration) (bool, error) {
	res, err := s.DB.Exec(`
		INSERT INTO explorations (`+expCols+`) VALUES (?,?,?,?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			user_id=excluded.user_id,
			title=excluded.title, root_fen=excluded.root_fen, game_id=excluded.game_id,
			tree=excluded.tree, updated_at=excluded.updated_at, deleted=excluded.deleted
		WHERE explorations.user_id = excluded.user_id AND excluded.updated_at > explorations.updated_at`,
		e.ID, e.UserID, e.Title, e.RootFEN, e.GameID, string(e.Tree), e.CreatedAt, e.UpdatedAt, e.Deleted)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (s *Store) DeleteExploration(userID int64, id string, now int64) error {
	_, err := s.DB.Exec("UPDATE explorations SET deleted = 1, updated_at = ? WHERE user_id = ? AND id = ?", now, userID, id)
	return err
}
