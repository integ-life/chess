package store

import (
	"encoding/json"
	"path/filepath"
	"testing"
)

func TestCourseProgressLWWAndUserIsolation(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "course.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	progress := CourseProgress{LessonKey: "foundation-board", UserID: 7, PlannedAt: 10, Done: json.RawMessage(`[true,false,false]`), UpdatedAt: 20}
	if applied, err := store.UpsertCourseProgress(&progress); err != nil || !applied {
		t.Fatalf("first upsert: applied=%v err=%v", applied, err)
	}
	stale := progress
	stale.Done = json.RawMessage(`[true,true,false]`)
	stale.UpdatedAt = 19
	if applied, err := store.UpsertCourseProgress(&stale); err != nil || applied {
		t.Fatalf("stale upsert: applied=%v err=%v", applied, err)
	}

	rows, err := store.ListCourseProgressSince(7, 0)
	if err != nil || len(rows) != 1 || string(rows[0].Done) != `[true,false,false]` {
		t.Fatalf("user rows=%+v err=%v", rows, err)
	}
	otherRows, err := store.ListCourseProgressSince(8, 0)
	if err != nil || len(otherRows) != 0 {
		t.Fatalf("other user rows=%+v err=%v", otherRows, err)
	}
}
