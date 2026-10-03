import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import type { SessionProfile } from "@/lib/session/api";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import { openTestVault, profile, wipeVaults } from "@/lib/testing/vault";

import { ConfirmToContinueView } from "./ConfirmToContinueView";

const replace = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/confirm-to-continue",
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
const token = vi.fn<() => Promise<string>>();
vi.mock("@/lib/captcha/useHumanCheck", () => ({
  useHumanCheck: () => ({ mount: vi.fn(), interactive: false, token }),
  HumanCheckSlot: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const EMAIL = "ada@ledgerflow.test";
const NEW_EMAIL = "ada.new@ledgerflow.test";
const fetchMock = vi.fn<typeof fetch>();

function me(overrides: Partial<SessionProfile> = {}): SessionProfile {
  return {
    ...profile({
      id: "u1",
      email: EMAIL,
      emailVerified: false,
      confirmBy: "2026-10-12",
      emailConfirmationRequired: true,
    }),
    emailVerification: { codeLive: false, lastSentAt: null, resendAvailableAt: null },
    emailChange: null,
    ...overrides,
  };
}

type Answer = (body: Record<string, unknown>) => Response;

function serve(
  user: SessionProfile | (() => SessionProfile),
  answers: Record<string, Answer> = {},
) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    if (url === "/api/auth/me")
      return Promise.resolve(json({ user: typeof user === "function" ? user() : user }));
    const answer = answers[url];
    return Promise.resolve(answer ? answer(body) : json({ message: url }, { status: 404 }));
  });
}

const sentTo = (path: string) =>
  fetchMock.mock.calls
    .filter(([input]) => urlOf(input) === path)
    .map(([, init]) => JSON.parse(init?.body as string) as unknown);

beforeEach(() => {
  replace.mockReset();
  fetchMock.mockReset();
  token.mockReset().mockResolvedValue("captcha-token");
  vi.stubGlobal("fetch", fetchMock);
  reportOnline(true);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await wipeVaults();
});

function renderView(onSignOut = vi.fn()) {
  renderWithProviders(
    <QueryProvider>
      <ConfirmToContinueView onSignOut={onSignOut} />
    </QueryProvider>,
  );
  return onSignOut;
}

describe("ConfirmToContinueView", () => {
  it("sends a code, confirms it and lets the account back in", async () => {
    serve(me(), {
      "/api/auth/resend": () => json({ resendAfterSeconds: 60 }, { status: 202 }),
      "/api/auth/verify": () => json({ message: "Email confirmed" }),
    });
    renderView();
    expect(
      await screen.findByRole("heading", { name: "Confirm your email to continue" }),
    ).toBeInTheDocument();
    expect(screen.getByText(EMAIL)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    await userEvent.type(await screen.findByLabelText("6-digit code"), "482719");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/home");
    });
    expect(sentTo("/api/auth/resend")).toEqual([{ captcha: "captcha-token" }]);
    expect(sentTo("/api/auth/verify")).toEqual([{ code: "482719" }]);
  });

  it("says what this device keeps for after the confirmation", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put("outbox", {
      seq: 1,
      opId: "op-1",
      opVersion: 1,
      entity: "transaction",
      entityId: "t1",
      action: "create",
      occurredAt: "2026-10-03T10:00:00.000Z",
      payload: { amount: 1 },
      dependsOn: [],
      status: "pending",
      attempts: 0,
      lastError: null,
    });
    vault.close();
    serve(me());
    renderView();
    expect(await screen.findByText("1 change on this device")).toBeInTheDocument();
  });

  it("moves the account to another address, whose code confirms it", async () => {
    let user = me();
    serve(() => user, {
      "/api/auth/change-email": () => {
        user = me({
          emailChange: {
            email: NEW_EMAIL,
            expiresAt: "2099-01-01T00:00:00.000Z",
            resendAvailableAt: "2000-01-01T00:00:00.000Z",
          },
        });
        return json({ emailChange: user.emailChange, resendAfterSeconds: 60 });
      },
      "/api/auth/confirm-change": () => json({ user: { ...user, email: NEW_EMAIL } }),
    });
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: "Change it" }));
    expect(screen.getByRole("heading", { name: "Use another email" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("New email"), NEW_EMAIL);
    await userEvent.type(screen.getByLabelText("Current password"), "LedgerFlow!2026");
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));

    expect(await screen.findByText(NEW_EMAIL)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("6-digit code"), "482719");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/home");
    });
    expect(sentTo("/api/auth/change-email")).toEqual([
      { email: NEW_EMAIL, currentPassword: "LedgerFlow!2026", captcha: "captcha-token" },
    ]);
  });

  it("says a wrong current password under its field", async () => {
    serve(me(), {
      "/api/auth/change-email": () =>
        json({ code: "CURRENT_PASSWORD_INVALID", message: "no" }, { status: 401 }),
    });
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: "Change it" }));
    await userEvent.type(screen.getByLabelText("New email"), NEW_EMAIL);
    await userEvent.type(screen.getByLabelText("Current password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("Your current password is wrong.")).toBeInTheDocument();
  });

  it("hands Sign out the account and what this device still holds", async () => {
    serve(me());
    const onSignOut = renderView();
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }), 0);
  });

  it("goes back to the app when the account no longer needs it", async () => {
    serve(me({ emailVerified: true, emailConfirmationRequired: false, confirmBy: null }));
    renderView();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/home");
    });
  });

  it("asks to sign in again when the session is gone", async () => {
    fetchMock.mockResolvedValue(json({ code: "REFRESH_INVALID" }, { status: 401 }));
    renderView();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?reauth=1&next=/confirm-to-continue");
    });
  });
});
