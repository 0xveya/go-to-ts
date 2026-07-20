import type { Node } from "web-tree-sitter";
import { convertGoType } from "./go-types";

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

function convertStructType(nameNode: Node, structNode: Node): string {
  const fields = structNode.namedChildren
    .filter((child) => child.type === "field_declaration_list")
    .flatMap((fieldList) => fieldList.namedChildren)
    .filter((child) => child.type === "field_declaration")
    .flatMap(convertField);

  return [`export interface ${nameNode.text} {`, ...fields, "}"].join("\n");
}

export function convertTypeDeclaration(
  node: Node,
  enumNames: Set<string>,
): string | null {
  const nameNode = node.childForFieldName("name");
  const typeNode = node.childForFieldName("type");

  if (!nameNode || !typeNode) {
    return null;
  }

  if (typeNode.type === "struct_type") {
    return convertStructType(nameNode, typeNode);
  }

  if (enumNames.has(nameNode.text)) {
    return null;
  }

  return `export type ${nameNode.text} = ${convertGoType(typeNode)};`;
}
