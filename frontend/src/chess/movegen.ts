import type { Color, Move, Piece, Position, Square } from './types'
import { fileOf, onBoard, opposite, rankOf, sq } from './types'

const ORTHO = [[1,0],[-1,0],[0,1],[0,-1]] as const
const DIAG = [[1,1],[1,-1],[-1,1],[-1,-1]] as const
const KNIGHT = [[1,2],[-1,2],[1,-2],[-1,-2],[2,1],[2,-1],[-2,1],[-2,-1]] as const

export function findKing(board: (Piece | null)[], color: Color): Square {
  const found = board.findIndex((p) => p?.color === color && p.type === 'k')
  if (found < 0) throw new Error(`no ${color} king on board`)
  return found
}

function attacked(pos: Position, target: Square, by: Color): boolean {
  const tf = fileOf(target), tr = rankOf(target)
  const pawnSourceRank = tr - (by === 'r' ? 1 : -1)
  for (const df of [-1, 1]) { const f = tf - df; if (onBoard(f, pawnSourceRank)) { const p = pos.board[sq(f,pawnSourceRank)]; if (p?.color === by && p.type === 'p') return true } }
  for (const [df,dr] of KNIGHT) { const f=tf+df,r=tr+dr; if (onBoard(f,r)) { const p=pos.board[sq(f,r)]; if (p?.color===by&&p.type==='h') return true } }
  for (const [df,dr] of [...ORTHO,...DIAG]) {
    for (let f=tf+df,r=tr+dr; onBoard(f,r); f+=df,r+=dr) {
      const p=pos.board[sq(f,r)]; if (!p) continue
      if (p.color===by && (p.type==='a' || (p.type==='r' && (df===0||dr===0)) || (p.type==='e' && df!==0&&dr!==0))) return true
      break
    }
  }
  for (const [df,dr] of [...ORTHO,...DIAG]) { const f=tf+df,r=tr+dr; if (onBoard(f,r)) { const p=pos.board[sq(f,r)]; if (p?.color===by&&p.type==='k') return true } }
  return false
}

export function inCheck(pos: Position, color: Color): boolean { return attacked(pos, findKing(pos.board, color), opposite(color)) }

function pseudoFrom(pos: Position, from: Square): Move[] {
  const p=pos.board[from]; if (!p) return []
  const f=fileOf(from),r=rankOf(from),out:Move[]=[]
  const add=(tf:number,tr:number,promotion?:Move['promotion'])=>{ if(!onBoard(tf,tr))return; const t=pos.board[sq(tf,tr)]; if(t?.color!==p.color) out.push({from,to:sq(tf,tr),...(promotion?{promotion}:{})}) }
  const slide=(dirs:readonly (readonly [number,number])[])=>{ for(const [df,dr] of dirs) for(let tf=f+df,tr=r+dr;onBoard(tf,tr);tf+=df,tr+=dr){const t=pos.board[sq(tf,tr)];if(!t)out.push({from,to:sq(tf,tr)});else{if(t.color!==p.color)out.push({from,to:sq(tf,tr)});break}} }
  if(p.type==='r')slide(ORTHO); else if(p.type==='e')slide(DIAG); else if(p.type==='a'||p.type==='c')slide([...ORTHO,...DIAG])
  else if(p.type==='h') for(const [df,dr] of KNIGHT)add(f+df,r+dr)
  else if(p.type==='k') { for(const [df,dr] of [...ORTHO,...DIAG])add(f+df,r+dr); const home=p.color==='r'?0:7; if(r===home&&f===4&&!inCheck(pos,p.color)){ const rights=pos.castling??''; const kingSide=p.color==='r'?'K':'k',queenSide=p.color==='r'?'Q':'q'; if(rights.includes(kingSide)&&!pos.board[sq(5,home)]&&!pos.board[sq(6,home)]&&!attacked(pos,sq(5,home),opposite(p.color))&&!attacked(pos,sq(6,home),opposite(p.color)))out.push({from,to:sq(6,home)}); if(rights.includes(queenSide)&&!pos.board[sq(1,home)]&&!pos.board[sq(2,home)]&&!pos.board[sq(3,home)]&&!attacked(pos,sq(3,home),opposite(p.color))&&!attacked(pos,sq(2,home),opposite(p.color)))out.push({from,to:sq(2,home)}) } }
  else { const dir=p.color==='r'?1:-1,start=p.color==='r'?1:6,promo=p.color==='r'?7:0; const one=r+dir; if(onBoard(f,one)&&!pos.board[sq(f,one)]){ if(one===promo) for(const x of ['a','r','e','h'] as const)add(f,one,x); else add(f,one); if(r===start&&!pos.board[sq(f,r+2*dir)])add(f,r+2*dir) } for(const df of [-1,1]){const tf=f+df;if(!onBoard(tf,one))continue;const to=sq(tf,one),t=pos.board[to];if((t&&t.color!==p.color)||pos.enPassant===to){if(one===promo)for(const x of ['a','r','e','h'] as const)out.push({from,to,promotion:x});else out.push({from,to})}} }
  return out
}

export function pseudoMoves(pos: Position, from?: Square): Move[] { if(from!==undefined)return pos.board[from]?.color===pos.turn?pseudoFrom(pos,from):[]; return pos.board.flatMap((p,s)=>p?.color===pos.turn?pseudoFrom(pos,s):[]) }
export function legalMoves(pos: Position, from?: Square): Move[] { return pseudoMoves(pos,from).filter((m)=>{try{return !inCheck(applyMove(pos,m),pos.turn)}catch{return false}}) }

export function applyMove(pos: Position,m:Move):Position {
  const board=pos.board.slice(),p=board[m.from]!,target=board[m.to]; board[m.to]={...p,type:m.promotion??p.type};board[m.from]=null
  if(p.type==='p'&&m.to===pos.enPassant&&!target)board[sq(fileOf(m.to),rankOf(m.from))]=null
  if(p.type==='k'&&Math.abs(fileOf(m.to)-fileOf(m.from))===2){const rank=rankOf(m.from),kingSide=fileOf(m.to)===6,rookFrom=sq(kingSide?7:0,rank),rookTo=sq(kingSide?5:3,rank);board[rookTo]=board[rookFrom];board[rookFrom]=null}
  let castling=pos.castling??''; if(p.type==='k')castling=castling.replaceAll(p.color==='r'?'K':'k','').replaceAll(p.color==='r'?'Q':'q',''); const removeAt=(s:number)=>{if(s===sq(0,0))castling=castling.replace('Q','');if(s===sq(7,0))castling=castling.replace('K','');if(s===sq(0,7))castling=castling.replace('q','');if(s===sq(7,7))castling=castling.replace('k','')};removeAt(m.from);removeAt(m.to)
  const ep=p.type==='p'&&Math.abs(rankOf(m.to)-rankOf(m.from))===2?sq(fileOf(m.from),(rankOf(m.to)+rankOf(m.from))/2):null
  return {board,turn:opposite(pos.turn),castling,enPassant:ep,halfmove:p.type==='p'||target?0:(pos.halfmove??0)+1,fullmove:(pos.fullmove??1)+(pos.turn==='b'?1:0)}
}
export type GameStatus='ongoing'|'checkmate'|'stalemate'
export function gameStatus(pos:Position):GameStatus{return legalMoves(pos).length?'ongoing':inCheck(pos,pos.turn)?'checkmate':'stalemate'}
export function perft(pos:Position,depth:number):number{if(depth===0)return 1;return legalMoves(pos).reduce((n,m)=>n+perft(applyMove(pos,m),depth-1),0)}
