package api

import (
	"encoding/json"
	"fmt"

	"chess/backend/internal/store"
	"chess/backend/internal/chess"
)

type variationTree struct {
	RootFEN       string        `json:"rootFen"`
	Root          variationNode `json:"root"`
	CurrentNodeID string        `json:"currentNodeId,omitempty"`
}

type variationNode struct {
	ID       string          `json:"id"`
	Move     *string         `json:"move"`
	Note     string          `json:"note"`
	Children []variationNode `json:"children"`
}

func ensureGameTree(g *store.Game) {
	if len(g.Tree) > 0 && string(g.Tree) != "null" {
		return
	}
	var moves []string
	if len(g.Moves) > 0 {
		_ = json.Unmarshal(g.Moves, &moves)
	}
	tree := treeFromLine(g.ID, g.InitialFEN, moves)
	raw, err := json.Marshal(tree)
	if err == nil {
		g.Tree = raw
	}
}

func treeFromLine(id string, rootFEN string, moves []string) variationTree {
	if rootFEN == "" {
		rootFEN = chess.StartFEN
	}
	prefix := "game:" + id
	root := variationNode{
		ID:       prefix + ":root",
		Move:     nil,
		Note:     "",
		Children: []variationNode{},
	}
	node := &root
	for i, move := range moves {
		moveCopy := move
		child := variationNode{
			ID:       fmt.Sprintf("%s:m.%d", prefix, i+1),
			Move:     &moveCopy,
			Note:     "",
			Children: []variationNode{},
		}
		node.Children = append(node.Children, child)
		node = &node.Children[len(node.Children)-1]
	}
	return variationTree{RootFEN: rootFEN, Root: root, CurrentNodeID: root.ID}
}
