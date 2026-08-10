import { START_FEN } from '../chess/fen'
import type { VariationNode, VariationTree } from '../stores/exploreStore'

export function lineToVariationTree(
  moves: string[],
  rootFen = START_FEN,
  options: { rootNote?: string; nodeIdPrefix?: string } = {},
): VariationTree {
  const prefix = options.nodeIdPrefix ?? crypto.randomUUID()
  const root: VariationNode = {
    id: `${prefix}:root`,
    move: null,
    note: options.rootNote ?? '',
    children: [],
  }
  let node = root
  moves.forEach((move, index) => {
    const child: VariationNode = {
      id: `${prefix}:m.${index + 1}`,
      move,
      note: '',
      children: [],
    }
    node.children.push(child)
    node = child
  })
  return { rootFen, root, currentNodeId: root.id }
}

export function mainlineMovesFromTree(tree: VariationTree): string[] {
  const moves: string[] = []
  let node = tree.root
  while (node.children.length > 0) {
    node = node.children[0]
    if (node.move) moves.push(node.move)
  }
  return moves
}
