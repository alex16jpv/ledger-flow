import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { UUID } from "@/lib/testing/ids";
import { renderWithProviders } from "@/lib/testing/render";
import type { Category } from "@/types/api";

import { CategoryForm } from "./CategoryForm";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();

const food: Category = {
  id: "food",
  name: "Food",
  icon: "utensils",
  color: "ORANGE",
  type: "EXPENSE",
  userId: "u1",
  archivedAt: null,
  createdAt: "",
  updatedAt: "",
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderForm(props: Partial<Parameters<typeof CategoryForm>[0]> = {}) {
  const onSaved = vi.fn();
  renderWithProviders(
    <QueryProvider>
      <CategoryForm onSaved={onSaved} {...props} />
    </QueryProvider>,
  );
  return onSaved;
}

describe("CategoryForm", () => {
  it("creates with the chosen type and previews the result live", async () => {
    fetchMock.mockResolvedValue(json({ ...food, id: "new", name: "Gym" }, { status: 201 }));
    const onSaved = renderForm({ type: "EXPENSE", preview: true });
    expect(screen.getByText("Expense · preview")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Name"), "Gym");
    await userEvent.click(screen.getByRole("button", { name: "Income" }));
    expect(screen.getByText("Income · preview")).toBeInTheDocument();
    expect(screen.getByText("Gym")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create category" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "new" }));
    });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      id: expect.stringMatching(UUID),
      name: "Gym",
      icon: "tag",
      color: "BLUE",
      type: "INCOME",
    });
  });

  it("locks the type when the category has history, explains why and leaves it out of the PUT", async () => {
    fetchMock.mockResolvedValue(json({ ...food, name: "Groceries" }));
    const onSaved = renderForm({ category: food, lockedCount: 24, preview: true });
    const segment = screen.getByRole("group", { name: "Type" });
    expect(segment.querySelector("button")).toBeDisabled();
    expect(
      screen.getByText(/this category already has 24 transactions and changing it/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "create a new category" })).toHaveAttribute(
      "href",
      "/categories/new?type=EXPENSE",
    );
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Groceries");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/categories/food");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({
      name: "Groceries",
      icon: "utensils",
      color: "ORANGE",
    });
  });

  it("lets an unused category change type and shows the server lock if the API disagrees", async () => {
    fetchMock.mockResolvedValue(
      json({ code: "CATEGORY_TYPE_LOCKED", message: "locked" }, { status: 400 }),
    );
    renderForm({ category: food, lockedCount: 0 });
    await userEvent.click(screen.getByRole("button", { name: "Income" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/The type can’t be changed/)).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(init?.body as string)).toMatchObject({ type: "INCOME" });
  });

  it("hides the type when the picker fixes it and shows a duplicate under the name", async () => {
    fetchMock.mockResolvedValue(json({ code: "DUPLICATE", message: "dup" }, { status: 409 }));
    renderForm({ type: "INCOME", typeEditable: false, initialName: "Salary" });
    expect(screen.queryByRole("group", { name: "Type" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create category" }));
    expect(
      await screen.findByText(
        "You already have an active category named “Salary”. Names are case-insensitive.",
      ),
    ).toBeInTheDocument();
  });
});
