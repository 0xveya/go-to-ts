import type { Node } from "web-tree-sitter";

function walk(node: Node, callback: (node: Node) => void): void {
  callback(node);

  for (const child of node.namedChildren) {
    walk(child, callback);
  }
}

export function findNodes(root: Node, type: string): Node[] {
  const results: Node[] = [];

  walk(root, (node) => {
    if (node.type === type) {
      results.push(node);
    }
  });

  return results;
}
