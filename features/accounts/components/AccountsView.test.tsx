import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import type { Account } from "@/types/api";

import { AccountsView } from "./AccountsView";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();

function account(id: string, name: string, extra: Partial<Account> = {}): Account {
  return {
    id,
    name,
    type: "ACCOUNT",
    balance: 0,
    openingBalance: 0,
    color: "BLUE",
    userId: "u1",
    isDefault: false,
    currency: "COP",
    archivedAt: null,
    createdAt: "2026-03-12T12:00:00Z",
    updatedAt: "2026-03-12T12:00:00Z",
    ...extra,
  };
}

const list = (data: Account[]) =>
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

describe("AccountsView", () => {
  it("sums active balances, reports card debt and keeps archived accounts folded", async () => {
    fetchMock.mockResolvedValue(
      list([
        account("cash", "Cash", { type: "CASH", balance: 184_000 }),
        account("banco", "Bancolombia", { balance: 3_420_500, isDefault: true }),
        account("visa", "Visa Gold", { type: "CARD", balance: -1_245_900, color: "PURPLE" }),
        account("nequi", "Nequi", { type: "OTHER", archivedAt: "2026-05-01T00:00:00Z" }),
      ]),
    );
    renderWithProviders(
      <QueryProvider>
        <AccountsView />
      </QueryProvider>,
    );
    expect(await screen.findByText("2,358,600")).toBeInTheDocument();
    expect(screen.getByText("3 active accounts · 1 archived")).toBeInTheDocument();
    expect(screen.getByText("Card debt")).toBeInTheDocument();
    const url = fetchMock.mock.calls[0]?.[0];
    expect(url).toContain("includeArchived=true");

    const links = screen.getAllByRole("link", { name: /Bancolombia|Cash|Visa Gold/ });
    expect(links[0]).toHaveTextContent("Bancolombia");
    expect(links[0]).toHaveTextContent("Main");
    expect(links[0]).toHaveAttribute("href", "/accounts/banco");

    expect(screen.queryByRole("link", { name: /Nequi/ })).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /Archived/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    const nequi = screen.getByRole("link", { name: /Nequi/ });
    expect(within(nequi).getByText("Archived")).toBeInTheDocument();
  });

  it("shows the empty state with a link to create the first account", async () => {
    fetchMock.mockResolvedValue(list([]));
    renderWithProviders(
      <QueryProvider>
        <AccountsView />
      </QueryProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Create your first account" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/accounts/new",
    );
  });

  it("offers a retry when the list fails", async () => {
    fetchMock.mockResolvedValue(json({ code: "DB_UNAVAILABLE", message: "down" }, { status: 503 }));
    renderWithProviders(
      <QueryProvider>
        <AccountsView />
      </QueryProvider>,
    );
    expect(
      await screen.findByRole("button", { name: "Retry" }, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});
