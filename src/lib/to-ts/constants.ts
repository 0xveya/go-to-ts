import type { Node } from "web-tree-sitter";
import { findNodes } from "./tree";

export type ConstValue = bigint | number | string | boolean;
type ConstSymbols = Map<string, ConstValue>;

export type ResolvedConst = {
  name: string;
  typeName: string | null;
  value: ConstValue;
};

type ConstBlockState = {
  previousTypeNode: Node | null;
  previousExpressionNodes: Node[];
};

function evaluateConstExpression(
  node: Node,
  iota: number,
  symbols: ConstSymbols,
): ConstValue | null {
  switch (node.type) {
    case "iota":
      return BigInt(iota);
    case "identifier":
      if (node.text === "iota") return BigInt(iota);
      if (node.text === "true") return true;
      if (node.text === "false") return false;
      return symbols.get(node.text) ?? null;
    case "int_literal":
      return parseGoInteger(node.text);
    case "float_literal": {
      const value = Number(node.text.replaceAll("_", ""));
      return Number.isNaN(value) ? null : value;
    }
    case "interpreted_string_literal":
      return parseGoString(node.text);
    case "raw_string_literal":
      return node.text.slice(1, -1);
    case "true":
      return true;
    case "false":
      return false;
    case "parenthesized_expression": {
      const expression = node.namedChildren[0];
      return expression
        ? evaluateConstExpression(expression, iota, symbols)
        : null;
    }
    case "unary_expression":
      return evaluateUnaryExpression(node, iota, symbols);
    case "binary_expression":
      return evaluateBinaryExpression(node, iota, symbols);
    default:
      return null;
  }
}

function evaluateUnaryExpression(
  node: Node,
  iota: number,
  symbols: ConstSymbols,
): bigint | number | null {
  const operandNode = node.namedChildren[0];
  const operator = getOperator(node);
  if (!operandNode || !operator) return null;

  const operand = evaluateConstExpression(operandNode, iota, symbols);
  if (typeof operand !== "number" && typeof operand !== "bigint") return null;

  if (operator === "+") return operand;
  if (operator === "-") return -operand;
  if (operator === "^") return typeof operand === "bigint" ? ~operand : null;
  return null;
}

function evaluateBinaryExpression(
  node: Node,
  iota: number,
  symbols: ConstSymbols,
): ConstValue | null {
  const leftNode = node.childForFieldName("left") ?? node.namedChildren[0];
  const rightNode = node.childForFieldName("right") ?? node.namedChildren[1];
  const operator = getOperator(node);
  if (!leftNode || !rightNode || !operator) return null;

  const left = evaluateConstExpression(leftNode, iota, symbols);
  const right = evaluateConstExpression(rightNode, iota, symbols);

  if (
    operator === "+" &&
    typeof left === "string" &&
    typeof right === "string"
  ) {
    return left + right;
  }

  if (
    (typeof left !== "number" && typeof left !== "bigint") ||
    (typeof right !== "number" && typeof right !== "bigint")
  )
    return null;

  if (typeof left !== typeof right) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (!Number.isSafeInteger(leftNumber) || !Number.isSafeInteger(rightNumber))
      return null;
    return evaluateNumericBinary(leftNumber, rightNumber, operator);
  }

  return evaluateNumericBinary(left, right, operator);
}

function evaluateNumericBinary(
  left: bigint | number,
  right: bigint | number,
  operator: string,
): bigint | number | null {
  if (typeof left === "bigint" && typeof right === "bigint") {
    switch (operator) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return right === 0n ? null : left / right;
      case "%":
        return right === 0n ? null : left % right;
      case "<<":
        return right < 0n ? null : left << right;
      case ">>":
        return right < 0n ? null : left >> right;
      case "|":
        return left | right;
      case "&":
        return left & right;
      case "^":
        return left ^ right;
      case "&^":
        return left & ~right;
      default:
        return null;
    }
  }

  if (typeof left !== "number" || typeof right !== "number") return null;
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return right === 0 ? null : left / right;
    case "%":
      return right === 0 ? null : left % right;
    case "<<":
      return left * 2 ** right;
    case ">>":
      return Math.floor(left / 2 ** right);
    default:
      return null;
  }
}

