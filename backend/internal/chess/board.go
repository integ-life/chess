// Package chess implements standard international chess rules and UCI notation.
package chess

import "fmt"

type Color int8

const (
	Red   Color = 1
	Black Color = -1
)                               // Red is retained as the API name for White.
func (c Color) Opposite() Color { return -c }

type Piece int8

const (
	Empty    Piece = 0
	King     Piece = 1
	Advisor  Piece = 2
	Elephant Piece = 3
	Horse    Piece = 4
	Rook     Piece = 5
	Cannon   Piece = 6
	Pawn     Piece = 7
)

func (p Piece) Color() Color {
	if p > 0 {
		return Red
	}
	return Black
}
func (p Piece) Type() Piece {
	if p < 0 {
		return -p
	}
	return p
}

const (
	Files = 8
	Ranks = 8
)

type Square = int

func Sq(f, r int) Square    { return r*Files + f }
func FileOf(s Square) int   { return s % Files }
func RankOf(s Square) int   { return s / Files }
func onBoard(f, r int) bool { return f >= 0 && f < 8 && r >= 0 && r < 8 }

type Move struct {
	From, To  Square
	Promotion Piece
}

func (m Move) ICCS() string {
	suffix := ""
	if m.Promotion != Empty {
		suffix = map[Piece]string{Advisor: "q", Rook: "r", Elephant: "b", Horse: "n"}[m.Promotion]
	}
	return fmt.Sprintf("%c%d%c%d%s", 'a'+FileOf(m.From), RankOf(m.From)+1, 'a'+FileOf(m.To), RankOf(m.To)+1, suffix)
}
func MoveFromICCS(s string) (Move, error) {
	if len(s) < 4 || len(s) > 5 || s[0] < 'a' || s[0] > 'h' || s[1] < '1' || s[1] > '8' || s[2] < 'a' || s[2] > 'h' || s[3] < '1' || s[3] > '8' {
		return Move{}, fmt.Errorf("invalid UCI move %q", s)
	}
	m := Move{From: Sq(int(s[0]-'a'), int(s[1]-'1')), To: Sq(int(s[2]-'a'), int(s[3]-'1'))}
	if len(s) == 5 {
		var ok bool
		m.Promotion, ok = map[byte]Piece{'q': Advisor, 'r': Rook, 'b': Elephant, 'n': Horse}[s[4]]
		if !ok {
			return Move{}, fmt.Errorf("invalid promotion")
		}
	}
	return m, nil
}

type Position struct {
	Board              [64]Piece
	Turn               Color
	Castling           string
	EnPassant          Square
	Halfmove, Fullmove int
}
