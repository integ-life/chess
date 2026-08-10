import { create } from 'zustand'
import type { Move, Position } from '../chess/types'
import { START_FEN, fromFEN } from '../chess/fen'
import { makeMove } from '../chess/position'
import { moveFromICCS, moveToICCS } from '../chess/notation'
import type { Exploration } from '../api/client'
import { getExploration, saveExploration } from '../offline/repo'
import type { QipuRecord } from '../qipu/format'
import { qipuToVariationTree } from '../qipu/format'

export interface VariationNode {
  id: string
  move: string | null // ICCS；根节点为 null
  note: string
  children: VariationNode[] // children[0] 为主线
}

export interface VariationTree {
  rootFen: string
  root: VariationNode
  currentNodeId?: string
}

export function newTree(rootFen: string): VariationTree {
  return { rootFen, root: { id: crypto.randomUUID(), move: null, note: '', children: [] } }
}

// 根到目标节点的路径（含两端）；找不到返回 null
export function findPath(root: VariationNode, id: string): VariationNode[] | null {
  if (root.id === id) return [root]
  for (const child of root.children) {
    const sub = findPath(child, id)
    if (sub) return [root, ...sub]
  }
  return null
}

function findParent(root: VariationNode, id: string): VariationNode | null {
  for (const child of root.children) {
    if (child.id === id) return root
    const found = findParent(child, id)
    if (found) return found
  }
  return null
}

function mainlineLeafId(root: VariationNode): string {
  let node = root
  while (node.children.length > 0) {
    node = node.children[0]
  }
  return node.id
}

export function appendLineToNode(
  tree: VariationTree,
  nodeId: string,
  moves: string[],
): { tree: VariationTree; currentNodeId: string; changed: boolean } | null {
  const path = findPath(tree.root, nodeId)
  if (!path) return null
  let node = path[path.length - 1]
  let changed = false

  for (const move of moves) {
    const existing = node.children.find((child) => child.move === move)
    if (existing) {
      node = existing
      continue
    }
    const child: VariationNode = { id: crypto.randomUUID(), move, note: '', children: [] }
    node.children.push(child)
    node = child
    changed = true
  }

  return { tree: { ...tree }, currentNodeId: node.id, changed }
}

export function resumeNodeId(tree: VariationTree): string {
  return tree.currentNodeId && findPath(tree.root, tree.currentNodeId)
    ? tree.currentNodeId
    : mainlineLeafId(tree.root)
}

// 沿路径重放得到局面
export function positionAt(tree: VariationTree, nodeId: string): Position {
  const path = findPath(tree.root, nodeId) ?? [tree.root]
  let pos = fromFEN(tree.rootFen)
  for (const node of path) {
    if (node.move) pos = makeMove(pos, moveFromICCS(node.move))
  }
  return pos
}

interface ExploreState {
  id: string
  title: string
  gameId: string | null
  tree: VariationTree
  currentNodeId: string
  dirty: boolean
  loading: boolean
  saving: boolean
  error: string | null
  createdAt: number
  persisted: boolean
  fresh: (rootFen?: string, gameId?: string | null) => void
  loadQipu: (qipu: QipuRecord) => void
  load: (id: string) => Promise<void>
  setTitle: (t: string) => void
  playMove: (m: Move) => void
  goto: (nodeId: string) => void
  gotoParent: () => void
  setNote: (nodeId: string, note: string) => void
  promote: (nodeId: string) => void
  deleteSubtree: (nodeId: string) => void
  save: () => Promise<void>
}

