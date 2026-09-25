"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useDeferredValue, useMemo } from "react";

import type { SuggestionRow } from "@/components/ui/Suggestions";
import { normalizeTag } from "@/components/ui/TagsInput";
import type { ExcludedRow, SuggestType } from "@/lib/local/suggest/index";
import {
  type SuggestEngine,
  useSuggestEngine,
  useSuggestIndex,
} from "@/lib/local/suggest/useSuggestions";

import { useTagsQuery } from "./hooks";

export type { ExcludedRow, SuggestType };

const FALLBACK_LIMIT = 5;

function emphasised(before: string, match: string, after: string): ReactNode {
  return (
    <>
      {before}
      <span className="font-semibold">{match}</span>
      {after}
    </>
  );
}

function highlighted(engine: SuggestEngine, text: string, query: string): ReactNode {
  const span = engine.splitMatch(text, query);
  return span ? emphasised(span.before, span.match, span.after) : text;
}

// The endpoint's tags carry no counts: a match is bold at the start or after the hyphen it follows.
function highlightedTag(tag: string, needle: string): ReactNode {
  const at = tag.startsWith(needle) ? 0 : tag.indexOf(`-${needle}`) + 1;
  return emphasised(
    tag.slice(0, at),
    tag.slice(at, at + needle.length),
    tag.slice(at + needle.length),
  );
}

export interface DescriptionSuggestionsOptions {
  type: SuggestType | null;
  query: string;
  wanted: boolean;
  exclude?: ExcludedRow;
}

export function useDescriptionSuggestions({
  type,
  query,
  wanted,
  exclude,
}: DescriptionSuggestionsOptions): readonly SuggestionRow[] {
  const t = useTranslations("common");
  const engine = useSuggestEngine(wanted && type !== null);
  const index = useSuggestIndex(engine);
  const deferred = useDeferredValue(query);
  return useMemo(() => {
    if (!engine || !index || type === null) return [];
    return engine
      .suggestDescriptions(index, type, deferred, engine.SUGGEST_LIMIT, exclude)
      .map(({ text }) => ({
        key: text,
        value: text,
        name: t("useSuggestion", { text }),
        label: highlighted(engine, text, deferred),
      }));
  }, [engine, index, type, deferred, exclude, t]);
}

export interface TagSuggestOptions {
  type: SuggestType | null;
  categoryId: string | null;
  // Read when a letter is typed, so the form does not re-render on every keystroke of Description.
  description: () => string;
  chosen: readonly string[];
  wanted: boolean;
  exclude?: ExcludedRow;
  categoryName: (id: string) => string | undefined;
}

export function useTagSuggest({
  type,
  categoryId,
  description,
  chosen,
  wanted,
  exclude,
  categoryName,
}: TagSuggestOptions): (draft: string) => readonly SuggestionRow[] {
  const t = useTranslations("common");
  const tf = useTranslations("transactions.form");
  const engine = useSuggestEngine(wanted && type !== null);
  const index = useSuggestIndex(engine);
  // The one request the field always had, only while the copy cannot answer a focused field.
  const fallback = useTagsQuery(wanted && type !== null && engine !== null && index === null);
  const known = useMemo(() => fallback.data ?? [], [fallback.data]);
  return useCallback(
    (draft: string) => {
      const needle = normalizeTag(draft);
      if (type === null || !needle) return [];
      if (engine && index) {
        return engine
          .suggestTags(
            index,
            type,
            { categoryId, description: description(), chosen },
            needle,
            engine.SUGGEST_LIMIT,
            exclude,
          )
          .map((row) => {
            const category = row.categoryId === null ? undefined : categoryName(row.categoryId);
            return {
              key: row.tag,
              value: row.tag,
              name: t("addTag", { tag: row.tag }),
              label: (
                <>
                  <span aria-hidden="true" className="text-text-3">
                    #
                  </span>
                  {highlighted(engine, row.tag, needle)}
                </>
              ),
              meta: [t("times", { count: row.count }), category && tf("usuallyWith", { category })]
                .filter(Boolean)
                .join(" · "),
            };
          });
      }
      return known
        .filter(
          (tag) =>
            !chosen.includes(tag) &&
            tag !== needle &&
            (tag.startsWith(needle) || tag.includes(`-${needle}`)),
        )
        .slice(0, FALLBACK_LIMIT)
        .map((tag) => ({
          key: tag,
          value: tag,
          name: t("addTag", { tag }),
          label: (
            <>
              <span aria-hidden="true" className="text-text-3">
                #
              </span>
              {highlightedTag(tag, needle)}
            </>
          ),
        }));
    },
    [type, engine, index, categoryId, description, chosen, exclude, categoryName, known, t, tf],
  );
}
