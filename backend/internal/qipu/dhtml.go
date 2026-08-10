package qipu

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"

	"chess/backend/internal/chess"
)

var categoryNames = map[string]string{
	"community":      "社区棋谱",
	"end-games":      "残局",
	"mid-games":      "中局",
	"opening":        "开局",
	"puzzles":        "战术题",
	"selected-games": "精选",
	"tournaments":    "赛事实战",
}

// ParseDhtmlXQ converts the source database's DhtmlXQ main line to the app's ICCS game model.
func ParseDhtmlXQ(relativePath string, data []byte) (Record, error) {
	text := strings.TrimPrefix(string(data), "\ufeff")
	movelist := tag(text, "movelist")
	if movelist == "" || len(movelist)%4 != 0 {
		return Record{}, fmt.Errorf("missing or invalid movelist")
	}

	moves := make([]string, 0, len(movelist)/4)
	for i := 0; i < len(movelist); i += 4 {
		chunk := movelist[i : i+4]
		for _, ch := range chunk {
			if ch < '0' || ch > '9' {
				return Record{}, fmt.Errorf("invalid move %q", chunk)
			}
		}
		moves = append(moves, fmt.Sprintf("%c%d%c%d",
			'a'+chunk[0]-'0', 9-int(chunk[1]-'0'),
			'a'+chunk[2]-'0', 9-int(chunk[3]-'0')))
	}

	pos, err := positionFromBInit(tag(text, "binit"))
	if err != nil {
		return Record{}, err
	}
	first, err := chess.MoveFromICCS(moves[0])
	if err != nil {
		return Record{}, err
	}
	if pos.Board[first.From].Color() == chess.Black {
		pos.Turn = chess.Black
	}
	initialFEN := pos.FEN()
	for _, iccs := range moves {
		move, err := chess.MoveFromICCS(iccs)
		if err != nil || !pos.IsLegal(move) {
			return Record{}, fmt.Errorf("illegal move %s", iccs)
		}
		pos.Apply(move)
	}

	parts := strings.Split(filepath.ToSlash(relativePath), "/")
	category := categoryNames[parts[0]]
	if category == "" {
		category = "其他"
	}
	collection := ""
	if len(parts) > 2 {
		collection = parts[1]
	}
	title := tag(text, "title")
	if title == "" {
		title = strings.TrimSuffix(filepath.Base(relativePath), filepath.Ext(relativePath))
	}
	contentHash := sha256.Sum256(data)
	escapedPath := strings.ReplaceAll(url.PathEscape(filepath.ToSlash(relativePath)), "%2F", "/")

	record := Record{
		SourceID:      "chasoft-community",
		SourceKey:     filepath.ToSlash(relativePath),
		Title:         title,
		Event:         tag(text, "event"),
		Site:          tag(text, "place"),
		Date:          tag(text, "date"),
		Round:         tag(text, "round"),
		RedPlayer:     tag(text, "red"),
		BlackPlayer:   tag(text, "black"),
		RedTeam:       tag(text, "redteam"),
		BlackTeam:     tag(text, "blackteam"),
		Result:        normalizeResult(tag(text, "result")),
		InitialFEN:    initialFEN,
		Moves:         moves,
		Category:      category,
		Collection:    collection,
		Opening:       tag(text, "open"),
		SourceURL:     "https://github.com/chasoft/community-xiangqi-games-database/blob/main/data/" + escapedPath,
		SourceVersion: hex.EncodeToString(contentHash[:]),
		Metadata: map[string]string{
			"author": tag(text, "author"),
			"type":   tag(text, "type"),
			"remark": tag(text, "remark"),
		},
	}
	record.SetID()
	return record, nil
}

func tag(text, name string) string {
	start := "[DhtmlXQ_" + name + "]"
	i := strings.Index(text, start)
	if i < 0 {
		return ""
	}
	i += len(start)
	j := strings.Index(text[i:], "[/DhtmlXQ_"+name+"]")
	if j < 0 {
		return ""
	}
	return strings.TrimSpace(text[i : i+j])
}

func positionFromBInit(binit string) (*chess.Position, error) {
	if binit == "" {
		return chess.ParseFEN(chess.StartFEN)
	}
	if len(binit) != 64 {
		return nil, fmt.Errorf("invalid binit length %d", len(binit))
	}
	types := []chess.Piece{
		chess.Rook, chess.Horse, chess.Elephant, chess.Advisor, chess.King,
		chess.Advisor, chess.Elephant, chess.Horse, chess.Rook,
		chess.Cannon, chess.Cannon,
		chess.Pawn, chess.Pawn, chess.Pawn, chess.Pawn, chess.Pawn,
	}
	pos := &chess.Position{Turn: chess.Red}
	for i := 0; i < 32; i++ {
		file, sourceRank := int(binit[i*2]-'0'), int(binit[i*2+1]-'0')
		if file == 9 && sourceRank == 9 {
			continue
		}
		if file < 0 || file >= chess.Files || sourceRank < 0 || sourceRank >= chess.Ranks {
			return nil, fmt.Errorf("invalid binit square %d%d", file, sourceRank)
		}
		rank := 9 - sourceRank
		piece := types[i%16]
		if i >= 16 {
			piece = -piece
		}
		pos.Board[chess.Sq(file, rank)] = piece
	}
	if _, err := chess.ParseFEN(pos.FEN()); err != nil {
		return nil, err
	}
	return pos, nil
}

func normalizeResult(result string) string {
	switch strings.TrimSpace(result) {
	case "红胜", "紅勝", "1-0":
		return "1-0"
	case "黑胜", "黑勝", "0-1":
		return "0-1"
	case "和棋", "和局", "和", "1/2-1/2":
		return "1/2-1/2"
	default:
		return "*"
	}
}
