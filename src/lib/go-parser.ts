import { Language, Parser } from "web-tree-sitter";
import { type Tree } from "web-tree-sitter";

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

export async function parseGo(source: string): Promise<Tree> {
  const parser = await getGoParser();

  const tree = parser.parse(source);

  if (!tree) {
    throw new Error("Tree-sitter could not parse the Go source");
  }

  return tree;
}
