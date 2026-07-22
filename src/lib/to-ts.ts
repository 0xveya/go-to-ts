import type { Tree } from "web-tree-sitter";
import {
  convertStandaloneConst,
  resolveConstBlock,
  type ConstValue,
} from "./to-ts/constants";
import { convertResolvedEnums, getEnumTypeNames } from "./to-ts/enums";
import { convertNullTypes } from "./to-ts/go-types";
import { findNodes } from "./to-ts/tree";
import { convertTypeDeclaration } from "./to-ts/types";

export function toTs(tree: Tree): string {
  if (tree.rootNode.hasError) {
    return "// Go source contains a syntax error";
  }

  const constBlocks = findNodes(tree.rootNode, "const_declaration").sort(
    (left, right) => left.startIndex - right.startIndex,
  );

  const typeDeclarations = [
    ...findNodes(tree.rootNode, "type_spec"),
    ...findNodes(tree.rootNode, "type_alias"),
  ].sort((left, right) => left.startIndex - right.startIndex);

  const symbols = new Map<string, ConstValue>();

  const resolvedConstants = constBlocks.flatMap((block) =>
    resolveConstBlock(block, symbols),
  );

  const {
    declarations: enumDeclarations,
    enumNames,
    enumConstants,
  } = convertResolvedEnums(
    resolvedConstants,
    getEnumTypeNames(typeDeclarations),
  );

  const convertedTypes = typeDeclarations
    .map((node) => convertTypeDeclaration(node, enumNames))
    .filter((value): value is string => value !== null);

  const standaloneConstants = resolvedConstants
    .filter((constant) => !enumConstants.has(constant))
    .map(convertStandaloneConst);

  const nullTypeDeclarations = convertNullTypes();

  const declarations = [
    ...nullTypeDeclarations,
    ...convertedTypes,
    ...enumDeclarations,
    ...standaloneConstants,
  ];

  return declarations.length > 0
    ? declarations.join("\n\n")
    : "// No supported Go declarations found";
}
