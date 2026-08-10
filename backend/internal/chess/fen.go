package chess

import (
	"fmt"
	"strconv"
	"strings"
)

const StartFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

var fenToType = map[byte]Piece{'k': King, 'q': Advisor, 'b': Elephant, 'n': Horse, 'r': Rook, 'p': Pawn}
var typeToFEN = map[Piece]byte{King: 'k', Advisor: 'q', Elephant: 'b', Horse: 'n', Rook: 'r', Pawn: 'p'}

func ParseFEN(fen string) (*Position, error) {
	parts := strings.Fields(fen)
	if len(parts) < 1 {
		return nil, fmt.Errorf("empty FEN")
	}
	rows := strings.Split(parts[0], "/")
	if len(rows) != 8 {
		return nil, fmt.Errorf("FEN must have 8 ranks")
	}
	p := &Position{Turn: Red, EnPassant: -1, Fullmove: 1}
	kings := map[Color]int{}
	for i, row := range rows {
		f := 0
		for j := 0; j < len(row); j++ {
			ch := row[j]
			if ch >= '1' && ch <= '8' {
				f += int(ch - '0')
				continue
			}
			t, ok := fenToType[ch|0x20]
			if !ok || f >= 8 {
				return nil, fmt.Errorf("invalid FEN rank %q", row)
			}
			piece := t
			if ch == ch|0x20 {
				piece = -t
			}
			p.Board[Sq(f, 7-i)] = piece
			if t == King {
				kings[piece.Color()]++
			}
			f++
		}
		if f != 8 {
			return nil, fmt.Errorf("invalid FEN rank %q", row)
		}
	}
	if kings[Red] != 1 || kings[Black] != 1 {
		return nil, fmt.Errorf("FEN must have exactly one king per side")
	}
	if len(parts) > 1 && parts[1] == "b" {
		p.Turn = Black
	}
	if len(parts) > 2 && parts[2] != "-" {
		p.Castling = parts[2]
	}
	if len(parts) > 3 && parts[3] != "-" {
		p.EnPassant = Sq(int(parts[3][0]-'a'), int(parts[3][1]-'1'))
	}
	if len(parts) > 4 {
		p.Halfmove, _ = strconv.Atoi(parts[4])
	}
	if len(parts) > 5 {
		p.Fullmove, _ = strconv.Atoi(parts[5])
	}
	return p, nil
}
func (p *Position) FEN() string {
	var b strings.Builder
	for r := 7; r >= 0; r-- {
		empty := 0
		for f := 0; f < 8; f++ {
			x := p.Board[Sq(f, r)]
			if x == Empty {
				empty++
				continue
			}
			if empty > 0 {
				fmt.Fprint(&b, empty)
				empty = 0
			}
			ch := typeToFEN[x.Type()]
			if x > 0 {
				ch -= 32
			}
			b.WriteByte(ch)
		}
		if empty > 0 {
			fmt.Fprint(&b, empty)
		}
		if r > 0 {
			b.WriteByte('/')
		}
	}
	turn := "w"
	if p.Turn == Black {
		turn = "b"
	}
	rights := p.Castling
	if rights == "" {
		rights = "-"
	}
	ep := "-"
	if p.EnPassant >= 0 {
		ep = fmt.Sprintf("%c%d", 'a'+FileOf(p.EnPassant), RankOf(p.EnPassant)+1)
	}
	return fmt.Sprintf("%s %s %s %s %d %d", b.String(), turn, rights, ep, p.Halfmove, p.Fullmove)
}
