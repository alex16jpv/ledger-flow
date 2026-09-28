import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";

import { keepLinkToken } from "../carry";
import { ConfirmNewEmailLinkView, NotMeLinkView, VerifyLinkView } from "./EmailLinkView";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const TOKEN = "t".repeat(96);
const fetchMock = vi.fn<typeof fetch>();

const sentTo = (path: string) =>
  fetchMock.mock.calls
    .filter(([url]) => urlOf(url).endsWith(path))
    .map(([, init]) => JSON.parse(init?.body as string) as Record<string, unknown>);

function arriveWith(path: string, token: string | null) {
  window.history.replaceState(null, "", token ? `${path}#token=${token}` : path);
}

function renderPage(page: ReactNode) {
  renderWithProviders(<QueryProvider>{page}</QueryProvider>);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  reportOnline(true);
  keepLinkToken("verify", null);
  keepLinkToken("not-me", null);
  keepLinkToken("confirm-email", null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("VerifyLinkView", () => {
  it("takes the token out of the address and spends it only on the tap", async () => {
    arriveWith("/verify", TOKEN);
    fetchMock.mockResolvedValue(json({ message: "Email confirmed" }));
    renderPage(<VerifyLinkView />);

    const button = await screen.findByRole("button", { name: "Confirm email" });
    expect(window.location.hash).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(button);

    expect(await screen.findByRole("heading", { name: "Email confirmed" })).toBeInTheDocument();
    expect(sentTo("/api/auth/verify")).toEqual([{ token: TOKEN }]);
    expect(screen.getByRole("link", { name: "Open Ledger Flow" })).toHaveAttribute("href", "/home");
  });

  it("says a used, expired or replaced link no longer works, and leads to the app", async () => {
    arriveWith("/verify", TOKEN);
    fetchMock.mockResolvedValue(
      json({ error: "Bad", message: "gone", code: "LINK_INVALID" }, { status: 400 }),
    );
    renderPage(<VerifyLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Confirm email" }));

    expect(
      await screen.findByRole("heading", { name: "This link no longer works" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/A confirmation link works for 24 hours/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Ledger Flow" })).toHaveAttribute("href", "/home");
  });

  it("keeps the token after a failure on our side, and waits for a connection", async () => {
    arriveWith("/verify", TOKEN);
    fetchMock
      .mockResolvedValueOnce(json({ error: "Oops", code: "INTERNAL" }, { status: 500 }))
      .mockResolvedValueOnce(json({ message: "Email confirmed" }));
    renderPage(<VerifyLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Confirm email" }));
    expect(
      await screen.findByText("Something went wrong on our side. Nothing changed: try again."),
    ).toBeInTheDocument();

    reportOnline(false);
    expect(await screen.findByText("This needs a connection.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm email" })).toBeDisabled();

    reportOnline(true);
    await userEvent.click(await screen.findByRole("button", { name: "Confirm email" }));
    expect(await screen.findByRole("heading", { name: "Email confirmed" })).toBeInTheDocument();
    expect(sentTo("/api/auth/verify")).toEqual([{ token: TOKEN }, { token: TOKEN }]);
  });

  it("waits out a limit with the button off", async () => {
    arriveWith("/verify", TOKEN);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Too many", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "30" },
      }),
    );
    renderPage(<VerifyLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Confirm email" }));

    expect(await screen.findByText("Too many attempts.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm email" })).toBeDisabled();
  });

  it("says the page lost its link when the address brought none", async () => {
    arriveWith("/verify", null);
    renderPage(<VerifyLinkView />);
    expect(await screen.findByText(/This page lost its link/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm email" })).not.toBeInTheDocument();
  });
});

describe("NotMeLinkView", () => {
  it("warns before it erases, offers not to, and frees the address", async () => {
    arriveWith("/not-me", TOKEN);
    fetchMock.mockResolvedValue(json({ message: "Deleted" }));
    renderPage(<NotMeLinkView />);

    expect(await screen.findByText("If you signed up yourself, don’t.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Don’t delete it" })).toHaveAttribute("href", "/login");

    await userEvent.click(screen.getByRole("button", { name: "Delete that account" }));

    expect(
      await screen.findByRole("heading", { name: "That account is gone" }),
    ).toBeInTheDocument();
    expect(sentTo("/api/auth/not-me")).toEqual([{ token: TOKEN }]);
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("sends a link that no longer works to Forgot your password?", async () => {
    arriveWith("/not-me", TOKEN);
    fetchMock.mockResolvedValue(
      json({ error: "Bad", message: "gone", code: "LINK_INVALID" }, { status: 400 }),
    );
    renderPage(<NotMeLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Delete that account" }));

    expect(await screen.findByText(/It only works while the account is unconfirmed/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
      "href",
      "/forgot",
    );
  });
});

describe("ConfirmNewEmailLinkView", () => {
  it("moves the account only on the tap, and says every other device was signed out", async () => {
    arriveWith("/confirm-email", TOKEN);
    fetchMock.mockResolvedValue(json({}));
    renderPage(<ConfirmNewEmailLinkView />);

    const button = await screen.findByRole("button", { name: "Confirm new email" });
    expect(
      screen.getByRole("heading", { name: "Move your account to this address?" }),
    ).toBeVisible();
    expect(window.location.hash).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(button);

    expect(await screen.findByRole("heading", { name: "Your email changed" })).toBeInTheDocument();
    expect(
      screen.getByText("Every other device was signed out. Sign in with this address from now on."),
    ).toBeInTheDocument();
    expect(sentTo("/api/auth/confirm-change")).toEqual([{ token: TOKEN }]);
    expect(screen.getByRole("link", { name: "Open Ledger Flow" })).toHaveAttribute("href", "/home");
  });

  it("says the address became another account's, and that this one keeps its email", async () => {
    arriveWith("/confirm-email", TOKEN);
    fetchMock.mockResolvedValue(
      json({ error: "Conflict", message: "taken", code: "EMAIL_TAKEN" }, { status: 409 }),
    );
    renderPage(<ConfirmNewEmailLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Confirm new email" }));

    expect(
      await screen.findByRole("heading", { name: "That address now belongs to another account" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Your account keeps its current email.")).toBeInTheDocument();
  });

  it("reads a used link as one that no longer works", async () => {
    arriveWith("/confirm-email", TOKEN);
    fetchMock.mockResolvedValue(
      json({ error: "Bad", message: "gone", code: "LINK_INVALID" }, { status: 400 }),
    );
    renderPage(<ConfirmNewEmailLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Confirm new email" }));

    expect(
      await screen.findByRole("heading", { name: "This link no longer works" }),
    ).toBeInTheDocument();
  });
});
