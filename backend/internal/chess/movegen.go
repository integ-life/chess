package chess

import "slices"

var ortho = [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}}
var diag = [][2]int{{1, 1}, {1, -1}, {-1, 1}, {-1, -1}}
var knight = [][2]int{{1, 2}, {-1, 2}, {1, -2}, {-1, -2}, {2, 1}, {2, -1}, {-2, 1}, {-2, -1}}

func FindKing(p *Position, c Color) Square {
	for s, x := range p.Board {
		if x != Empty && x.Color() == c && x.Type() == King {
			return s
		}
	}
	panic("king missing")
}
func attacked(p *Position, t Square, by Color) bool {
	f, r := FileOf(t), RankOf(t)
	pr := r - 1
	if by == Black {
		pr = r + 1
	}
	for _, df := range []int{-1, 1} {
		sf := f - df
		if onBoard(sf, pr) {
			x := p.Board[Sq(sf, pr)]
			if x != Empty && x.Color() == by && x.Type() == Pawn {
				return true
			}
		}
	}
	for _, d := range knight {
		sf, sr := f+d[0], r+d[1]
		if onBoard(sf, sr) {
			x := p.Board[Sq(sf, sr)]
			if x != Empty && x.Color() == by && x.Type() == Horse {
				return true
			}
		}
	}
	dirs := append(append([][2]int{}, ortho...), diag...)
	for i, d := range dirs {
		for sf, sr := f+d[0], r+d[1]; onBoard(sf, sr); sf, sr = sf+d[0], sr+d[1] {
			x := p.Board[Sq(sf, sr)]
			if x == Empty {
				continue
			}
			if x.Color() == by && (x.Type() == Advisor || (i < 4 && x.Type() == Rook) || (i >= 4 && x.Type() == Elephant)) {
				return true
			}
			break
		}
	}
	for _, d := range dirs {
		sf, sr := f+d[0], r+d[1]
		if onBoard(sf, sr) {
			x := p.Board[Sq(sf, sr)]
			if x != Empty && x.Color() == by && x.Type() == King {
				return true
			}
		}
	}
	return false
}
func InCheck(p *Position, c Color) bool { return attacked(p, FindKing(p, c), c.Opposite()) }
func pseudoFrom(p *Position, from Square) []Move {
	x := p.Board[from]
	f, r := FileOf(from), RankOf(from)
	out := []Move{}
	add := func(tf, tr int, promo Piece) {
		if !onBoard(tf, tr) {
			return
		}
		t := p.Board[Sq(tf, tr)]
		if t == Empty || t.Color() != x.Color() {
			out = append(out, Move{from, Sq(tf, tr), promo})
		}
	}
	slide := func(ds [][2]int) {
		for _, d := range ds {
			for tf, tr := f+d[0], r+d[1]; onBoard(tf, tr); tf, tr = tf+d[0], tr+d[1] {
				t := p.Board[Sq(tf, tr)]
				if t == Empty {
					out = append(out, Move{From: from, To: Sq(tf, tr)})
				} else {
					if t.Color() != x.Color() {
						out = append(out, Move{From: from, To: Sq(tf, tr)})
					}
					break
				}
			}
		}
	}
	switch x.Type() {
	case Rook:
		slide(ortho)
	case Elephant:
		slide(diag)
	case Advisor:
		slide(append(append([][2]int{}, ortho...), diag...))
	case Horse:
		for _, d := range knight {
			add(f+d[0], r+d[1], Empty)
		}
	case King:
		dirs := append(append([][2]int{}, ortho...), diag...)
		for _, d := range dirs {
			add(f+d[0], r+d[1], Empty)
		}
		home := 0
		if x.Color() == Black {
			home = 7
		}
		if r == home && f == 4 && !InCheck(p, x.Color()) {
			ks, qs := "K", "Q"
			if x.Color() == Black {
				ks, qs = "k", "q"
			}
			if stringsContains(p.Castling, ks) && p.Board[Sq(5, home)] == Empty && p.Board[Sq(6, home)] == Empty && !attacked(p, Sq(5, home), x.Color().Opposite()) && !attacked(p, Sq(6, home), x.Color().Opposite()) {
				out = append(out, Move{From: from, To: Sq(6, home)})
			}
			if stringsContains(p.Castling, qs) && p.Board[Sq(1, home)] == Empty && p.Board[Sq(2, home)] == Empty && p.Board[Sq(3, home)] == Empty && !attacked(p, Sq(3, home), x.Color().Opposite()) && !attacked(p, Sq(2, home), x.Color().Opposite()) {
				out = append(out, Move{From: from, To: Sq(2, home)})
			}
		}
	case Pawn:
		dir, start, promo := 1, 1, 7
		if x.Color() == Black {
			dir, start, promo = -1, 6, 0
		}
		one := r + dir
		if onBoard(f, one) && p.Board[Sq(f, one)] == Empty {
			if one == promo {
				for _, v := range []Piece{Advisor, Rook, Elephant, Horse} {
					add(f, one, v)
				}
			} else {
				add(f, one, Empty)
			}
			if r == start && p.Board[Sq(f, r+2*dir)] == Empty {
				add(f, r+2*dir, Empty)
			}
		}
		for _, df := range []int{-1, 1} {
			tf := f + df
			if onBoard(tf, one) {
				to := Sq(tf, one)
				t := p.Board[to]
				if (t != Empty && t.Color() != x.Color()) || to == p.EnPassant {
					if one == promo {
						for _, v := range []Piece{Advisor, Rook, Elephant, Horse} {
							out = append(out, Move{from, to, v})
						}
					} else {
						out = append(out, Move{From: from, To: to})
					}
				}
			}
		}
	}
	return out
}
func stringsContains(s, x string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] == x[0] {
			return true
		}
	}
	return false
}
func removeRight(s string, x byte) string {
	b := []byte{}
	for i := range len(s) {
		if s[i] != x {
			b = append(b, s[i])
		}
	}
	return string(b)
}
func PseudoMoves(p *Position) []Move {
	out := []Move{}
	for s, x := range p.Board {
		if x != Empty && x.Color() == p.Turn {
			out = append(out, pseudoFrom(p, s)...)
		}
	}
	return out
}
func LegalMoves(p *Position) []Move {
	out := []Move{}
	for _, m := range PseudoMoves(p) {
		n := *p
		n.Apply(m)
		if !InCheck(&n, p.Turn) {
			out = append(out, m)
		}
	}
	return out
}
func (p *Position) IsLegal(m Move) bool {
	return m.From >= 0 && m.From < 64 && m.To >= 0 && m.To < 64 && slices.Contains(LegalMoves(p), m)
}
func (p *Position) Apply(m Move) {
	x, target := p.Board[m.From], p.Board[m.To]
	p.Board[m.To] = x
	if m.Promotion != Empty {
		p.Board[m.To] = Piece(int8(m.Promotion) * int8(x.Color()))
	}
	p.Board[m.From] = Empty
	if x.Type() == Pawn && m.To == p.EnPassant && target == Empty {
		p.Board[Sq(FileOf(m.To), RankOf(m.From))] = Empty
	}
	if x.Type() == King && abs(FileOf(m.To)-FileOf(m.From)) == 2 {
		r := RankOf(m.From)
		rf, rt := Sq(7, r), Sq(5, r)
		if FileOf(m.To) == 2 {
			rf, rt = Sq(0, r), Sq(3, r)
		}
		p.Board[rt] = p.Board[rf]
		p.Board[rf] = Empty
	}
	if x.Type() == King {
		if x.Color() == Red {
			p.Castling = removeRight(removeRight(p.Castling, 'K'), 'Q')
		} else {
			p.Castling = removeRight(removeRight(p.Castling, 'k'), 'q')
		}
	}
	for _, v := range [][2]any{{Sq(0, 0), byte('Q')}, {Sq(7, 0), byte('K')}, {Sq(0, 7), byte('q')}, {Sq(7, 7), byte('k')}} {
		if m.From == v[0].(int) || m.To == v[0].(int) {
			p.Castling = removeRight(p.Castling, v[1].(byte))
		}
	}
	p.EnPassant = -1
	if x.Type() == Pawn && abs(RankOf(m.To)-RankOf(m.From)) == 2 {
		p.EnPassant = Sq(FileOf(m.From), (RankOf(m.To)+RankOf(m.From))/2)
	}
	if x.Type() == Pawn || target != Empty {
		p.Halfmove = 0
	} else {
		p.Halfmove++
	}
	if p.Turn == Black {
		p.Fullmove++
	}
	p.Turn = p.Turn.Opposite()
}
func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

type GameStatus string

const (
	Ongoing   GameStatus = "ongoing"
	Checkmate GameStatus = "checkmate"
	Stalemate GameStatus = "stalemate"
)

func Status(p *Position) GameStatus {
	if len(LegalMoves(p)) > 0 {
		return Ongoing
	}
	if InCheck(p, p.Turn) {
		return Checkmate
	}
	return Stalemate
}
func Perft(p *Position, d int) uint64 {
	if d == 0 {
		return 1
	}
	var n uint64
	for _, m := range LegalMoves(p) {
		q := *p
		q.Apply(m)
		n += Perft(&q, d-1)
	}
	return n
}
