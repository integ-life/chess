package store

import (
	"encoding/base64"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPasswordHashAndLegacyUpgrade(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	if _, err := s.CreateUser("new-user", "new-password"); err != nil {
		t.Fatal(err)
	}
	var newHash string
	if err := s.DB.QueryRow("SELECT password_hash FROM users WHERE username = ?", "new-user").Scan(&newHash); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(newHash, "$2") {
		t.Fatalf("new hash is not bcrypt: %q", newHash)
	}
	longPassword := strings.Repeat("x", 100)
	if _, err := s.CreateUser("long-user", longPassword); err != nil {
		t.Fatal(err)
	}
	if _, err := s.AuthenticateUser("long-user", longPassword); err != nil {
		t.Fatalf("100-byte password cannot authenticate: %v", err)
	}

	legacyHash := legacyHashForTest("old-password")
	if _, err := s.DB.Exec("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)", "old-user", legacyHash, time.Now().UnixMilli()); err != nil {
		t.Fatal(err)
	}
	if _, err := s.AuthenticateUser("old-user", "wrong-password"); err != ErrInvalidCredentials {
		t.Fatalf("wrong password error = %v", err)
	}
	var unchanged string
	_ = s.DB.QueryRow("SELECT password_hash FROM users WHERE username = ?", "old-user").Scan(&unchanged)
	if unchanged != legacyHash {
		t.Fatal("wrong password upgraded legacy hash")
	}
	if _, err := s.AuthenticateUser("old-user", "old-password"); err != nil {
		t.Fatal(err)
	}
	var upgraded string
	_ = s.DB.QueryRow("SELECT password_hash FROM users WHERE username = ?", "old-user").Scan(&upgraded)
	if !strings.HasPrefix(upgraded, "$2") {
		t.Fatalf("legacy hash was not upgraded: %q", upgraded)
	}
}

func TestFirstUserDoesNotClaimImportedPublicGames(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	now := time.Now().UnixMilli()
	if _, err := s.DB.Exec(`INSERT INTO games (id, title, initial_fen, moves, source, is_public, created_at, updated_at) VALUES ('public', 'public', ?, '[]', 'community-database', 1, ?, ?)`, "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1", now, now); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateUser("first-user", "password"); err != nil {
		t.Fatal(err)
	}
	var userID int64
	if err := s.DB.QueryRow("SELECT user_id FROM games WHERE id = 'public'").Scan(&userID); err != nil {
		t.Fatal(err)
	}
	if userID != 0 {
		t.Fatalf("imported game was claimed by user %d", userID)
	}
}

func legacyHashForTest(password string) string {
	salt := []byte("0123456789abcdef")
	return fmt.Sprintf("sha256:%d:%s:%s", 100_000,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(passwordKey([]byte(password), salt, 100_000)))
}
