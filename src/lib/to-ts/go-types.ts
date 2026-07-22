import type { Node } from "web-tree-sitter";

const goTypeToTypeScript: Record<string, string> = {
  string: "string",
  bool: "boolean",

  int: "number",
  int8: "number",
  int16: "number",
  int32: "number",
  int64: "string",

  uint: "number",
  uint8: "number",
  uint16: "number",
  uint32: "number",
  uint64: "string",

  uintptr: "number",
  float32: "number",
  float64: "number",
  byte: "number",
  rune: "number",
  any: "unknown",

  "time.Time": "string",
  "time.Duration": "number",
  "json.RawMessage": "unknown",
  "net.IP": "string",
  "url.URL": "string",
};

interface NullTypeDefinition {
  goType: string;
  tsName: string;
  valueField: string;
  valueType: string;
  functionName: string;
}

const nullTypeDefinitions: NullTypeDefinition[] = [
  {
    goType: "sql.NullString",
    tsName: "NullString",
    valueField: "String",
    valueType: "string",
    functionName: "nullStringValue",
  },
  {
    goType: "sql.NullBool",
    tsName: "NullBool",
    valueField: "Bool",
    valueType: "boolean",
    functionName: "nullBoolValue",
  },
  {
    goType: "sql.NullInt64",
    tsName: "NullInt64",
    valueField: "Int64",
    valueType: "string",
    functionName: "nullInt64Value",
  },
  {
    goType: "sql.NullFloat64",
    tsName: "NullFloat64",
    valueField: "Float64",
    valueType: "number",
    functionName: "nullFloat64Value",
  },
  {
    goType: "sql.NullTime",
    tsName: "NullTime",
    valueField: "Time",
    valueType: "string",
    functionName: "nullTimeValue",
  },
];

const nullTypeByGoType = new Map<string, NullTypeDefinition>(
  nullTypeDefinitions.map((definition) => [definition.goType, definition]),
);

export function convertGoType(node: Node): string {
  const sourceType = node.text.trim();

  const nullType = nullTypeByGoType.get(sourceType);
  if (nullType) {
    return nullType.tsName;
  }

  const mappedType = goTypeToTypeScript[sourceType];
  if (mappedType) {
    return mappedType;
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

export function convertNullTypes(): string[] {
  return nullTypeDefinitions.flatMap(
    ({ tsName, valueField, valueType, functionName }) => [
      `export interface ${tsName} {
  ${valueField}: ${valueType};
  Valid: boolean;
}`,
      `export function ${functionName}(value: ${tsName}): ${valueType} | null {
  return value.Valid ? value.${valueField} : null;
}`,
    ],
  );
}
