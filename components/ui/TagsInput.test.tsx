import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { renderWithProviders } from "@/lib/testing/render";

import { Field } from "./Field";
import type { SuggestionRow } from "./Suggestions";
import { TagsInput } from "./TagsInput";

const KNOWN = ["travel", "monthly", "latte"];

const suggest = (draft: string): SuggestionRow[] =>
  KNOWN.filter((tag) => tag.startsWith(draft.toLowerCase())).map((tag) => ({
    key: tag,
    value: tag,
    name: `Add #${tag}`,
    label: `#${tag}`,
    meta: "3×",
  }));

function Harness({ initial = [] as string[] }) {
  const [tags, setTags] = useState<string[]>(initial);
  return (
    <Field label="Tags">
      <TagsInput value={tags} onChange={setTags} suggest={suggest} placeholder="Add…" />
    </Field>
  );
}

describe("TagsInput", () => {
  it("adds normalized tags with Enter or comma, removes with Backspace or the chip button", async () => {
    renderWithProviders(<Harness />);
    const input = screen.getByRole("combobox", { name: "Tags" });
    await userEvent.type(input, " #Work{Enter}weekly,");
    expect(screen.getByText("work")).toBeVisible();
    expect(screen.getByText("weekly")).toBeVisible();
    await userEvent.type(input, "work{Enter}");
    expect(screen.getAllByRole("button", { name: /Remove tag/ })).toHaveLength(2);
    await userEvent.type(input, "{Backspace}");
    expect(screen.queryByText("weekly")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove tag work" }));
    expect(screen.queryByText("work")).not.toBeInTheDocument();
  });

  it("lists what matches the draft once you type, and a tap adds it", async () => {
    renderWithProviders(<Harness initial={["travel"]} />);
    const input = screen.getByRole("combobox", { name: "Tags" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.type(input, "lat");
    const list = screen.getByRole("listbox", { name: "Suggestions" });
    expect(within(list).getAllByRole("option")).toHaveLength(1);
    expect(within(list).getByText("3×")).toBeInTheDocument();
    await userEvent.click(within(list).getByRole("option", { name: "Add #latte" }));
    expect(screen.getByRole("button", { name: "Remove tag latte" })).toBeVisible();
    expect(input).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("adds exactly what was typed on Enter unless a row was highlighted first", async () => {
    renderWithProviders(<Harness />);
    const input = screen.getByRole("combobox", { name: "Tags" });
    await userEvent.type(input, "mo{Enter}");
    expect(screen.getByRole("button", { name: "Remove tag mo" })).toBeVisible();
    await userEvent.type(input, "mo{ArrowDown}{Enter}");
    expect(screen.getByRole("button", { name: "Remove tag monthly" })).toBeVisible();
    expect(input).toHaveValue("");
  });
});
