import { type ReactNode, useEffect } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { SuggestionRow } from "@/components/ui/Suggestions";
import { renderWithProviders } from "@/lib/testing/render";

import { type TagSuggestOptions, useTagSuggest } from "./suggest";

const state = vi.hoisted(() => ({
  engine: true,
  index: true,
  tagsEnabled: [] as boolean[],
  tags: ["latte", "work", "work-trip"],
}));

vi.mock("@/lib/local/suggest/useSuggestions", async () => {
  const store = await import("@/lib/local/suggest/store");
  const { buildSuggestIndex } = await import("@/lib/local/suggest/index");
  const { transaction } = await import("@/lib/testing/vault");
  const index = buildSuggestIndex([
    transaction({ id: "a", description: "Uber to work", categoryId: "transport", tags: ["work"] }),
    transaction({ id: "b", description: "Uber to work", categoryId: "transport", tags: ["work"] }),
    transaction({ id: "c", description: "Latte", categoryId: "coffee", tags: ["work-trip"] }),
  ]);
  return {
    useSuggestEngine: (wanted: boolean) => (wanted && state.engine ? store : null),
    useSuggestIndex: (loaded: unknown) => (loaded && state.index ? index : null),
  };
});

vi.mock("./hooks", () => ({
  useTagsQuery: (enabled: boolean) => {
    state.tagsEnabled.push(enabled);
    return { data: enabled ? state.tags : undefined };
  },
}));

const text = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);

type Suggest = (draft: string) => readonly SuggestionRow[];

function Probe({ options, outRef }: { options: TagSuggestOptions; outRef: { current: Suggest } }) {
  const suggest = useTagSuggest(options);
  useEffect(() => {
    outRef.current = suggest;
  }, [outRef, suggest]);
  return null;
}

function hook(options: Partial<TagSuggestOptions> = {}) {
  const out = { current: (() => []) as Suggest };
  renderWithProviders(
    <Probe
      outRef={out}
      options={{
        type: "EXPENSE",
        categoryId: null,
        description: () => "",
        chosen: [],
        wanted: true,
        categoryName: (id) => (id === "transport" ? "Transport" : undefined),
        ...options,
      }}
    />,
  );
  return {
    result: {
      get current() {
        return out.current;
      },
    },
  };
}

beforeEach(() => {
  state.engine = true;
  state.index = true;
  state.tagsEnabled = [];
});

describe("useTagSuggest", () => {
  it("answers from the index with the count and the usual category, whatever the leading #", () => {
    const { result } = hook({ categoryId: "transport", description: () => "Uber to work" });
    const rows = result.current("#Wo");
    expect(rows.map((row) => row.value)).toEqual(["work", "work-trip"]);
    expect(rows[0]).toMatchObject({ name: "Add #work", meta: "2× · usually with Transport" });
    expect(rows[1]).toMatchObject({ meta: "1×" });
    expect(text(rows[0]?.label)).toContain('<span class="font-semibold">wo</span>rk');
    expect(result.current("")).toEqual([]);
    expect(result.current("#")).toEqual([]);
    expect(state.tagsEnabled).not.toContain(true);
  });

  it("leaves the field alone when it has no type, without loading anything", () => {
    const { result } = hook({ type: null });
    expect(result.current("wo")).toEqual([]);
    expect(state.tagsEnabled).not.toContain(true);
  });

  it("falls back to the endpoint's tags only while the index is absent, matched the same way", () => {
    state.index = false;
    const { result } = hook({ chosen: ["work"] });
    expect(state.tagsEnabled.at(-1)).toBe(true);
    const rows = result.current("#TRIP");
    expect(rows.map((row) => row.value)).toEqual(["work-trip"]);
    expect(rows[0]?.name).toBe("Add #work-trip");
    expect(text(rows[0]?.label)).toContain('work-<span class="font-semibold">trip</span>');
    expect(result.current("wor").map((row) => row.value)).toEqual(["work-trip"]);
  });
});
