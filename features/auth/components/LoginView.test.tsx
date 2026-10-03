import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";

import { carryEmail } from "../carry";
import { LoginView } from "./LoginView";

const replace = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/login",
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => search }));
vi.mock("@/lib/auth/marker", () => ({ readSessionMarker: () => null }));

const EMAIL = "ana@example.co";
const PASSWORD = "LedgerFlow!2026";
const DELETED = { deletedOn: "2026-09-28", keptUntil: "2026-10-28" };
const fetchMock = vi.fn<typeof fetch>();

const sentTo = (path: string) =>
  fetchMock.mock.calls
    .filter(([input]) => urlOf(input) === path)
    .map(([, init]) => JSON.parse(init?.body as string) as unknown);

beforeEach(() => {
  replace.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  search = new URLSearchParams();
  carryEmail("");
  reportOnline(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderView() {
  renderWithProviders(
    <QueryProvider>
      <LoginView />
    </QueryProvider>,
  );
}

async function signInToDeletedAccount(restore: () => Response) {
  fetchMock.mockImplementation((input) =>
    Promise.resolve(
      urlOf(input) === "/api/auth/login/restore"
        ? restore()
        : json(
            { code: "ACCOUNT_DELETED", message: "deleted", deletedAccount: DELETED },
            { status: 409 },
          ),
    ),
  );
  renderView();
  await userEvent.type(screen.getByLabelText("Email"), EMAIL);
  await userEvent.type(screen.getByLabelText("Password"), PASSWORD);
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByRole("heading", { name: "Restore your account?" });
}

describe("LoginView", () => {
  it("says until when a deleted account is kept, where Delete account lands", () => {
    search = new URLSearchParams({ deleted: "2026-10-28" });
    renderView();
    expect(screen.getByText("Your account was deleted.")).toBeInTheDocument();
    expect(
      screen.getByText("It’s kept until October 28, 2026: signing in before then restores it."),
    ).toBeInTheDocument();
  });

  it("asks before restoring a deleted account, with both dates, and restores with what was typed", async () => {
    await signInToDeletedAccount(() => json({ user: { id: "u1", name: "Ana" } }));
    expect(screen.getByText("September 28, 2026")).toBeInTheDocument();
    expect(screen.getByText("October 28, 2026")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Restore account" }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith({ pathname: "/home", query: { restored: "1" } });
    });
    expect(sentTo("/api/auth/login/restore")).toEqual([{ email: EMAIL, password: PASSWORD }]);
  });

  it("goes back to Sign in with the email, leaving the account deleted, on Not now", async () => {
    await signInToDeletedAccount(() => json({}));
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(await screen.findByLabelText("Email")).toHaveValue(EMAIL);
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(sentTo("/api/auth/login/restore")).toEqual([]);
  });

  it("says when nothing was restored, and when restoring needs a connection", async () => {
    await signInToDeletedAccount(() => json({ code: "INTERNAL" }, { status: 500 }));
    await userEvent.click(screen.getByRole("button", { name: "Restore account" }));
    expect(
      await screen.findByText("Something went wrong on our side. Nothing was restored: try again."),
    ).toBeInTheDocument();

    reportOnline(false);
    expect(await screen.findByText("Restoring needs a connection.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore account" })).toBeDisabled();
  });

  it("opens the confirmation step instead of the app for an account past its deadline", async () => {
    fetchMock.mockResolvedValue(
      json({ user: { id: "u1", name: "Ana", emailConfirmationRequired: true } }),
    );
    renderView();
    await userEvent.type(screen.getByLabelText("Email"), EMAIL);
    await userEvent.type(screen.getByLabelText("Password"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/confirm-to-continue");
    });
  });
});
