import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError } from "@/lib/api/errors";
import { renderWithProviders } from "@/lib/testing/render";
import type { Category } from "@/types/api";

import { defaultBudgetValues, toCreateInput } from "../form";
import { BudgetForm } from "./BudgetForm";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const now = new Date("2026-09-22T15:00:00.000Z");
const timeZone = "America/Bogota";

function category(id: string, name: string, extra: Partial<Category> = {}): Category {
  return {
    id,
    name,
    icon: "utensils",
    color: "ORANGE",
    type: "EXPENSE",
    userId: "u1",
    archivedAt: null,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

const categories = [
  category("food", "Food"),
  category("coffee", "Coffee", { icon: "coffee", color: "BROWN" }),
  category("salary", "Salary", { type: "INCOME" }),
  category("old", "Old", { archivedAt: "2026-01-01T00:00:00Z" }),
];

function renderForm(props: Partial<Parameters<typeof BudgetForm>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <BudgetForm
      defaultValues={defaultBudgetValues(now, timeZone)}
      categories={categories}
      submitLabel="Create budget"
      pending={false}
      error={null}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return onSubmit;
}

describe("BudgetForm", () => {
  it("offers only active expense categories, keeps one selected and submits a category budget", async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText("Name"), "Food & groceries");
    expect(screen.queryByRole("button", { name: "Salary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Old" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Food" }));
    await userEvent.click(screen.getByRole("button", { name: "Coffee" }));
    expect(screen.getByRole("button", { name: "Food" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Coffee" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Weekly" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "650000");
    await userEvent.click(screen.getByRole("button", { name: "Create budget" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    const values = onSubmit.mock.calls[0]?.[0] as Parameters<typeof toCreateInput>[0];
    expect(toCreateInput(values, timeZone)).toEqual({
      name: "Food & groceries",
      color: "TEAL",
      categoryIds: ["coffee"],
      type: "EXPENSE",
      amount: 650_000,
      periodType: "WEEKLY",
      note: null,
    });
  });

  // The dates are chosen in the calendar of 7.28 now, not typed into the browser's control (F-05).
  async function pickDay(label: string, month: string, day: number) {
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    const sheet = screen.getByRole("dialog", { name: label });
    const wanted = new RegExp(`${month} ${day}, 2026`);
    for (let hops = 0; hops < 24; hops += 1) {
      if (within(sheet).queryAllByRole("gridcell", { name: wanted }).length > 0) break;
      await userEvent.click(within(sheet).getByRole("button", { name: "Next month" }));
    }
    await userEvent.click(within(sheet).getAllByRole("gridcell", { name: wanted })[0]!);
    await userEvent.click(within(sheet).getByRole("button", { name: "Done" }));
  }

  it("requires a category for a category budget and the dates for a custom period", async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText("Name"), "Trip");
    await userEvent.click(screen.getByRole("button", { name: "Custom" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "100");
    await pickDay("Start", "October", 10);
    // The calendar will not offer a day before the start, so the window cannot be inverted at all
    // (F-05); the rule the form used to catch afterwards is now a day nobody can choose.
    await userEvent.click(screen.getByRole("button", { name: /^End/ }));
    const end = screen.getByRole("dialog", { name: "End" });
    expect(within(end).getByRole("gridcell", { name: /October 1, 2026/ })).toBeDisabled();
    await userEvent.click(within(end).getByRole("button", { name: "Cancel" }));

    await userEvent.click(screen.getByRole("button", { name: "Create budget" }));
    expect(await screen.findByText("This field is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends a global budget with a half-open custom window and the advanced options", async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText("Name"), "Trip");
    await userEvent.click(screen.getByRole("button", { name: "All spending" }));
    await userEvent.click(screen.getByRole("button", { name: "Custom" }));
    await pickDay("Start", "October", 1);
    await pickDay("End", "October", 15);
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "2500000");
    await userEvent.click(screen.getByRole("button", { name: "Advanced options" }));
    await userEvent.type(screen.getByLabelText(/^Note/), "Beach week");
    await userEvent.click(screen.getByRole("button", { name: "Create budget" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    const values = onSubmit.mock.calls[0]?.[0] as Parameters<typeof toCreateInput>[0];
    expect(toCreateInput(values, timeZone)).toMatchObject({
      categoryIds: [],
      periodType: "CUSTOM",
      periodStartDate: "2026-10-01T05:00:00.000Z",
      periodEndDate: "2026-10-16T05:00:00.000Z",
      note: "Beach week",
    });
  });

  it("names the overlap for a global budget and flags a category error under the field", () => {
    renderForm({
      error: new ApiError({
        status: 400,
        code: "BUDGET_PERIOD_OVERLAP",
        message: "overlap",
        requestId: "r",
      }),
      defaultValues: { ...defaultBudgetValues(now, timeZone), scope: "global" },
    });
    expect(screen.getByText("You already have a global monthly budget.")).toBeInTheDocument();
  });
});
