import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import type { Category } from "@/types/api";

import { CategoryPickerSheet } from "./CategoryPickerSheet";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();

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
  category("coffee", "Café", { icon: "coffee", color: "BROWN" }),
  category("bus", "Transport", { icon: "bus", color: "BLUE" }),
];

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function routeFetch(created?: Category) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    if (url.includes("/api/stats/spending"))
      return Promise.resolve(
        json({
          groupBy: "category",
          total: 0,
          buckets: [
            { key: "coffee", total: 100, count: 9, avg: 11 },
            { key: "food", total: 900, count: 4, avg: 225 },
          ],
        }),
      );
    if (url.includes("/api/categories") && init?.method === "POST")
      return Promise.resolve(json(created, { status: 201 }));
    return Promise.resolve(
      json({
        data: categories,
        pagination: { limit: 100, offset: 0, total: 3, hasMore: false, nextCursor: null },
      }),
    );
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSheet(onSelect = vi.fn(), onClose = vi.fn()) {
  renderWithProviders(
    <QueryProvider>
      <CategoryPickerSheet open onClose={onClose} type="EXPENSE" value="bus" onSelect={onSelect} />
    </QueryProvider>,
  );
  return { onSelect, onClose };
}

describe("CategoryPickerSheet", () => {
  it("lists the categories of the type, ranks the recent ones and reports the choice", async () => {
    routeFetch();
    const { onSelect, onClose } = renderSheet();
    const listbox = await screen.findByRole("listbox", { name: "Category" });
    expect(within(listbox).getAllByRole("option")).toHaveLength(3);
    expect(within(listbox).getByRole("option", { name: /Transport/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const recent = await screen.findByRole("group", { name: "Recent" });
    expect(
      within(recent)
        .getAllByRole("button")
        .map((chip) => chip.textContent),
    ).toEqual(["Café", "Food"]);
    const listUrl = fetchMock.mock.calls
      .map(([input]) => urlOf(input))
      .find((url) => url.includes("/api/categories?"));
    expect(listUrl).toContain("type=EXPENSE");

    await userEvent.click(within(recent).getByRole("button", { name: "Café" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "coffee" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("filters accent-insensitively and hides the recent strip while searching", async () => {
    routeFetch();
    renderSheet();
    await screen.findByRole("listbox");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search categories" }), "cafe");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.queryByRole("group", { name: "Recent" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByRole("heading", { name: "No categories match “cafezzz”" })).toBeVisible();
  });

  it("creates a category inline with the typed name and selects it", async () => {
    const gym = category("gym", "Gym", { icon: "dumbbell", color: "TEAL" });
    routeFetch(gym);
    const { onSelect } = renderSheet();
    await screen.findByRole("listbox");
    await userEvent.type(screen.getByRole("searchbox"), "Gym");
    await userEvent.click(screen.getByRole("button", { name: /New category/ }));

    expect(screen.getByRole("heading", { name: "New category" })).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveValue("Gym");
    await userEvent.click(screen.getByRole("button", { name: "dumbbell" }));
    await userEvent.click(screen.getByRole("button", { name: "Teal" }));
    await userEvent.click(screen.getByRole("button", { name: "Create category" }));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "gym" }));
    });
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({
      name: "Gym",
      icon: "dumbbell",
      color: "TEAL",
      type: "EXPENSE",
    });
  });

  it("shows a duplicate name under the field and keeps the form open", async () => {
    routeFetch();
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        json({
          data: [],
          pagination: { limit: 100, offset: 0, total: 0, hasMore: false, nextCursor: null },
        }),
      ),
    );
    renderSheet();
    await screen.findByRole("heading", { name: "No categories for this type yet" });
    await userEvent.click(screen.getByRole("button", { name: /New category/ }));
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(json({ code: "DUPLICATE", message: "exists" }, { status: 409 })),
    );
    await userEvent.type(screen.getByLabelText("Name"), "Food");
    await userEvent.click(screen.getByRole("button", { name: "Create category" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/already/i);
    expect(screen.getByLabelText("Name")).toHaveValue("Food");
  });
});
