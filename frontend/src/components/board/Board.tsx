import { useMemo, useState } from 'react'
import type { Color, Move, Position, Square } from '../../chess/types'
import { FILES, RANKS, fileOf, rankOf, sq } from '../../chess/types'
import { findKing, inCheck, legalMoves } from '../../chess/movegen'
import { useBoardThemeStore } from '../../stores/boardThemeStore'

interface BoardProps { position: Position; lastMove?: Move | null; moveColor?: Color; onMove?: (m: Move) => void; flipped?: boolean }
// Use the solid Unicode silhouettes for both sides and distinguish sides with
// CSS fill colors. The outlined “white” code points (♔–♙) are hollow shapes,
// so applying a white fill still leaves the pieces looking unfilled.
const GLYPH: Record<string,string>={rk:'♚',ra:'♛',rc:'♛',rr:'♜',re:'♝',rh:'♞',rp:'♟',bk:'♚',ba:'♛',bc:'♛',br:'♜',be:'♝',bh:'♞',bp:'♟'}

export default function Board({position,lastMove,moveColor,onMove,flipped}:BoardProps){
  const [selected,setSelected]=useState<Square|null>(null),theme=useBoardThemeStore((s)=>s.theme)
  const canMove=moveColor!==undefined&&moveColor===position.turn
  const options=useMemo(()=>selected===null||!canMove?[]:legalMoves(position,selected),[position,selected,canMove])
  const targets=options.map((m)=>m.to)
  const checked=useMemo(()=>{try{return inCheck(position,position.turn)?findKing(position.board,position.turn):null}catch{return null}},[position])
  const displaySquare=(col:number,row:number)=>{const file=flipped?7-col:col,rank=flipped?row:7-row;return sq(file,rank)}
  const click=(s:Square)=>{if(!canMove)return;const target=options.find((m)=>m.to===s);if(selected!==null&&target){onMove?.(target);setSelected(null);return}const p=position.board[s];setSelected(p?.color===moveColor?(selected===s?null:s):null)}
  return <svg viewBox="0 0 800 800" className={`chess-board chess-board--${theme} h-auto w-full select-none`} role="grid" aria-label="国际象棋棋盘">
    {Array.from({length:RANKS},(_,row)=>Array.from({length:FILES},(_,col)=>{const s=displaySquare(col,row),p=position.board[s],light=(col+row)%2===0,isLast=!!lastMove&&(lastMove.from===s||lastMove.to===s),isTarget=targets.includes(s);return <g key={s} onClick={()=>click(s)} className="cursor-pointer" role="gridcell">
      <rect x={col*100} y={row*100} width="100" height="100" className={light?'board-square-light':'board-square-dark'} />
      {isLast&&<rect x={col*100} y={row*100} width="100" height="100" fill="#facc15" opacity=".42"/>}
      {selected===s&&<rect x={col*100+4} y={row*100+4} width="92" height="92" fill="none" stroke="var(--board-selection)" strokeWidth="8"/>}
      {p&&<text x={col*100+50} y={row*100+55} textAnchor="middle" dominantBaseline="middle" fontSize="82" className={`chess-piece chess-piece--${p.color}`} stroke={s===checked?'#dc2626':undefined} strokeWidth="3">{GLYPH[p.color+p.type]}</text>}
      {isTarget&&<circle cx={col*100+50} cy={row*100+50} r={p?43:13} fill={p?'none':'var(--board-target)'} stroke={p?'var(--board-capture)':'none'} strokeWidth="6" opacity=".8"/>}
      {col===0&&<text x="5" y={row*100+15} fontSize="13" opacity=".65">{rankOf(s)+1}</text>}{row===7&&<text x={col*100+88} y="794" fontSize="13" opacity=".65">{String.fromCharCode(97+fileOf(s))}</text>}
    </g>}))}
  </svg>
}
