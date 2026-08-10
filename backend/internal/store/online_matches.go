package store

import "database/sql"

type OnlineMatchRecord struct {
	ID          string
	Status      string
	RoomCode    string
	RedUserID   int64
	BlackUserID int64
	UpdatedAt   int64
	Payload     string
}

func (s *Store) UpsertOnlineMatch(r OnlineMatchRecord) error {
	_, err := s.DB.Exec(`
		INSERT INTO online_matches (id, status, room_code, red_user_id, black_user_id, updated_at, payload)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			status=excluded.status,
			room_code=excluded.room_code,
			red_user_id=excluded.red_user_id,
			black_user_id=excluded.black_user_id,
			updated_at=excluded.updated_at,
			payload=excluded.payload`,
		r.ID, r.Status, r.RoomCode, r.RedUserID, r.BlackUserID, r.UpdatedAt, r.Payload)
	return err
}

func (s *Store) DeleteOnlineMatch(id string) error {
	_, err := s.DB.Exec("DELETE FROM online_matches WHERE id = ?", id)
	return err
}

func (s *Store) LatestOpenOnlineMatchForUser(userID int64) (*OnlineMatchRecord, error) {
	row := s.DB.QueryRow(`
		SELECT id, status, room_code, red_user_id, black_user_id, updated_at, payload
		FROM online_matches
		WHERE status IN ('waiting', 'active') AND (red_user_id = ? OR black_user_id = ?)
		ORDER BY updated_at DESC
		LIMIT 1`, userID, userID)
	var r OnlineMatchRecord
	if err := row.Scan(&r.ID, &r.Status, &r.RoomCode, &r.RedUserID, &r.BlackUserID, &r.UpdatedAt, &r.Payload); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &r, nil
}

func (s *Store) OnlineMatchByID(id string) (*OnlineMatchRecord, error) {
	row := s.DB.QueryRow(`
		SELECT id, status, room_code, red_user_id, black_user_id, updated_at, payload
		FROM online_matches
		WHERE id = ? AND status IN ('waiting', 'active')`, id)
	var r OnlineMatchRecord
	if err := row.Scan(&r.ID, &r.Status, &r.RoomCode, &r.RedUserID, &r.BlackUserID, &r.UpdatedAt, &r.Payload); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &r, nil
}

func (s *Store) OnlineMatchByRoomCode(roomCode string) (*OnlineMatchRecord, error) {
	row := s.DB.QueryRow(`
		SELECT id, status, room_code, red_user_id, black_user_id, updated_at, payload
		FROM online_matches
		WHERE room_code = ? AND status = 'waiting'
		ORDER BY updated_at DESC
		LIMIT 1`, roomCode)
	var r OnlineMatchRecord
	if err := row.Scan(&r.ID, &r.Status, &r.RoomCode, &r.RedUserID, &r.BlackUserID, &r.UpdatedAt, &r.Payload); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &r, nil
}
