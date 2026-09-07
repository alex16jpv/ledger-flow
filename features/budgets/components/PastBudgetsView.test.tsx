import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import type { Budget } from "@/types/api";

import { PastBudgetsView } from "./PastBudgetsView";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const now = new Date("2026-09-22T15:00:00.000Z");

function budget(id: string, name: string, extra: Partial<Budget> = {}): Budget {
  return {
    id,
    name,
    color: "CYAN",
    categoryIds: [],
    archivedCategoryIds: [],
    type: "EXPENSE",
    currency: "COP",
    periodType: "MONTHLY",
    periodKey: "2026-09",
    periodFrom: "2026-09-01T05:00:00.000Z",
    periodTo: "2026-10-01T05:00:00.000Z",
    baseAmount: 900_000,
    amount: 900_000,
    spent: 0,
    hasOverride: false,
    expired: false,
    effectiveFrom: "2026-01-01T05:00:00.000Z",
    note: null,
    archivedAt: null,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

const list = (data: Budget[]) =>
  json({
    data,
    pagination: { limit: 100, offset: 0, total: data.length, hasMore: false, nextCursor: null },
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderView(tab: "ended" | "archived" = "archived") {
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <PastBudgetsView
          tab={tab}
          categories={new Map()}
          now={now}
          onTabChange={vi.fn()}
          onBack={vi.fn()}
        />
      </ToastProvider>
    </QueryProvider>,
  );
}

describe("PastBudgetsView", () => {
  it("restores an archived budget from its card", async () => {
    const posts: string[] = [];
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === "POST") {
        posts.push(typeof input === "string" ? input : "");
        return Promise.resolve(json(budget("old", "Old trip")));
      }
      return Promise.resolve(
        list([budget("old", "Old trip", { archivedAt: "2026-08-01T00:00:00Z" })]),
      );
    });
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: "Restore Old trip" }));
    expect(await screen.findByText("Budget restored")).toBeVisible();
    expect(posts).toEqual(["/api/budgets/old/restore"]);
    expect(screen.getByRole("link", { name: "Create again" })).toHaveAttribute(
      "href",
      "/budgets/new?from=old",
    );
  });

  it("explains an overlapping restore with the active budget in the way", async () => {
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === "POST")
        return Promise.resolve(
          json({ code: "BUDGET_PERIOD_OVERLAP", message: "overlap" }, { status: 400 }),
        );
      return Promise.resolve(
        list([
          budget("old", "Old trip", { archivedAt: "2026-08-01T00:00:00Z" }),
          budget("global", "Everything"),
        ]),
      );
    });
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: "Restore Old trip" }));
    const dialog = await screen.findByRole("dialog", { name: "Another budget is in the way" });
    expect(dialog).toHaveTextContent("“Everything” is active for the same monthly period");
    expect(within(dialog).getByRole("link", { name: "Open Everything" })).toHaveAttribute(
      "href",
      "/budgets/global",
    );
  });

  it("shows ended budgets without a restore button", async () => {
    fetchMock.mockResolvedValue(
      list([
        budget("trip", "July trip", {
          periodType: "CUSTOM",
          expired: true,
          periodFrom: "2026-07-01T05:00:00.000Z",
          periodTo: "2026-07-16T05:00:00.000Z",
        }),
      ]),
    );
    renderView("ended");
    expect(await screen.findByText("July trip")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Restore/ })).not.toBeInTheDocument();
  });
});
