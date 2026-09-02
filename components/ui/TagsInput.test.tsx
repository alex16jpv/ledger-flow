import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { renderWithProviders } from "@/lib/testing/render";

import { Field } from "./Field";
import { TagsInput } from "./TagsInput";

function Harness({ initial = [] as string[] }) {
  const [tags, setTags] = useState<string[]>(initial);
  return (
    <Field label="Tags">
      <TagsInput
        value={tags}
        onChange={setTags}
        suggestions={["travel", "monthly", "latte"]}
        placeholder="Add…"
      />
    </Field>
  );
}

describe("TagsInput", () => {
  it("adds normalized tags with Enter or comma, removes with Backspace or the chip button", async () => {
    renderWithProviders(<Harness />);
    const input = screen.getByRole("textbox", { name: "Tags" });
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

  it("offers suggestions that match the draft and hides the ones already chosen", async () => {
    renderWithProviders(<Harness initial={["travel"]} />);
    const suggestions = screen.getByRole("group", { name: "Suggestions" });
    expect(
      within(suggestions)
        .getAllByRole("button")
        .map((chip) => chip.textContent),
    ).toEqual(["#monthly", "#latte"]);
    await userEvent.type(screen.getByRole("textbox", { name: "Tags" }), "lat");
    expect(within(suggestions).getAllByRole("button")).toHaveLength(1);
    await userEvent.click(within(suggestions).getByRole("button", { name: /latte/ }));
    expect(screen.getByRole("button", { name: "Remove tag latte" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Tags" })).toHaveValue("");
  });
});
