import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";

import { carriedEmail, carryEmail, keepLinkToken, lastSentCode, rememberSentCode } from "../carry";
import {
  ConfirmNewEmailLinkView,
  RestoreLinkView,
  UndoLinkView,
  VerifyLinkView,
} from "./EmailLinkView";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    onClick,
  }: {
    children: ReactNode;
    href: string;
    onClick?: () => void;
  }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

const TOKEN = "t".repeat(43);
const DEADLINE_TOKEN = "d".repeat(64);
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
  keepLinkToken("restore", null);
  keepLinkToken("undo", null);
  keepLinkToken("confirm-email", null);
  rememberSentCode(null);
  carryEmail("");
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("VerifyLinkView", () => {
  it("takes the token out of the address and spends it only on the tap", async () => {
    arriveWith("/verify", TOKEN);
    fetchMock.mockResolvedValue(json({ message: "Email confirmed", result: "email-confirmed" }));
    renderPage(<VerifyLinkView />);

    const button = await screen.findByRole("button", { name: "Confirm email" });
    expect(window.location.hash).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(button);

    expect(await screen.findByRole("heading", { name: "Email confirmed" })).toBeInTheDocument();
    expect(screen.getByText("Nothing else changes in your account.")).toBeInTheDocument();
    expect(sentTo("/api/auth/verify")).toEqual([{ token: TOKEN }]);
    expect(screen.getByRole("link", { name: "Open Ledger Flow" })).toHaveAttribute("href", "/home");
  });

  it("finishes a sign-up without signing in, and sends to Sign in", async () => {
    arriveWith("/verify", TOKEN);
    fetchMock.mockResolvedValue(json({ message: "Account created", result: "account-ready" }));
    renderPage(<VerifyLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Confirm email" }));

    expect(
      await screen.findByRole("heading", { name: "Your account is ready" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sign in with this email and the password you chose."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("offers both ways on for a dead sign-up or confirmation link, which look the same", async () => {
    arriveWith("/verify", TOKEN);
    fetchMock.mockResolvedValue(
      json({ error: "Bad", message: "gone", code: "LINK_INVALID" }, { status: 400 }),
    );
    renderPage(<VerifyLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Confirm email" }));

    expect(
      await screen.findByRole("heading", { name: "This link no longer works" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A link to create an account or to confirm an email works for 24 hours/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: "Open Ledger Flow" })).toHaveAttribute("href", "/home");
  });

  it("tells a dead deadline link by its token, and leads only to the app", async () => {
    arriveWith("/verify", DEADLINE_TOKEN);
    fetchMock.mockResolvedValue(
      json({ error: "Bad", message: "gone", code: "LINK_INVALID" }, { status: 400 }),
    );
    renderPage(<VerifyLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Confirm email" }));

    expect(
      await screen.findByText("This link worked until its deadline, and only once."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create account" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Ledger Flow" })).toHaveAttribute("href", "/home");
  });

  it("keeps the token after a failure on our side, and waits for a connection", async () => {
    arriveWith("/verify", TOKEN);
    fetchMock
      .mockResolvedValueOnce(json({ error: "Oops", code: "INTERNAL" }, { status: 500 }))
      .mockResolvedValueOnce(json({ message: "Email confirmed", result: "email-confirmed" }));
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

describe("RestoreLinkView", () => {
  it("warns what the tap does, and opens the code screen for the address the code went to", async () => {
    arriveWith("/restore", TOKEN);
    fetchMock.mockResolvedValue(json({ email: "ana@example.co", codeSent: true }));
    renderPage(<RestoreLinkView />);

    expect(await screen.findByText(/your current password stops working/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Restore account" }));

    expect(await screen.findByRole("heading", { name: "Account restored" })).toBeInTheDocument();
    expect(sentTo("/api/auth/restore")).toEqual([{ token: TOKEN }]);
    const enter = screen.getByRole("link", { name: "Enter the code" });
    expect(enter).toHaveAttribute("href", "/forgot");
    await userEvent.click(enter);
    expect(lastSentCode()?.email).toBe("ana@example.co");
  });

  it("does not promise a code that could not go, and points to Forgot your password?", async () => {
    arriveWith("/restore", TOKEN);
    fetchMock.mockResolvedValue(json({ email: "ana@example.co", codeSent: false }));
    renderPage(<RestoreLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Restore account" }));

    expect(await screen.findByText(/We couldn’t send the code/)).toBeInTheDocument();
    expect(screen.queryByText(/We sent a code/)).not.toBeInTheDocument();
    const forgot = screen.getByRole("link", { name: "Forgot your password?" });
    await userEvent.click(forgot);
    expect(lastSentCode()).toBeNull();
    expect(carriedEmail()).toBe("ana@example.co");
  });

  it("says a used or old restore link no longer works", async () => {
    arriveWith("/restore", TOKEN);
    fetchMock.mockResolvedValue(
      json({ error: "Bad", message: "gone", code: "LINK_INVALID" }, { status: 400 }),
    );
    renderPage(<RestoreLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Restore account" }));

    expect(await screen.findByText(/A restore link works for 7 days/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
      "href",
      "/forgot",
    );
  });
});

describe("UndoLinkView", () => {
  it("undoes nothing on opening, and opens the code screen for the original address", async () => {
    arriveWith("/undo", TOKEN);
    fetchMock.mockResolvedValue(json({ email: "ana@example.co", codeSent: true }));
    renderPage(<UndoLinkView />);

    expect(await screen.findByRole("heading", { name: "Undo the change?" })).toBeInTheDocument();
    expect(screen.getByText(/your current password stops working/)).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Undo the change" }));

    expect(await screen.findByRole("heading", { name: "Change undone" })).toBeInTheDocument();
    expect(sentTo("/api/auth/undo")).toEqual([{ token: TOKEN }]);
    expect(screen.getByText(/We sent a code to this address/)).toBeInTheDocument();
    const enter = screen.getByRole("link", { name: "Enter the code" });
    expect(enter).toHaveAttribute("href", "/forgot");
    await userEvent.click(enter);
    expect(lastSentCode()?.email).toBe("ana@example.co");
  });

  it("does not promise a code that could not go, and carries the address to Forgot your password?", async () => {
    arriveWith("/undo", TOKEN);
    fetchMock.mockResolvedValue(json({ email: "ana@example.co", codeSent: false }));
    renderPage(<UndoLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Undo the change" }));

    expect(await screen.findByRole("heading", { name: "Change undone" })).toBeInTheDocument();
    expect(screen.getByText(/We couldn’t send the code/)).toBeInTheDocument();
    expect(screen.queryByText(/We sent a code/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Forgot your password?" }));
    expect(lastSentCode()).toBeNull();
    expect(carriedEmail()).toBe("ana@example.co");
  });

  it("says a used, old or overtaken undo link no longer works, with Forgot your password? as the way on", async () => {
    arriveWith("/undo", TOKEN);
    fetchMock.mockResolvedValue(
      json({ error: "Bad", message: "gone", code: "LINK_INVALID" }, { status: 400 }),
    );
    renderPage(<UndoLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Undo the change" }));

    expect(
      await screen.findByRole("heading", { name: "This link no longer works" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/An undo link works for 7 days and only once/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Forgot your password?" }));
    expect(carriedEmail()).toBe("");
  });

  it("keeps the token after a failure on our side, so the tap can be tried again", async () => {
    arriveWith("/undo", TOKEN);
    fetchMock
      .mockResolvedValueOnce(
        json({ error: "Down", message: "x", code: "INTERNAL" }, { status: 503 }),
      )
      .mockResolvedValueOnce(json({ email: "ana@example.co", codeSent: true }));
    renderPage(<UndoLinkView />);

    await userEvent.click(await screen.findByRole("button", { name: "Undo the change" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Undo the change" }));

    expect(await screen.findByRole("heading", { name: "Change undone" })).toBeInTheDocument();
    expect(sentTo("/api/auth/undo")).toEqual([{ token: TOKEN }, { token: TOKEN }]);
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