export const useExploreStore = create<ExploreState>((set, get) => ({
  id: crypto.randomUUID(),
  title: '',
  gameId: null,
  tree: newTree(START_FEN),
  currentNodeId: '',
  dirty: false,
  loading: false,
  saving: false,
  error: null,
  createdAt: Date.now(),
  persisted: false,

  fresh: (rootFen = START_FEN, gameId = null) => {
    const tree = newTree(rootFen)
    set({
      id: crypto.randomUUID(),
      title: '',
      gameId,
      tree,
      currentNodeId: tree.root.id,
      dirty: false,
      loading: false,
      saving: false,
      error: null,
      createdAt: Date.now(),
      persisted: false,
    })
  },

  loadQipu: (qipu) => {
    try {
      const tree = qipuToVariationTree(qipu)
      set({
        id: crypto.randomUUID(),
        title: qipu.title,
        gameId: null,
        tree,
        currentNodeId: tree.root.id,
        dirty: true,
        loading: false,
        saving: false,
        error: null,
        createdAt: Date.now(),
        persisted: false,
      })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  load: async (id) => {
    set({ loading: true, error: null })
    try {
      const e = await getExploration(id)
      if (!e) throw new Error('推演不存在（可能尚未同步到本机）')
      const tree = e.tree as VariationTree
      const currentNodeId = resumeNodeId(tree)
      set({
        id: e.id,
        title: e.title,
        gameId: e.gameId ?? null,
        tree,
        currentNodeId,
        dirty: false,
        loading: false,
        createdAt: e.createdAt,
        persisted: true,
      })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  setTitle: (title) => set({ title, dirty: true }),

  playMove: (m) => {
    const { tree, currentNodeId, dirty } = get()
    const path = findPath(tree.root, currentNodeId)
    if (!path) return
    const node = path[path.length - 1]
    const iccs = moveToICCS(m)
    const existing = node.children.find((c) => c.move === iccs)
    if (existing) {
      set({ currentNodeId: existing.id, dirty: dirty || tree.currentNodeId !== existing.id })
      return
    }
    const child: VariationNode = { id: crypto.randomUUID(), move: iccs, note: '', children: [] }
    node.children.push(child)
    set({ tree: { ...tree }, currentNodeId: child.id, dirty: true })
  },

  goto: (nodeId) => {
    const { currentNodeId } = get()
    if (nodeId !== currentNodeId) set({ currentNodeId: nodeId, dirty: true })
  },

  gotoParent: () => {
    const { tree, currentNodeId } = get()
    const parent = findParent(tree.root, currentNodeId)
    if (parent) set({ currentNodeId: parent.id, dirty: true })
  },

  setNote: (nodeId, note) => {
    const { tree } = get()
    const path = findPath(tree.root, nodeId)
    if (!path) return
    path[path.length - 1].note = note
    set({ tree: { ...tree }, dirty: true })
  },

  promote: (nodeId) => {
    const { tree } = get()
    const parent = findParent(tree.root, nodeId)
    if (!parent) return
    const idx = parent.children.findIndex((c) => c.id === nodeId)
    if (idx > 0) {
      const [node] = parent.children.splice(idx, 1)
      parent.children.unshift(node)
      set({ tree: { ...tree }, dirty: true })
    }
  },

  deleteSubtree: (nodeId) => {
    const { tree, currentNodeId } = get()
    const parent = findParent(tree.root, nodeId)
    if (!parent) return
    parent.children = parent.children.filter((c) => c.id !== nodeId)
    const stillThere = findPath(tree.root, currentNodeId)
    set({
      tree: { ...tree },
      currentNodeId: stillThere ? currentNodeId : parent.id,
      dirty: true,
    })
  },

  save: async () => {
    const s = get()
    set({ saving: true, error: null })
    try {
      const payload: Exploration = {
        id: s.id,
        title: s.title || '未命名推演',
        rootFen: s.tree.rootFen,
        gameId: s.gameId ?? undefined,
        tree: { ...s.tree, currentNodeId: s.currentNodeId },
        createdAt: s.createdAt,
        updatedAt: Date.now(),
        deleted: false,
      }
      await saveExploration(payload)
      set({
        saving: false,
        dirty: false,
        title: payload.title,
        tree: payload.tree as VariationTree,
        persisted: true,
      })
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : String(err) })
    }
  },
}))
