import en from "@/messages/en.json";
import es from "@/messages/es.json";

type Tree = Record<string, unknown>;

function paths(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" ? paths(value as Tree, path) : [path];
  });
}

const placeholders = (message: string) =>
  [...message.matchAll(/\{(\w+)[,}]/g)].map((match) => match[1]).sort();

describe("messages", () => {
  const enPaths = paths(en);
  const esPaths = paths(es);

  it("has the same keys in every locale", () => {
    expect(esPaths.sort()).toEqual([...enPaths].sort());
  });

  it("keeps the same ICU arguments per key", () => {
    const flat = (tree: Tree) =>
      Object.fromEntries(
        paths(tree).map((path) => [
          path,
          path.split(".").reduce<unknown>((node, part) => (node as Tree)[part], tree),
        ]),
      );
    const enFlat = flat(en);
    const esFlat = flat(es);
    for (const path of enPaths) {
      expect(placeholders(String(esFlat[path])), path).toEqual(placeholders(String(enFlat[path])));
    }
  });

  it("has no empty strings", () => {
    for (const tree of [en, es]) {
      for (const path of paths(tree)) {
        const value = path.split(".").reduce<unknown>((node, part) => (node as Tree)[part], tree);
        expect(String(value).trim().length, path).toBeGreaterThan(0);
      }
    }
  });
});
