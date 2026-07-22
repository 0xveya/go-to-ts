import type { Node } from "web-tree-sitter";
import { convertGoType } from "./go-types";

function convertField(node: Node): string[] {
  const fieldNames = node.namedChildren.filter(
    (child) => child.type === "field_identifier",
  );

  const typeNode = node.namedChildren.find(
    (child) =>
      child.type !== "field_identifier" && child.type !== "raw_string_literal",
  );

  if (!typeNode) {
    return [];
  }

  const jsonTag = getStructTags(node).get("json");
  const tsType = convertGoType(typeNode);

  return fieldNames.flatMap((field) => {
    if (jsonTag?.ignored) {
      return [];
    }

    const fieldName = jsonTag?.name || field.text;
    const optional = jsonTag?.options.has("omitempty") ? "?" : "";

    return [`  ${fieldName}${optional}: ${tsType};`];
  });
}

interface StructTag {
  name: string;
  options: Set<string>;
  ignored: boolean;
}

type StructTags = Map<string, StructTag>;

function parseStructTags(tag: string): StructTags {
  const tags: StructTags = new Map();
  const text = tag.replace(/^`|`$/g, "");

  for (const [, key, value] of text.matchAll(/(\w+):"([^"]*)"/g)) {
    const [name, ...options] = value.split(",");

    tags.set(key, {
      name,
      options: new Set(options),
      ignored: name === "-",
    });
  }

  return tags;
}

function getStructTags(node: Node): StructTags {
  const tagNode = node.namedChildren.find(
    (child) => child.type === "raw_string_literal",
  );

  return tagNode ? parseStructTags(tagNode.text) : new Map();
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
