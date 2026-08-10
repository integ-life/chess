import { useMemo } from 'react'
import type { VariationNode, VariationTree as Tree } from '../stores/exploreStore'
import { fromFEN } from '../chess/fen'
import { moveFromICCS, moveToChinese } from '../chess/notation'
import { makeMove } from '../chess/position'
import type { Position } from '../chess/types'

interface Props {
  tree: Tree
  currentNodeId: string
  onSelect: (nodeId: string) => void
  compact?: boolean
}

// 预计算每个节点的中文着法
function buildLabels(tree: Tree): Map<string, string> {
  const labels = new Map<string, string>()
  function dfs(node: VariationNode, pos: Position) {
    for (const child of node.children) {
      const m = moveFromICCS(child.move!)
      labels.set(child.id, moveToChinese(pos, m))
      dfs(child, makeMove(pos, m))
    }
  }
  dfs(tree.root, fromFEN(tree.rootFen))
  return labels
}

export default function VariationTree({ tree, currentNodeId, onSelect, compact = false }: Props) {
  const labels = useMemo(() => buildLabels(tree), [tree])

  function MoveButton({ node }: { node: VariationNode }) {
    return (
      <button
        className={`rounded px-1.5 py-0.5 ${
          node.id === currentNodeId
            ? 'bg-amber-600 text-white'
            : node.note
              ? 'text-amber-800 underline decoration-dotted hover:bg-amber-100'
              : 'hover:bg-amber-100'
        }`}
        onClick={() => onSelect(node.id)}
        title={node.note || undefined}
      >
        {labels.get(node.id)}
      </button>
    )
  }

  // 渲染从 node 开始的主线，侧变着缩进为子块
  function Line({ node }: { node: VariationNode }) {
    const elements: React.ReactNode[] = []
    let cur = node
    while (cur.children.length > 0) {
      const main = cur.children[0]
      elements.push(<MoveButton key={main.id} node={main} />)
      for (const alt of cur.children.slice(1)) {
        elements.push(
          <div key={alt.id} className="my-0.5 ml-4 border-l-2 border-amber-200 pl-2">
            <MoveButton node={alt} />
            <Line node={alt} />
          </div>,
        )
      }
      cur = main
    }
    return <div className="inline">{elements}</div>
  }

  if (tree.root.children.length === 0) {
    return <p className="text-sm text-gray-400">在棋盘上走子开始推演</p>
  }
  return (
    <div className={`${compact ? 'max-h-36' : 'max-h-80'} overflow-y-auto text-sm leading-7`}>
      <button
        className={`rounded px-1.5 py-0.5 ${
          tree.root.id === currentNodeId ? 'bg-amber-600 text-white' : 'text-gray-500 hover:bg-amber-100'
        }`}
        onClick={() => onSelect(tree.root.id)}
      >
        起点
      </button>
      <Line node={tree.root} />
    </div>
  )
}
