import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import type { Category } from "@/types/api";

import { CategoriesView } from "./CategoriesView";

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace }),
  usePathname: () => "/categories",
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string | { pathname: string; query?: Record<string, string> };
    className?: string;
  }) => (
    <a
      className={className}
      href={
        typeof href === "string"
          ? href
          : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query).toString()}` : ""}`
      }
    >
      {children}
    </a>
  ),
}));

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
  category("pets", "Pets", { icon: "dog", color: "AMBER" }),
  category("salary", "Salary", { type: "INCOME", icon: "briefcase" }),
  category("old", "Old", { archivedAt: "2026-05-01T00:00:00Z" }),
];

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function routeFetch(
  onMutation?: (url: string, method: string) => Response,
  list: Category[] = categories,
) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    if (method !== "GET" && onMutation) return Promise.resolve(onMutation(url, method));
    if (url.startsWith("/api/stats/spending")) {
      const buckets = url.includes("type=EXPENSE")
        ? [{ key: "food", total: 900, count: 24, avg: 37.5 }]
        : [];
      return Promise.resolve(json({ groupBy: "category", total: 0, buckets }));
    }
    return Promise.resolve(
      json({
        data: list,
        pagination: { limit: 100, offset: 0, total: list.length, hasMore: false, nextCursor: null },
      }),
    );
  });
}

function renderView() {
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <CategoriesView />
      </ToastProvider>
    </QueryProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  search = "";
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CategoriesView", () => {
  it("groups by type with counts, shows usage per tile and folds the archived ones", async () => {
    routeFetch();
    renderView();
    expect(await screen.findByRole("button", { name: "Expense · 2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Income · 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transfer · 0" })).toBeInTheDocument();
    const food = screen.getByRole("link", { name: /Food/ });
    expect(food).toHaveAttribute("href", "/categories/food/edit");
    await waitFor(() => {
      expect(food).toHaveTextContent("24 transactions");
    });
    expect(screen.getByRole("link", { name: /Pets/ })).toHaveTextContent("unused");
    expect(screen.queryByRole("link", { name: /Salary/ })).not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "New category" }))
      expect(link).toHaveAttribute("href", "/categories/new?type=EXPENSE");

    await userEvent.click(screen.getByRole("button", { name: "Income · 1" }));
    expect(replace).toHaveBeenCalledWith({ pathname: "/categories", query: { type: "INCOME" } });

    const toggle = screen.getByRole("button", { name: /Archived/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Restore Old" })).toBeVisible();
  });

  it("restores an archived category and, on a 409, restores it under a new name", async () => {
    const posts: unknown[] = [];
    const withHolder = [...categories, category("old2", "old", { color: "PINK" })];
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (init?.method === "POST") {
        const body = JSON.parse((init.body as string) || "{}") as { name?: string };
        posts.push(body);
        return Promise.resolve(
          body.name
            ? json({ ...categories[3], name: body.name, archivedAt: null })
            : json({ code: "DUPLICATE", message: "taken" }, { status: 409 }),
        );
      }
      if (url.startsWith("/api/stats/spending"))
        return Promise.resolve(json({ groupBy: "category", total: 0, buckets: [] }));
      return Promise.resolve(
        json({
          data: withHolder,
          pagination: { limit: 100, offset: 0, total: 5, hasMore: false, nextCursor: null },
        }),
      );
    });
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: /Archived/ }));
    await userEvent.click(screen.getByRole("button", { name: "Restore Old" }));
    const dialog = await screen.findByRole("dialog", { name: "That name is taken" });
    expect(dialog).toHaveTextContent("An active category is already named “old”.");
    const field = within(dialog).getByLabelText("New name");
    await userEvent.clear(field);
    await userEvent.type(field, "Old trips");
    await userEvent.click(within(dialog).getByRole("button", { name: "Restore as “Old trips”" }));
    expect(await screen.findByText("Category restored")).toBeVisible();
    expect(posts).toEqual([{}, { name: "Old trips" }]);
  });

  it("recreates the default categories and reports how many were missing", async () => {
    routeFetch(() => json({ data: [category("x", "X"), category("y", "Y")] }));
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: "Restore" }));
    expect(await screen.findByText("2 categories created")).toBeVisible();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toBe("/api/categories/restore-defaults");
  });
});
