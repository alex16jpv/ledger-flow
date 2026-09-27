import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { KeepOrStartFreshView } from "./KeepOrStartFreshView";

const replace = vi.fn();
const push = vi.fn();
let search = new URLSearchParams();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace, push, back: vi.fn() }),
  usePathname: () => "/keep-or-start-fresh",
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => search,
}));

const purgeVault = vi.fn(() => Promise.resolve({}));
vi.mock("@/lib/local/purge", () => ({
  purgeVault: (...args: unknown[]) => purgeVault(...(args as [])),
  purgeOtherVaults: () => Promise.resolve(),
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
const FACTS = { createdAt: "2026-03-12T15:00:00Z", accounts: 3, transactions: 214 };
const user = (keepOrStartFresh: typeof FACTS | null = FACTS) => ({
  id: "u1",
  name: "Somebody",
  email: "ada@ledgerflow.test",
  timezone: "America/Bogota",
  currency: "COP",
  locale: "en",
  lastLoginAt: null,
  keepOrStartFresh,
  createdAt: FACTS.createdAt,
  updatedAt: FACTS.createdAt,
});

const answered = () =>
  fetchMock.mock.calls
    .filter(([url]) => urlOf(url).endsWith("/keep-or-start-fresh"))
    .map(([, init]) => JSON.parse(init?.body as string) as unknown);

beforeEach(() => {
  replace.mockReset();
  push.mockReset();
  purgeVault.mockClear();
  fetchMock.mockReset();
  search = new URLSearchParams();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(navigator, "language", "get").mockReturnValue("es-CO");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderView(me = user()) {
  fetchMock.mockImplementation((input) =>
    Promise.resolve(
      urlOf(input).endsWith("/api/auth/me") ? json({ user: me }) : json({ user: user(null) }),
    ),
  );
  renderWithProviders(
    <QueryProvider>
      <KeepOrStartFreshView />
    </QueryProvider>,
  );
}

describe("KeepOrStartFreshView", () => {
  it("shows the three facts and never a name somebody typed", async () => {
    renderView();
    expect(
      await screen.findByRole("heading", { name: "Keep what’s in this account?" }),
    ).toBeVisible();
    expect(screen.getByText("Mar 12, 2026")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("214")).toBeInTheDocument();
    expect(screen.queryByText("Somebody")).not.toBeInTheDocument();
  });

  it("keeps the account and opens the app", async () => {
    renderView();
    fetchMock.mockResolvedValueOnce(json(user(null)));
    await userEvent.click(await screen.findByRole("button", { name: "Keep it" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/home");
    });
    expect(answered()).toEqual([{ choice: "keep" }]);
    expect(purgeVault).not.toHaveBeenCalled();
  });

  it("asks before starting fresh, through its own step", async () => {
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: "Start fresh" }));
    expect(push).toHaveBeenCalledWith({
      pathname: "/keep-or-start-fresh",
      query: { step: "confirm" },
    });
  });

  it("warns that everything goes for good, and only then asks for the details", async () => {
    search = new URLSearchParams("step=confirm");
    renderView();
    expect(await screen.findByText(/deleted for good/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete everything and start" }));
    expect(push).toHaveBeenCalledWith({
      pathname: "/keep-or-start-fresh",
      query: { step: "details" },
    });
    expect(answered()).toEqual([]);
  });

  it("starts fresh in one request with the new details, then drops this device's copy", async () => {
    search = new URLSearchParams("step=details");
    renderView();
    await userEvent.type(await screen.findByRole("textbox", { name: "Name" }), "Ada");
    fetchMock.mockResolvedValueOnce(json(user(null)));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/onboarding");
    });
    expect(answered()).toEqual([
      {
        choice: "start-fresh",
        name: "Ada",
        locale: "en",
        currency: "COP",
        timezone: expect.any(String) as string,
      },
    ]);
    expect(purgeVault).toHaveBeenCalledWith("u1", { discardPendingWork: false });
  });

  it("moves on when another tab already answered", async () => {
    renderView();
    fetchMock.mockResolvedValueOnce(json({ code: "KEEP_OR_START_FRESH_CLOSED" }, { status: 409 }));
    await userEvent.click(await screen.findByRole("button", { name: "Keep it" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/home");
    });
  });

  it("asks to sign in again when the session is older than the question", async () => {
    renderView();
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        urlOf(input).endsWith("/api/auth/me")
          ? json({ user: user() })
          : json({ code: "REFRESH_INVALID" }, { status: 401 }),
      ),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Keep it" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?reauth=1&next=/keep-or-start-fresh");
    });
  });

  it("asks to wait while another request is still starting fresh", async () => {
    search = new URLSearchParams("step=details");
    renderView();
    await userEvent.type(await screen.findByRole("textbox", { name: "Name" }), "Ada");
    fetchMock.mockResolvedValueOnce(json({ code: "START_FRESH_IN_PROGRESS" }, { status: 409 }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText(/still being prepared/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("lands a retried start-fresh the server already finished on onboarding", async () => {
    search = new URLSearchParams("step=details");
    renderView();
    await userEvent.type(await screen.findByRole("textbox", { name: "Name" }), "Ada");
    fetchMock.mockResolvedValueOnce(json({ code: "KEEP_OR_START_FRESH_CLOSED" }, { status: 409 }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/onboarding");
    });
    expect(purgeVault).toHaveBeenCalledWith("u1", { discardPendingWork: false });
  });

  it("goes to the app when there is no question to ask", async () => {
    renderView(user(null));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/home");
    });
  });
});
