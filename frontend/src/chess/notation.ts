import type { Move, Position, Square } from './types'
import { fileOf, rankOf, sq } from './types'
const label=(s:Square)=>String.fromCharCode(97+fileOf(s))+(rankOf(s)+1)
export function moveToICCS(m:Move):string{return label(m.from)+label(m.to)+(m.promotion?{a:'q',r:'r',e:'b',h:'n'}[m.promotion]:'')}
export function moveFromICCS(text:string):Move{if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(text))throw new Error(`invalid UCI move: ${text}`);const at=(i:number)=>sq(text.charCodeAt(i)-97,Number(text[i+1])-1);const map={q:'a',r:'r',b:'e',n:'h'} as const;return{from:at(0),to:at(2),...(text[4]?{promotion:map[text[4] as keyof typeof map]}:{})}}
export function moveToChinese(_pos:Position,m:Move):string{return moveToICCS(m)}
