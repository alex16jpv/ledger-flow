// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import ts from "typescript";

import en from "@/messages/en.json";

import { MESSAGE_SCOPES, type MessageScope, pickMessages } from "./scopes";

const ROOT = resolve(__dirname, "../..");
const LOCALE_DIR = join(ROOT, "app/[locale]");
const SEGMENTS: Record<MessageScope, string> = {
  root: LOCALE_DIR,
  auth: join(LOCALE_DIR, "(auth)"),
  app: join(LOCALE_DIR, "(app)"),
  dev: join(LOCALE_DIR, "dev"),
};
const NAMESPACES = Object.keys(en);

interface SourceInfo {
  imports: string[];
  client: boolean;
  literals: string[];
  namespaces: string[];
  unscoped: boolean;
  dynamic: boolean;
}

const infos = new Map<string, SourceInfo>();

function resolveImport(from: string, specifier: string): string | undefined {
  let base: string;
  if (specifier.startsWith("@/")) base = join(ROOT, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return undefined;
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ];
  return candidates.find(
    (path) => /\.tsx?$/.test(path) && existsSync(path) && statSync(path).isFile(),
  );
}

function infoOf(file: string): SourceInfo {
  const known = infos.get(file);
  if (known) return known;
  const source = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const info: SourceInfo = {
    imports: ts
      .preProcessFile(source, true, true)
      .importedFiles.flatMap(({ fileName }) => resolveImport(file, fileName) ?? []),
    client: tree.statements.some(
      (statement) =>
        ts.isExpressionStatement(statement) &&
        ts.isStringLiteral(statement.expression) &&
        statement.expression.text === "use client",
    ),
    literals: [],
    namespaces: [],
    unscoped: false,
    dynamic: false,
  };
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node)) info.literals.push(node.text);
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useTranslations"
    ) {
      const [namespace] = node.arguments;
      if (!namespace) info.unscoped = true;
      else if (ts.isStringLiteralLike(namespace)) info.namespaces.push(namespace.text);
      else info.dynamic = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  infos.set(file, info);
  return info;
}

function reach(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const pending = [...entries];
  for (let file = pending.pop(); file; file = pending.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    pending.push(...infoOf(file).imports);
  }
  return seen;
}

function sources(dir: string, skip: string[]): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return skip.includes(path) ? [] : sources(path, skip);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

function neededBy(scope: MessageScope) {
  const nested = Object.values(SEGMENTS).filter((dir) => dir !== SEGMENTS[scope]);
  const everything = reach(sources(SEGMENTS[scope], nested));
  const client = [...reach([...everything].filter((file) => infoOf(file).client))];
  const unscoped = client.some((file) => infoOf(file).unscoped);
  const paths = new Set(client.flatMap((file) => infoOf(file).namespaces));
  if (unscoped) {
    for (const literal of client.flatMap((file) => infoOf(file).literals)) {
      const namespace = NAMESPACES.find((name) => literal.startsWith(`${name}.`));
      if (namespace) paths.add(namespace);
    }
  }
  const covered = (path: string, by: string) => path === by || path.startsWith(`${by}.`);
  const minimal = [...paths].filter(
    (path) => ![...paths].some((other) => other !== path && covered(path, other)),
  );
  return {
    paths: minimal.sort(),
    dynamic: client.filter((file) => infoOf(file).dynamic).map((file) => relative(ROOT, file)),
  };
}

describe("MESSAGE_SCOPES", () => {
  it.each(Object.keys(SEGMENTS) as MessageScope[])(
    "sends the %s segment exactly the messages its client code reads",
    (scope) => {
      const needed = neededBy(scope);
      expect(needed.dynamic, "a namespace passed as a variable cannot be scoped").toEqual([]);
      expect([...MESSAGE_SCOPES[scope]].sort()).toEqual(needed.paths);
    },
  );

  it.each(Object.keys(SEGMENTS) as MessageScope[])(
    "is the provider of the %s segment layout",
    (scope) => {
      const layout = readFileSync(join(SEGMENTS[scope], "layout.tsx"), "utf8");
      expect(layout).toContain(`<ScopedIntlProvider scope="${scope}">`);
    },
  );
});

describe("pickMessages", () => {
  const messages = { a: { b: "B", c: { d: "D" } }, e: "E", f: { g: "G" } };

  it("keeps only the requested subtrees, merging paths that share a parent", () => {
    expect(pickMessages(messages, ["a.c", "a.b", "e"])).toEqual({
      a: { b: "B", c: { d: "D" } },
      e: "E",
    });
  });

  it("never writes into the catalogue when a path falls inside one already picked", () => {
    const source = structuredClone(messages);
    expect(pickMessages(source, ["a", "a.c.d", "f"])).toEqual({ a: messages.a, f: messages.f });
    expect(source).toEqual(messages);
  });

  it("returns nothing for no paths", () => {
    expect(pickMessages(messages, [])).toEqual({});
  });

  it("fails loudly on a path that does not exist", () => {
    expect(() => pickMessages(messages, ["a.x"])).toThrow('no messages at "a.x"');
    expect(() => pickMessages(messages, ["e.x"])).toThrow('no messages at "e.x"');
  });

  it("resolves every declared path in the catalogue", () => {
    for (const paths of Object.values(MESSAGE_SCOPES)) {
      expect(() => pickMessages(en, paths)).not.toThrow();
    }
  });
});
