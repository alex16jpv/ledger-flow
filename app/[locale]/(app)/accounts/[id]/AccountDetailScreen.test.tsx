import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import type { Account } from "@/types/api";

import { AccountDetailScreen } from "./AccountDetailScreen";

const push = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/accounts/a1",
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

function account(id: string, name: string, extra: Partial<Account> = {}): Account {
  return {
    id,
    name,
    type: "ACCOUNT",
    balance: 3_420_500,
    openingBalance: 2_500_000,
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

const banco = account("banco", "Bancolombia", { isDefault: true });
const cash = account("cash", "Cash", { type: "CASH", balance: 184_000, color: "GRAY" });
const nequi = account("nequi", "Nequi", { archivedAt: "2026-05-01T00:00:00Z", balance: 0 });

const empty = (data: unknown[] = []) =>
  json({
    data,
    pagination: { limit: 30, offset: 0, total: data.length, hasMore: false, nextCursor: null },
  });

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function routeFetch(detail: Account, onMutation?: (url: string, method: string) => Response) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    if (method !== "GET" && onMutation) return Promise.resolve(onMutation(url, method));
    if (url.startsWith("/api/accounts?")) return Promise.resolve(empty([banco, cash, nequi]));
    if (url.startsWith("/api/accounts/")) return Promise.resolve(json(detail));
    if (url.startsWith("/api/categories")) return Promise.resolve(empty());
    if (url.startsWith("/api/transactions")) return Promise.resolve(empty());
    return Promise.resolve(json({}, { status: 404 }));
  });
}

function renderScreen(id: string) {
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <AccountDetailScreen id={id} />
      </ToastProvider>
    </QueryProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AccountDetailScreen", () => {
  it("blocks making main and archiving on the main account and explains why", async () => {
    routeFetch(banco);
    renderScreen("banco");
    expect(await screen.findByRole("heading", { level: 1, name: "Bancolombia" })).toBeVisible();
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText(/Opening balance \$2,500,000 · created Mar 12 · COP/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Main account" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
    expect(screen.getByText(/make another one your main account first/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/accounts/banco/edit",
    );
    expect(screen.getByRole("link", { name: "Open with filters" })).toHaveAttribute(
      "href",
      "/transactions?account=banco&period=all",
    );
    expect(await screen.findByText("No transactions in this account yet")).toBeVisible();
  });

  it("makes the account main after a confirmation that names the previous one", async () => {
    const mutations: string[] = [];
    routeFetch(cash, (url, method) => {
      mutations.push(`${method} ${url}`);
      return json({ ...cash, isDefault: true });
    });
    renderScreen("cash");
    await userEvent.click(await screen.findByRole("button", { name: "Main account" }));
    const dialog = screen.getByRole("dialog", { name: "Make Cash your main account?" });
    expect(dialog).toHaveTextContent("Bancolombia stops being the main account.");
    await userEvent.click(screen.getByRole("button", { name: "Make main" }));
    expect(await screen.findByText("Cash is now your main account")).toBeVisible();
    expect(mutations).toEqual(["POST /api/accounts/cash/default"]);

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(mutations).toEqual([
        "POST /api/accounts/cash/default",
        "POST /api/accounts/banco/default",
      ]);
    });
  });

  it("archives after confirming and offers undo", async () => {
    const mutations: string[] = [];
    routeFetch(cash, (url, method) => {
      mutations.push(`${method} ${url}`);
      return method === "DELETE" ? new Response(null, { status: 204 }) : json(cash);
    });
    renderScreen("cash");
    await userEvent.click(await screen.findByRole("button", { name: "Archive" }));
    expect(screen.getByRole("dialog", { name: "Archive Cash?" })).toHaveTextContent(
      /Its transactions stay in your history/,
    );
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Archive Cash?" })).getByRole("button", {
        name: "Archive",
      }),
    );
    expect(await screen.findByText("Account archived")).toBeVisible();
    expect(mutations).toEqual(["DELETE /api/accounts/cash"]);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(mutations).toContain("POST /api/accounts/cash/restore");
    });
  });

  it("restores an archived account and, on a 409, points at the account holding the name", async () => {
    const taken = account("nequi2", "nequi", { color: "PINK" });
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (init?.method === "POST")
        return Promise.resolve(json({ code: "DUPLICATE", message: "taken" }, { status: 409 }));
      if (url.startsWith("/api/accounts?")) return Promise.resolve(empty([banco, taken, nequi]));
      if (url.startsWith("/api/accounts/")) return Promise.resolve(json(nequi));
      return Promise.resolve(empty());
    });
    renderScreen("nequi");
    expect(await screen.findByText("Archived")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByText(/This account is archived/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    const dialog = await screen.findByRole("dialog", { name: "That name is taken" });
    expect(dialog).toHaveTextContent("An active account is already named “nequi”.");
    expect(screen.getByRole("link", { name: "Open nequi" })).toHaveAttribute(
      "href",
      "/accounts/nequi2/edit",
    );
  });

  it("shows the not-found state for an unknown id", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        urlOf(input).startsWith("/api/accounts/")
          ? json({ code: "NOT_FOUND", message: "nope" }, { status: 404 })
          : empty(),
      ),
    );
    renderScreen("ghost");
    expect(await screen.findByText("This account doesn’t exist.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to the list" })).toHaveAttribute(
      "href",
      "/accounts",
    );
  });
});
