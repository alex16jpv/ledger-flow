import type { SyncTransaction } from "@/types/api";

export type SuggestType = Extract<SyncTransaction["type"], "EXPENSE" | "INCOME" | "TRANSFER">;

export const SUGGEST_LIMIT = 5;
export const SUGGEST_ROW_CAP = 20_000;

const SUGGEST_TYPES: ReadonlySet<SyncTransaction["type"]> = new Set([
  "EXPENSE",
  "INCOME",
  "TRANSFER",
]);

export interface DescriptionSuggestion {
  text: string;
  count: number;
}

export interface TagSuggestion {
  tag: string;
  count: number;
  categoryId: string | null;
}

export interface ExcludedRow {
  type: SyncTransaction["type"];
  description: string | null;
  tags: readonly string[];
  categoryId: string | null;
}

export interface TagContext {
  categoryId: string | null;
  description: string;
  chosen: readonly string[];
}

export interface MatchSpan {
  before: string;
  match: string;
  after: string;
}

interface DescriptionEntry {
  key: string;
  text: string;
  count: number;
  lastAt: string;
}

interface TagEntry {
  tag: string;
  folded: string;
  count: number;
  lastAt: string;
  byCategory: Map<string, number>;
  byDescription: Map<string, number>;
}

interface WordStart {
  suffix: string;
  entry: DescriptionEntry;
}

interface TypeIndex {
  descriptions: Map<string, DescriptionEntry>;
  starts: WordStart[];
  tags: Map<string, TagEntry>;
}

export interface SuggestIndex {
  rows: number;
  byType: ReadonlyMap<SuggestType, TypeIndex>;
}

export interface SuggestBuilder {
  readonly rows: number;
  add: (row: SyncTransaction) => boolean;
  finish: () => SuggestIndex;
}

const MARKS = /\p{M}/gu;
const WORD_CHAR = /[\p{L}\p{N}]/u;

const isSuggestType = (type: SyncTransaction["type"]): type is SuggestType =>
  SUGGEST_TYPES.has(type);

function foldUnit(unit: string): string {
  return unit.normalize("NFD").replace(MARKS, "").toLowerCase();
}

export function fold(text: string): string {
  return foldUnit(text).trim().replace(/\s+/g, " ");
}

function foldWithMap(text: string): { folded: string; at: number[] } {
  let folded = "";
  const at: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const unit = foldUnit(text.charAt(i));
    at.push(...new Array<number>(unit.length).fill(i));
    folded += unit;
  }
  return { folded, at };
}

const isWordStart = (folded: string, i: number): boolean =>
  i === 0 || !WORD_CHAR.test(folded.charAt(i - 1));

function wordStarts(key: string): number[] {
  const starts: number[] = [];
  for (let i = 0; i < key.length; i += 1) {
    if (isWordStart(key, i) && WORD_CHAR.test(key.charAt(i))) starts.push(i);
  }
  return starts;
}

export function splitMatch(text: string, query: string): MatchSpan | null {
  const q = fold(query);
  if (!q) return null;
  const { folded, at } = foldWithMap(text);
  let from = 0;
  for (;;) {
    const i = folded.indexOf(q, from);
    if (i < 0) return null;
    if (isWordStart(folded, i)) {
      const start = at[i] ?? text.length;
      const end = at[i + q.length] ?? text.length;
      return {
        before: text.slice(0, start),
        match: text.slice(start, end),
        after: text.slice(end),
      };
    }
    from = i + 1;
  }
}

function bump(counts: Map<string, number>, key: string, by = 1): void {
  counts.set(key, (counts.get(key) ?? 0) + by);
}

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function createSuggestBuilder(cap = SUGGEST_ROW_CAP): SuggestBuilder {
  const byType = new Map<SuggestType, TypeIndex>();
  let rows = 0;
  const typeIndex = (type: SuggestType): TypeIndex => {
    let index = byType.get(type);
    if (!index) {
      index = { descriptions: new Map(), starts: [], tags: new Map() };
      byType.set(type, index);
    }
    return index;
  };
  return {
    get rows() {
      return rows;
    },
    add(row) {
      if (rows >= cap) return false;
      if (!isSuggestType(row.type)) return true;
      rows += 1;
      const index = typeIndex(row.type);
      const text = row.description?.trim() ?? "";
      const key = fold(text);
      if (key) {
        const entry = index.descriptions.get(key);
        if (!entry) index.descriptions.set(key, { key, text, count: 1, lastAt: row.date });
        else {
          entry.count += 1;
          if (row.date > entry.lastAt) {
            entry.lastAt = row.date;
            entry.text = text;
          }
        }
      }
      for (const tag of new Set(row.tags)) {
        let entry = index.tags.get(tag);
        if (!entry) {
          entry = {
            tag,
            folded: fold(tag),
            count: 0,
            lastAt: "",
            byCategory: new Map(),
            byDescription: new Map(),
          };
          index.tags.set(tag, entry);
        }
        entry.count += 1;
        if (row.date > entry.lastAt) entry.lastAt = row.date;
        if (row.categoryId) bump(entry.byCategory, row.categoryId);
        if (key) bump(entry.byDescription, key);
      }
      return true;
    },
    finish() {
      for (const index of byType.values()) {
        index.starts = [];
        for (const entry of index.descriptions.values()) {
          for (const at of wordStarts(entry.key)) {
            index.starts.push({ suffix: entry.key.slice(at), entry });
          }
        }
        index.starts.sort((a, b) => compareText(a.suffix, b.suffix));
      }
      return { rows, byType };
    },
  };
}

