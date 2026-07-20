import { type Tree, Node } from "web-tree-sitter";

const goTypeToTypeScript: Record<string, string> = {
  string: "string",
  bool: "boolean",

  int: "number",
  int8: "number",
  int16: "number",
  int32: "number",
  int64: "number",

  uint: "number",
  uint8: "number",
  uint16: "number",
  uint32: "number",
  uint64: "number",
  uintptr: "number",

  float32: "number",
  float64: "number",

  byte: "number",
  rune: "number",

  any: "unknown",
};

function findNodes(root: Node, type: string): Node[] {
  const results: Node[] = [];

  walk(root, (node) => {
    if (node.type === type) {
      results.push(node);
    }
  });

  return results;
}

function convertGoType(node: Node): string {
  const sourceType = node.text.trim();

  const primitive = goTypeToTypeScript[sourceType];

  if (primitive) {
    return primitive;
  }

  switch (node.type) {
    case "slice_type": {
      const elementType = node.namedChildren.at(-1);

      if (!elementType) {
        return "unknown[]";
      }

      return `${convertGoType(elementType)}[]`;
    }

    case "array_type": {
      const elementType = node.namedChildren.at(-1);

      if (!elementType) {
        return "unknown[]";
      }

      return `${convertGoType(elementType)}[]`;
    }

    case "pointer_type": {
      const pointedType = node.namedChildren.at(-1);

      if (!pointedType) {
        return "unknown";
      }

      return `${convertGoType(pointedType)} | null`;
    }

    case "map_type": {
      const keyNode = node.namedChildren[0];
      const valueNode = node.namedChildren[1];

      if (!keyNode || !valueNode) {
        return "Record<string, unknown>";
      }

      const keyType = convertGoType(keyNode);
      const valueType = convertGoType(valueNode);

      return `Record<${keyType}, ${valueType}>`;
    }

    case "interface_type":
      return "unknown";

    default:
      // custom Go type handle or sum
      return sourceType;
  }
}

function convertField(node: Node): string[] {
  const fieldNames = node.namedChildren.filter(
    (child) => child.type === "field_identifier",
  );

  const typeNode = node.namedChildren.find(
    (child) => child.type !== "field_identifier",
  );

  if (!typeNode) {
    return [];
  }

  const tsType = convertGoType(typeNode);

  return fieldNames.map((field) => `  ${field.text}: ${tsType};`);
}

function convertTypeSpec(node: Node): string | null {
  const nameNode =
    node.childForFieldName("name") ??
    node.namedChildren.find((child) => child.type === "type_identifier");

  const structNode =
    node.childForFieldName("type") ??
    node.namedChildren.find((child) => child.type === "struct_type");

  if (!nameNode || !structNode) {
    return null;
  }

  if (structNode.type !== "struct_type") {
    return null;
  }

  const fieldNodes = findNodes(structNode, "field_declaration");

  const fields = fieldNodes.flatMap(convertField);

  return [`export interface ${nameNode.text} {`, ...fields, "}"].join("\n");
}

function walk(node: Node, callback: (node: Node) => void): void {
  callback(node);

  for (const child of node.namedChildren) {
    walk(child, callback);
  }
}

export function toTs(tree: Tree): string {
  if (tree.rootNode.hasError) {
    return "// Go source contains a syntax error";
  }

  const typeSpecs = findNodes(tree.rootNode, "type_spec");

  const declarations = typeSpecs
    .map(convertTypeSpec)
    .filter((value): value is string => value !== null);

  if (declarations.length === 0) {
    return "// No Go structs found";
  }

  return declarations.join("\n\n");
}
