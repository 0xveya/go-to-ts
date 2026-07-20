import type { Node } from "web-tree-sitter";
import { printConstValue, type ResolvedConst } from "./constants";

export function getEnumTypeNames(typeDeclarations: Node[]): Set<string> {
  const names = new Set<string>();
  const allowedUnderlyingTypes = new Set([
    "string",
    "int",
    "int8",
    "int16",
    "int32",
    "int64",
    "uint",
    "uint8",
    "uint16",
    "uint32",
    "uint64",
    "uintptr",
    "byte",
    "rune",
  ]);

  for (const declaration of typeDeclarations) {
    const nameNode = declaration.childForFieldName("name");
    const typeNode = declaration.childForFieldName("type");
    if (
      nameNode &&
      typeNode &&
      declaration.type === "type_spec" &&
      allowedUnderlyingTypes.has(typeNode.text.trim())
    )
      names.add(nameNode.text);
  }

  return names;
}

export function convertResolvedEnums(
  constants: ResolvedConst[],
  enumTypeNames: Set<string>,
): {
  declarations: string[];
  enumNames: Set<string>;
  enumConstants: Set<ResolvedConst>;
} {
  const grouped = new Map<string, ResolvedConst[]>();

  for (const constant of constants) {
    if (!constant.typeName || !enumTypeNames.has(constant.typeName)) continue;
    const members = grouped.get(constant.typeName) ?? [];
    members.push(constant);
    grouped.set(constant.typeName, members);
  }

  const declarations: string[] = [];
  const enumNames = new Set<string>();
  const enumConstants = new Set<ResolvedConst>();

  for (const [typeName, members] of grouped) {
    enumNames.add(typeName);
    members.forEach((member) => enumConstants.add(member));
    declarations.push(
      [
        `export enum ${typeName} {`,
        ...members.map(
          (member) => `  ${member.name} = ${printConstValue(member.value)},`,
        ),
        "}",
      ].join("\n"),
    );
  }

  return { declarations, enumNames, enumConstants };
}
