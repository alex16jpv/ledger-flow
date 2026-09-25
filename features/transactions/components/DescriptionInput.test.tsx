import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { renderWithProviders } from "@/lib/testing/render";

import type { SuggestType } from "../suggest";
import { DescriptionInput } from "./DescriptionInput";

const engine = vi.hoisted(() => ({ wanted: [] as boolean[] }));

vi.mock("@/lib/local/suggest/useSuggestions", async () => {
  const store = await import("@/lib/local/suggest/store");
  const { buildSuggestIndex } = await import("@/lib/local/suggest/index");
  const { transaction } = await import("@/lib/testing/vault");
  const index = buildSuggestIndex([
    transaction({ id: "a", description: "Uber to work", date: "2026-08-01T10:00:00.000Z" }),
    transaction({ id: "b", description: "Uber to work", date: "2026-08-02T10:00:00.000Z" }),
    transaction({ id: "c", description: "Über Eats · lunch", date: "2026-08-03T10:00:00.000Z" }),
    transaction({ id: "d", description: "Salary", type: "INCOME" }),
  ]);
  return {
    useSuggestEngine: (wanted: boolean) => {
      engine.wanted.push(wanted);
      return wanted ? store : null;
    },
    useSuggestIndex: (loaded: unknown) => (loaded ? index : null),
  };
});

function Harness({ type = "EXPENSE" }: { type?: SuggestType }) {
  const [value, setValue] = useState("");
  return (
    <DescriptionInput
      value={value}
      onChange={setValue}
      type={type}
      placeholder="What was it?"
      aria-label="Description"
    />
  );
}

beforeEach(() => {
  engine.wanted = [];
});

describe("DescriptionInput", () => {
  it("asks for the index only once the field is focused, then lists the matches in bold", async () => {
    renderWithProviders(<Harness />);
    expect(engine.wanted).not.toContain(true);
    const input = screen.getByRole("combobox", { name: "Description" });
    await userEvent.click(input);
    expect(engine.wanted.at(-1)).toBe(true);
    await userEvent.type(input, "ub");
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Uber to work",
      "Über Eats · lunch",
    ]);
    expect(options[0]?.querySelector(".font-semibold")?.textContent).toBe("Ub");
    expect(options[1]?.querySelector(".font-semibold")?.textContent).toBe("Üb");
    expect(screen.getByRole("option", { name: "Use “Uber to work”" })).toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(input).toHaveValue("Uber to work");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("suggests only from the movements of its type", async () => {
    renderWithProviders(<Harness type="INCOME" />);
    const input = screen.getByRole("combobox", { name: "Description" });
    await userEvent.type(input, "u");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, "sa");
    expect(await screen.findByRole("option", { name: "Use “Salary”" })).toBeInTheDocument();
  });
});
