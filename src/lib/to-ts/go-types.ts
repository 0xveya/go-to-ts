import type { Node } from "web-tree-sitter";

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

export function convertGoType(node: Node): string {
  const sourceType = node.text.trim();
  const primitiveType = goTypeToTypeScript[sourceType];

  if (primitiveType) {
    return primitiveType;
  }

  switch (node.type) {
    case "slice_type":
    case "array_type": {
      const elementType = node.namedChildren.at(-1);
      return elementType ? `${convertGoType(elementType)}[]` : "unknown[]";
    }
    case "pointer_type": {
      const pointedType = node.namedChildren.at(-1);
      return pointedType ? `${convertGoType(pointedType)} | null` : "unknown";
    }
    case "map_type": {
      const keyNode = node.namedChildren[0];
      const valueNode = node.namedChildren[1];

      if (!keyNode || !valueNode) {
        return "Record<string, unknown>";
      }

      return `Record<${convertGoType(keyNode)}, ${convertGoType(valueNode)}>`;
    }
    case "interface_type":
      return "unknown";
    default:
      return sourceType;
  }
}
