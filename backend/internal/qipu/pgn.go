package qipu

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"chess/backend/internal/chess"
)

func ParsePGN(r io.Reader, sourceID, sourceURL, filename string, visit func(Record) error, reject func(error)) error {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 2*1024*1024)
	var lines []string
	index := 0
	flush := func() error {
		if len(lines) == 0 {
			return nil
		}
		index++
		record, err := parsePGNGame(lines, sourceID, sourceURL, filename, index)
		lines = lines[:0]
		if err != nil {
			reject(err)
			return nil
		}
		return visit(record)
	}
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "[Game ") && len(lines) > 0 {
			if err := flush(); err != nil {
				return err
			}
		}
		if line != "" {
			lines = append(lines, line)
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	return flush()
}

func parsePGNGame(lines []string, sourceID, sourceURL, filename string, index int) (Record, error) {
	metadata := map[string]string{}
	moves := []string{}
	for _, line := range lines {
		if key, value, ok := parseHeader(line); ok {
			metadata[key] = value
			continue
		}
		for _, token := range strings.Fields(line) {
			if move, ok := normalizePGNMove(token); ok {
				moves = append(moves, move)
			}
		}
	}
	if len(moves) == 0 {
		return Record{}, fmt.Errorf("%s game %d has no moves", filename, index)
	}
	initialFEN := metadata["FEN"]
	if initialFEN == "" {
		initialFEN = chess.StartFEN
	}
	pos, err := chess.ParseFEN(initialFEN)
	if err != nil {
		return Record{}, fmt.Errorf("%s game %d: %w", filename, index, err)
	}
	initialFEN = pos.FEN()
	for _, iccs := range moves {
		move, err := chess.MoveFromICCS(iccs)
		if err != nil || !pos.IsLegal(move) {
			return Record{}, fmt.Errorf("%s game %d illegal move %s", filename, index, iccs)
		}
		pos.Apply(move)
	}
	raw := strings.Join(lines, "\n")
	version := sha256.Sum256([]byte(raw))
	title := metadata["Event"]
	if title == "" || title == "-" {
		title = strings.TrimSpace(metadata["Red"] + " vs " + metadata["Black"])
	}
	record := Record{
		SourceID:      sourceID,
		SourceKey:     fmt.Sprintf("%s#%d", filepath.Base(filename), index),
		SourceURL:     sourceURL,
		SourceVersion: hex.EncodeToString(version[:]),
		Title:         title,
		Event:         metadata["Event"],
		Site:          metadata["Site"],
		Date:          metadata["Date"],
		Round:         metadata["Round"],
		RedPlayer:     metadata["Red"],
		BlackPlayer:   metadata["Black"],
		RedTeam:       metadata["RedTeam"],
		BlackTeam:     metadata["BlackTeam"],
		Result:        normalizeResult(metadata["Result"]),
		Opening:       metadata["Opening"],
		Category:      "赛事实战",
		Collection:    sourceID,
		InitialFEN:    initialFEN,
		Moves:         moves,
		Metadata:      metadata,
	}
	record.SetID()
	return record, nil
}

func parseHeader(line string) (string, string, bool) {
	if len(line) < 5 || line[0] != '[' || line[len(line)-1] != ']' {
		return "", "", false
	}
	space := strings.IndexByte(line, ' ')
	if space < 2 {
		return "", "", false
	}
	key := line[1:space]
	value := strings.TrimSpace(line[space+1 : len(line)-1])
	value = strings.Trim(value, "\"")
	return key, value, true
}

func normalizePGNMove(token string) (string, bool) {
	token = strings.Trim(token, "!?+#")
	if len(token) != 5 || token[0] < 'A' || token[0] > 'I' || token[1] < '0' || token[1] > '9' ||
		(token[2] != '-' && token[2] != 'x') || token[3] < 'A' || token[3] > 'I' || token[4] < '0' || token[4] > '9' {
		return "", false
	}
	return strings.ToLower(token[:2] + token[3:]), true
}
