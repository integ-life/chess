package store

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	CreatedAt int64  `json:"createdAt"`
}

var ErrInvalidCredentials = errors.New("invalid username or password")

func (s *Store) CreateUser(username, password string) (*User, error) {
	hash, err := hashPassword(password)
	if err != nil {
		return nil, err
	}
	return s.createUser(username, hash, "")
}

func (s *Store) FindOrCreateIntegUser(subject, email string) (*User, error) {
	if user, err := s.UserByIntegSubject(subject); err != nil || user != nil {
		return user, err
	}
	password, err := randomToken(32)
	if err != nil {
		return nil, err
	}
	hash, err := hashPassword(password)
	if err != nil {
		return nil, err
	}
	username := integUsername(subject, email)
	user, err := s.createUser(username, hash, subject)
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "unique") {
		return s.UserByIntegSubject(subject)
	}
	return user, err
}

func (s *Store) UserByIntegSubject(subject string) (*User, error) {
	var user User
	err := s.DB.QueryRow(
		"SELECT id, username, created_at FROM users WHERE integ_auth_subject = ?",
		subject,
	).Scan(&user.ID, &user.Username, &user.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &user, err
}

func (s *Store) createUser(username, passwordHash, integSubject string) (*User, error) {
	now := time.Now().UnixMilli()
	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	res, err := tx.Exec(
		"INSERT INTO users (username, password_hash, integ_auth_subject, created_at) VALUES (?, ?, NULLIF(?, ''), ?)",
		username, passwordHash, integSubject, now,
	)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	var userCount int
	if err := tx.QueryRow("SELECT COUNT(*) FROM users").Scan(&userCount); err != nil {
		return nil, err
	}
	if userCount == 1 {
		if _, err := tx.Exec("UPDATE games SET user_id = ? WHERE user_id = 0 AND source <> 'community-database'", id); err != nil {
			return nil, err
		}
		if _, err := tx.Exec("UPDATE explorations SET user_id = ? WHERE user_id = 0", id); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &User{ID: id, Username: username, CreatedAt: now}, nil
}

func integUsername(subject, email string) string {
	base := strings.ToLower(strings.TrimSpace(strings.SplitN(email, "@", 2)[0]))
	var clean strings.Builder
	for _, r := range base {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			clean.WriteRune(r)
		}
	}
	base = strings.Trim(clean.String(), "_-")
	if len(base) < 3 {
		base = "integ"
	}
	if len(base) > 19 {
		base = base[:19]
	}
	digest := sha256.Sum256([]byte(subject))
	return base + "_" + hex.EncodeToString(digest[:6])
}

func (s *Store) AuthenticateUser(username, password string) (*User, error) {
	var u User
	var hash string
	err := s.DB.QueryRow(
		"SELECT id, username, password_hash, created_at FROM users WHERE username = ?",
		username,
	).Scan(&u.ID, &u.Username, &hash, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}
	ok, err := verifyPassword(password, hash)
	if err != nil || !ok {
		return nil, ErrInvalidCredentials
	}
	if strings.HasPrefix(hash, "sha256:") {
		upgraded, err := hashPassword(password)
		if err != nil {
			return nil, err
		}
		if _, err := s.DB.Exec("UPDATE users SET password_hash = ? WHERE id = ? AND password_hash = ?", upgraded, u.ID, hash); err != nil {
			return nil, err
		}
	}
	return &u, nil
}

func (s *Store) CreateSession(userID int64) (string, int64, error) {
	token, err := randomToken(32)
	if err != nil {
		return "", 0, err
	}
	now := time.Now()
	expires := now.Add(30 * 24 * time.Hour).UnixMilli()
	_, err = s.DB.Exec(
		"INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
		token, userID, now.UnixMilli(), expires,
	)
	if err != nil {
		return "", 0, err
	}
	return token, expires, nil
}

func (s *Store) UserBySession(token string) (*User, error) {
	var u User
	err := s.DB.QueryRow(`
		SELECT users.id, users.username, users.created_at
		FROM sessions
		JOIN users ON users.id = sessions.user_id
		WHERE sessions.token = ? AND sessions.expires_at > ?`,
		token, time.Now().UnixMilli(),
	).Scan(&u.ID, &u.Username, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) DeleteSession(token string) error {
	_, err := s.DB.Exec("DELETE FROM sessions WHERE token = ?", token)
	return err
}

func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword(bcryptPassword(password), bcrypt.DefaultCost)
	return string(hash), err
}

func verifyPassword(password, encoded string) (bool, error) {
	if strings.HasPrefix(encoded, "$2") {
		err := bcrypt.CompareHashAndPassword([]byte(encoded), bcryptPassword(password))
		return err == nil, err
	}
	return verifyLegacyPassword(password, encoded)
}

// bcrypt 本身只接收 72 字节；先做固定长度摘要以支持 API 的 128 字节上限。
func bcryptPassword(password string) []byte {
	digest := sha256.Sum256([]byte(password))
	return []byte(base64.RawStdEncoding.EncodeToString(digest[:]))
}

func verifyLegacyPassword(password, encoded string) (bool, error) {
	parts := strings.Split(encoded, ":")
	if len(parts) != 4 || parts[0] != "sha256" {
		return false, errors.New("unsupported password hash")
	}
	iterations, err := strconv.Atoi(parts[1])
	if err != nil {
		return false, err
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[2])
	if err != nil {
		return false, err
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil {
		return false, err
	}
	got := passwordKey([]byte(password), salt, iterations)
	return hmac.Equal(got, want), nil
}

func passwordKey(password, salt []byte, iterations int) []byte {
	sum := append([]byte{}, salt...)
	sum = append(sum, password...)
	for range iterations {
		h := sha256.Sum256(sum)
		sum = h[:]
	}
	return sum
}

func randomToken(n int) (string, error) {
	b, err := randomBytes(n)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func randomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	return b, nil
}