export function buildSuggestIndex(
  rows: Iterable<SyncTransaction>,
  cap = SUGGEST_ROW_CAP,
): SuggestIndex {
  const builder = createSuggestBuilder(cap);
  for (const row of rows) if (!builder.add(row)) break;
  return builder.finish();
}

function lowerBound(starts: readonly WordStart[], q: string): number {
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((starts[middle]?.suffix ?? "") < q) low = middle + 1;
    else high = middle;
  }
  return low;
}

interface Ranked {
  count: number;
  lastAt: string;
}

const byUseThenRecency = (a: Ranked, b: Ranked): number =>
  b.count - a.count || compareText(b.lastAt, a.lastAt);

export function suggestDescriptions(
  index: SuggestIndex,
  type: SuggestType,
  query: string,
  limit = SUGGEST_LIMIT,
  exclude?: ExcludedRow,
): DescriptionSuggestion[] {
  const q = fold(query);
  const typed = index.byType.get(type);
  if (!q || !typed) return [];
  const excludedKey = exclude?.type === type ? fold(exclude.description ?? "") : "";
  const found = new Map<string, DescriptionSuggestion & Ranked>();
  for (let i = lowerBound(typed.starts, q); i < typed.starts.length; i += 1) {
    const start = typed.starts[i];
    if (!start?.suffix.startsWith(q)) break;
    const { entry } = start;
    if (entry.key === q || found.has(entry.key)) continue;
    const count = entry.count - (entry.key === excludedKey ? 1 : 0);
    if (count > 0) found.set(entry.key, { text: entry.text, count, lastAt: entry.lastAt });
  }
  return [...found.values()]
    .sort((a, b) => byUseThenRecency(a, b) || compareText(a.text, b.text))
    .slice(0, limit)
    .map(({ text, count }) => ({ text, count }));
}

function topCategory(entry: TagEntry, excludedCategory: string | null): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [categoryId, seen] of entry.byCategory) {
    const count = seen - (categoryId === excludedCategory ? 1 : 0);
    if (count > bestCount || (count === bestCount && best !== null && categoryId < best)) {
      best = categoryId;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : null;
}

const tagMatches = (tag: string, q: string): boolean => tag.startsWith(q) || tag.includes(`-${q}`);

export function suggestTags(
  index: SuggestIndex,
  type: SuggestType,
  context: TagContext,
  query: string,
  limit = SUGGEST_LIMIT,
  exclude?: ExcludedRow,
): TagSuggestion[] {
  const q = fold(query);
  const typed = index.byType.get(type);
  if (!q || !typed) return [];
  const descriptionKey = fold(context.description);
  const excluded = exclude?.type === type ? exclude : null;
  const excludedKey = excluded ? fold(excluded.description ?? "") : "";
  const chosen = new Set(context.chosen);
  const ranked: (TagSuggestion & Ranked & { withDescription: number; withCategory: number })[] = [];
  for (const entry of typed.tags.values()) {
    if (chosen.has(entry.tag) || entry.folded === q || !tagMatches(entry.folded, q)) continue;
    const off = excluded?.tags.includes(entry.tag) ? 1 : 0;
    const count = entry.count - off;
    if (count <= 0) continue;
    const excludedCategory = off ? (excluded?.categoryId ?? null) : null;
    const withDescription = descriptionKey
      ? (entry.byDescription.get(descriptionKey) ?? 0) -
        (off && excludedKey === descriptionKey ? 1 : 0)
      : 0;
    const withCategory = context.categoryId
      ? (entry.byCategory.get(context.categoryId) ?? 0) -
        (excludedCategory === context.categoryId ? 1 : 0)
      : 0;
    ranked.push({
      tag: entry.tag,
      count,
      lastAt: entry.lastAt,
      withDescription,
      withCategory,
      categoryId: topCategory(entry, excludedCategory),
    });
  }
  return ranked
    .sort(
      (a, b) =>
        b.withDescription - a.withDescription ||
        b.withCategory - a.withCategory ||
        byUseThenRecency(a, b) ||
        compareText(a.tag, b.tag),
    )
    .slice(0, limit)
    .map(({ tag, count, categoryId }) => ({ tag, count, categoryId }));
}
