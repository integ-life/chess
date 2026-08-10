package qipu

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

type Record struct {
	ID            string            `json:"id"`
	SourceID      string            `json:"sourceId"`
	SourceKey     string            `json:"sourceKey"`
	SourceURL     string            `json:"sourceUrl"`
	SourceVersion string            `json:"sourceVersion"`
	Title         string            `json:"title"`
	Event         string            `json:"event"`
	Site          string            `json:"site"`
	Date          string            `json:"date"`
	Round         string            `json:"round"`
	RedPlayer     string            `json:"redPlayer"`
	BlackPlayer   string            `json:"blackPlayer"`
	RedTeam       string            `json:"redTeam"`
	BlackTeam     string            `json:"blackTeam"`
	Result        string            `json:"result"`
	Opening       string            `json:"opening"`
	Category      string            `json:"category"`
	Collection    string            `json:"collection"`
	InitialFEN    string            `json:"initialFen"`
	Moves         []string          `json:"moves"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

func (r *Record) SetID() {
	h := sha256.New()
	h.Write([]byte(r.InitialFEN))
	h.Write([]byte{0})
	h.Write([]byte(strings.Join(r.Moves, "")))
	r.ID = hex.EncodeToString(h.Sum(nil))
}
