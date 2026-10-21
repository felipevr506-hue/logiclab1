import ts from "typescript";
import type { Exercise, AttemptTestSnapshot } from "@/lib/types";

export type Assessment = {
  status: "verified" | "failed" | "pending";
  passed: boolean;
  tests: AttemptTestSnapshot[];
  message: string;
};

/** No eval, Function, vm, subprocess, imports or execution of submitted JavaScript. */
function syntaxTree(source: string) {
  if (source.length > 20_000) throw new Error("unsupported");
  const tree = ts.createSourceFile(
    "answer.js",
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.JS,
  );
  const diagnostics = (
    tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
  ).parseDiagnostics;
  if (diagnostics.length) throw new SyntaxError("syntax");
  let count = 0;
  function fingerprint(node: ts.Node, depth = 0): unknown {
    if (++count > 6000 || depth > 70) throw new Error("unsupported");
    const children: unknown[] = [];
    ts.forEachChild(node, (child) => {
      children.push(fingerprint(child, depth + 1));
    });
    return [
      node.kind,
      ts.isIdentifier(node)
        ? node.text
        : ts.isStringLiteralLike(node) ||
            ts.isNumericLiteral(node) ||
            ts.isTemplateHead(node) ||
            ts.isTemplateMiddle(node) ||
            ts.isTemplateTail(node)
          ? node.text
          : children.length === 0
            ? node.getText(tree)
            : null,
      ts.isVariableDeclarationList(node)
        ? node.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)
        : 0,
      children,
    ];
  }
  return { tree, fingerprint: JSON.stringify(fingerprint(tree)) };
}

type Scalar = string | number | boolean | undefined | null;
/** Constant folding only: declarations of primitive constants and console.log of primitive expressions. */
function foldConstants(tree: ts.SourceFile, allowedBindings: Set<string>) {
  const values = new Map<string, Scalar>();
  const logs: string[] = [];
  let budget = 1500;
  function value(node: ts.Expression): Scalar {
    if (--budget < 0) throw new Error("unsupported");
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isParenthesizedExpression(node)) return value(node.expression);
    if (ts.isIdentifier(node) && values.has(node.text))
      return values.get(node.text);
    if (ts.isTypeOfExpression(node)) {
      if (ts.isIdentifier(node.expression) && !values.has(node.expression.text))
        throw new Error("unsupported");
      return typeof value(node.expression);
    }
    if (ts.isPrefixUnaryExpression(node)) {
      const operand = value(node.operand);
      if (node.operator === ts.SyntaxKind.ExclamationToken) return !operand;
      if (
        typeof operand === "number" &&
        node.operator === ts.SyntaxKind.MinusToken
      )
        return -operand;
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      const left = value(node.left),
        right = value(node.right);
      if (typeof left === "string" || typeof right === "string")
        return String(left) + String(right);
      if (typeof left === "number" && typeof right === "number")
        return left + right;
    }
    if (ts.isTemplateExpression(node)) {
      let result = node.head.text;
      for (const span of node.templateSpans)
        result += String(value(span.expression)) + span.literal.text;
      return result;
    }
    throw new Error("unsupported");
  }
  for (const statement of tree.statements) {
    if (ts.isEmptyStatement(statement)) continue;
    if (ts.isVariableStatement(statement)) {
      if (
        statement.modifiers?.length ||
        statement.declarationList.flags & ts.NodeFlags.Using
      )
        throw new Error("unsupported");
      for (const declaration of statement.declarationList.declarations) {
        if (
          !ts.isIdentifier(declaration.name) ||
          !allowedBindings.has(declaration.name.text) ||
          !declaration.initializer ||
          declaration.type ||
          declaration.exclamationToken ||
          values.has(declaration.name.text) ||
          ["console", "undefined"].includes(declaration.name.text)
        )
          throw new Error("unsupported");
        values.set(declaration.name.text, value(declaration.initializer));
      }
      continue;
    }
    if (
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression)
    ) {
      const call = statement.expression;
      if (
        ts.isPropertyAccessExpression(call.expression) &&
        ts.isIdentifier(call.expression.expression) &&
        call.expression.expression.text === "console" &&
        call.expression.name.text === "log" &&
        !call.questionDotToken &&
        !call.typeArguments?.length
      ) {
        logs.push(
          call.arguments.map((argument) => String(value(argument))).join(" "),
        );
        continue;
      }
    }
    throw new Error("unsupported");
  }
  return {
    value: (expression: string) => {
      const test = syntaxTree(expression).tree.statements[0];
      if (!test || !ts.isExpressionStatement(test))
        throw new Error("unsupported");
      return value(test.expression);
    },
    logs,
  };
}

export function assessSubmission(code: string, exercise: Exercise): Assessment {
  try {
    const parsed = syntaxTree(code);
    const reference = syntaxTree(exercise.solution);
    const homologated = parsed.fingerprint === reference.fingerprint;
    let folded: ReturnType<typeof foldConstants> | undefined;
    if (!homologated) {
      const bindings = new Set(
        reference.tree.statements.flatMap((statement) =>
          ts.isVariableStatement(statement)
            ? statement.declarationList.declarations.flatMap((declaration) =>
                ts.isIdentifier(declaration.name)
                  ? [declaration.name.text]
                  : [],
              )
            : [],
        ),
      );
      folded = foldConstants(parsed.tree, bindings);
    }
    const tests = exercise.tests.map((test) => {
      const received = homologated
        ? (test.expectedLogs ?? test.expected)
        : test.expectedLogs
          ? folded!.logs
          : folded!.value(test.expression!);
      const passed =
        homologated ||
        (test.expectedLogs
          ? test.expectedLogs.every((line) => folded!.logs.includes(line))
          : JSON.stringify(received) === JSON.stringify(test.expected));
      return {
        id: test.id,
        label: test.label,
        passed,
        expected: test.expectedLogs ?? test.expected,
        received,
        feedback: homologated
          ? "Resposta homologada reconhecida por análise estática no servidor."
          : test.feedback,
      };
    });
    const passed = tests.length > 0 && tests.every((test) => test.passed);
    return {
      status: passed ? "verified" : "failed",
      passed,
      tests,
      message: passed
        ? "Resposta validada pelo servidor."
        : "A análise estática encontrou resultados diferentes dos esperados.",
    };
  } catch (error) {
    const syntax = error instanceof SyntaxError;
    return {
      status: syntax ? "failed" : "pending",
      passed: false,
      tests: [],
      message: syntax
        ? "O código possui um erro de sintaxe."
        : "Avaliação pendente: este código exige o executor isolado de uma fase futura. Nenhum XP ou conclusão foi concedido.",
    };
  }
}
