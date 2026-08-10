package store

import "encoding/json"

type CourseProgress struct {
	LessonKey string          `json:"lessonKey"`
	UserID    int64           `json:"-"`
	PlannedAt int64           `json:"plannedAt"`
	Done      json.RawMessage `json:"done"`
	UpdatedAt int64           `json:"updatedAt"`
}

const courseProgressCols = "lesson_key, user_id, planned_at, done, updated_at"

func (s *Store) ListCourseProgressSince(userID, since int64) ([]CourseProgress, error) {
	rows, err := s.DB.Query("SELECT "+courseProgressCols+" FROM course_progress WHERE user_id = ? AND updated_at > ?", userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CourseProgress{}
	for rows.Next() {
		var progress CourseProgress
		var done string
		if err := rows.Scan(&progress.LessonKey, &progress.UserID, &progress.PlannedAt, &done, &progress.UpdatedAt); err != nil {
			return nil, err
		}
		progress.Done = json.RawMessage(done)
		out = append(out, progress)
	}
	return out, rows.Err()
}

func (s *Store) UpsertCourseProgress(progress *CourseProgress) (bool, error) {
	result, err := s.DB.Exec(`
		INSERT INTO course_progress (`+courseProgressCols+`) VALUES (?,?,?,?,?)
		ON CONFLICT(user_id, lesson_key) DO UPDATE SET
			planned_at=excluded.planned_at, done=excluded.done, updated_at=excluded.updated_at
		WHERE excluded.updated_at > course_progress.updated_at`,
		progress.LessonKey, progress.UserID, progress.PlannedAt, string(progress.Done), progress.UpdatedAt)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}
