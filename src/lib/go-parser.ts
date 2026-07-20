import { Language, type Node, Parser, type Tree } from "web-tree-sitter";

let parserPromise: Promise<Parser> | undefined;

function publicAsset(name: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  return `${base}${name}`;
}

export function getGoParser(): Promise<Parser> {
  parserPromise ??= (async () => {
    await Parser.init({
      locateFile: () => publicAsset("web-tree-sitter.wasm"),
    });

    const go = await Language.load(publicAsset("tree-sitter-go.wasm"));
    const parser = new Parser();
    parser.setLanguage(go);
    return parser;
  })();

  return parserPromise;
}

function findSyntaxError(node: Node): Node | undefined {
  if (node.isError || node.isMissing) {
    return node;
  }

  for (const child of node.children) {
    const error = findSyntaxError(child);

    if (error) {
      return error;
    }
  }

  return undefined;
}

export async function parseGo(source: string): Promise<Tree> {
  const parser = await getGoParser();
  // treat EOF as a line ending so the go parser doenst throw an err
  // bc it needs it so it knows that the thing eneded
  const parserSource = source.endsWith("\n") ? source : `${source}\n`;
  const tree = parser.parse(parserSource);

  if (!tree) {
    throw new Error("Tree-sitter could not parse the Go source");
  }

  if (tree.rootNode.hasError) {
    const errorNode = findSyntaxError(tree.rootNode);
    const location = errorNode
      ? ` at line ${errorNode.startPosition.row + 1}, column ${
          errorNode.startPosition.column + 1
        }`
      : "";

    tree.delete();
    throw new Error(`Invalid Go syntax${location}`);
  }

  return tree;
}