function getOperator(node: Node): string | null {
  const supported = new Set([
    "+",
    "-",
    "*",
    "/",
    "%",
    "<<",
    ">>",
    "|",
    "&",
    "^",
    "&^",
  ]);
  return node.children.find((child) => supported.has(child.text))?.text ?? null;
}

function parseGoInteger(text: string): bigint | null {
  try {
    return BigInt(text.replaceAll("_", ""));
  } catch {
    return null;
  }
}

function parseGoString(text: string): string | null {
  try {
    return JSON.parse(text) as string;
  } catch {
    return null;
  }
}

function getConstNames(node: Node): Node[] {
  return node.namedChildren.filter((child) => child.type === "identifier");
}

function getConstType(node: Node): Node | null {
  return (
    node.childForFieldName("type") ??
    node.namedChildren.find((child) =>
      [
        "type_identifier",
        "qualified_type",
        "pointer_type",
        "slice_type",
        "array_type",
        "map_type",
      ].includes(child.type),
    ) ??
    null
  );
}

function isConstExpressionNode(node: Node): boolean {
  return [
    "identifier",
    "iota",
    "int_literal",
    "float_literal",
    "interpreted_string_literal",
    "raw_string_literal",
    "true",
    "false",
    "parenthesized_expression",
    "unary_expression",
    "binary_expression",
  ].includes(node.type);
}

function getConstExpressions(node: Node): Node[] {
  const expressionList = node.namedChildren.find(
    (child) => child.type === "expression_list",
  );
  if (expressionList) return expressionList.namedChildren;

  const typeNode = getConstType(node);
  const names = new Set(getConstNames(node).map((child) => child.id));
  return node.namedChildren.filter(
    (child) =>
      !names.has(child.id) &&
      (!typeNode || child.id !== typeNode.id) &&
      isConstExpressionNode(child),
  );
}

export function resolveConstBlock(
  node: Node,
  symbols: ConstSymbols,
): ResolvedConst[] {
  const constSpecs = findNodes(node, "const_spec").sort(
    (a, b) => a.startIndex - b.startIndex,
  );
  const results: ResolvedConst[] = [];
  const state: ConstBlockState = {
    previousTypeNode: null,
    previousExpressionNodes: [],
  };

  for (let iota = 0; iota < constSpecs.length; iota++) {
    const constSpec = constSpecs[iota];
    const nameNodes = getConstNames(constSpec);
    const explicitTypeNode = getConstType(constSpec);
    const explicitExpressionNodes = getConstExpressions(constSpec);
    const inheritsPreviousSpec =
      !explicitTypeNode && explicitExpressionNodes.length === 0;
    const typeNode = inheritsPreviousSpec
      ? state.previousTypeNode
      : explicitTypeNode;
    const expressionNodes = inheritsPreviousSpec
      ? state.previousExpressionNodes
      : explicitExpressionNodes;

    if (explicitTypeNode || explicitExpressionNodes.length > 0) {
      state.previousTypeNode = explicitTypeNode;
      state.previousExpressionNodes = explicitExpressionNodes;
    }

    for (let index = 0; index < nameNodes.length; index++) {
      const expressionNode = expressionNodes[index];
      if (!expressionNode) continue;
      const value = evaluateConstExpression(expressionNode, iota, symbols);
      if (value === null) continue;
      const constant = {
        name: nameNodes[index].text,
        typeName: typeNode?.text.trim() ?? null,
        value,
      };
      results.push(constant);
      symbols.set(constant.name, value);
    }
  }

  return results;
}

export function printConstValue(value: ConstValue): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

export function convertStandaloneConst(constant: ResolvedConst): string {
  const typeAnnotation = constant.typeName ? `: ${constant.typeName}` : "";
  return `export const ${constant.name}${typeAnnotation} = ${printConstValue(constant.value)};`;
}
