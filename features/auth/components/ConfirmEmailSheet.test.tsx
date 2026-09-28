import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/Toast";
import { reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import type { SessionProfile } from "@/lib/session/api";
import {
  confirmEmailStore,
  openConfirmEmail,
  openConfirmNewEmail,
} from "@/lib/session/confirm-email";
import { SessionProvider } from "@/lib/session/SessionProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import { profile } from "@/lib/testing/vault";

import { ConfirmEmailSheet } from "./ConfirmEmailSheet";

const push = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/home",
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
const fetchMock = vi.fn<typeof fetch>();

let startedAt = Date.now();
const at = (offsetMs: number) => new Date(startedAt + offsetMs).toISOString();

function me(overrides: Partial<SessionProfile> = {}): SessionProfile {
  return {
    ...profile({ email: EMAIL, emailVerified: false }),
    emailVerification: {
      codeLive: true,
      lastSentAt: at(-18_000),
      resendAvailableAt: at(42_000),
    },
    ...overrides,
  };
}

type Answer = (body: Record<string, unknown>) => Response;

function serve({
  user = me(),
  verify,
  resend,
  confirmChange,
  resendChange,
}: {
  user?: SessionProfile;
  verify?: Answer;
  resend?: Answer;
  confirmChange?: Answer;
  resendChange?: Answer;
}) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    if (url.endsWith("/api/auth/me")) return Promise.resolve(json({ user }));
    if (url.endsWith("/api/auth/verify") && verify) return Promise.resolve(verify(body));
    if (url.endsWith("/api/auth/resend") && resend) return Promise.resolve(resend(body));
    if (url.endsWith("/api/auth/confirm-change") && confirmChange)
      return Promise.resolve(confirmChange(body));
    if (url.endsWith("/api/auth/change-email/resend") && resendChange)
      return Promise.resolve(resendChange(body));
    return Promise.resolve(json({ error: "NotFound", message: url }, { status: 404 }));
  });
}

const sentTo = (path: string) =>
  fetchMock.mock.calls
    .filter(([url]) => urlOf(url).endsWith(path))
    .map(([, init]) => JSON.parse(init?.body as string) as Record<string, unknown>);

const failure = (code: string, status: number) =>
  json({ error: "Error", message: code, code }, { status });

function renderSheet(initialUser: SessionProfile = me(), open = openConfirmEmail) {
  open();
  renderWithProviders(
    <QueryProvider>
      <SessionProvider initialUser={initialUser} onSignedOut={vi.fn()}>
        <ToastProvider>
          <ConfirmEmailSheet />
        </ToastProvider>
      </SessionProvider>
    </QueryProvider>,
  );
}

async function typeCode(code: string) {
  const field = await screen.findByLabelText("6-digit code");
  await userEvent.clear(field);
  await userEvent.type(field, code);
}

beforeEach(() => {
  startedAt = Date.now();
  push.mockReset();
  fetchMock.mockReset();
  token.mockReset().mockResolvedValue("captcha-token");
  vi.stubGlobal("fetch", fetchMock);
  reportOnline(true);
});

afterEach(() => {
  confirmEmailStore.reset();
  vi.unstubAllGlobals();
});

describe("ConfirmEmailSheet", () => {
  it("takes the code a live email carries, and closes saying the email is confirmed", async () => {
    serve({ verify: () => json({ message: "Email confirmed" }) });
    renderSheet();

    expect(await screen.findByText(/We sent a 6-digit code to/)).toHaveTextContent(
      `We sent a 6-digit code to ${EMAIL}. It works for 24 hours.`,
    );
    expect(screen.getByText(/You can resend it in 0:4\d/)).toBeInTheDocument();

    await typeCode("482719");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("Email confirmed")).toBeInTheDocument();
    expect(sentTo("/api/auth/verify")).toEqual([{ code: "482719" }]);
    expect(confirmEmailStore.getSnapshot().sheetOpen).toBe(false);
    expect(token).not.toHaveBeenCalled();
  });

  it("says a wrong code and waits for another before Confirm works again", async () => {
    serve({ verify: () => failure("EMAIL_CODE_INVALID", 400) });
    renderSheet();

    await typeCode("111111");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(
      await screen.findByText("That code isn’t right. Check the last email we sent."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    await typeCode("222222");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
  });

  it("turns to Send code when the code stopped working, and sends a new one with the check", async () => {
    const user = me({
      emailVerification: {
        codeLive: true,
        lastSentAt: at(-120_000),
        resendAvailableAt: at(-60_000),
      },
    });
    serve({
      user,
      verify: () => failure("EMAIL_CODE_EXPIRED", 400),
      resend: () => json({ resendAfterSeconds: 60 }, { status: 202 }),
    });
    renderSheet(user);

    await typeCode("333333");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText(/This code no longer works/)).toBeInTheDocument();
    expect(screen.getByText(/We’ll send a 6-digit code to/)).toHaveTextContent(EMAIL);

    await userEvent.click(screen.getByRole("button", { name: "Send code" }));

    expect(await screen.findByText(/We sent a 6-digit code to/)).toBeInTheDocument();
    expect(sentTo("/api/auth/resend")).toEqual([{ captcha: "captcha-token" }]);
    expect(screen.getByText(/You can resend it in 1:00|You can resend it in 0:59/)).toBeVisible();
  });

  it("offers Send code to an account with no live code, and says an email that did not go", async () => {
    const user = me({
      emailVerification: { codeLive: false, lastSentAt: null, resendAvailableAt: null },
    });
    serve({ user, resend: () => failure("EMAIL_SEND_FAILED", 503) });
    renderSheet(user);

    await userEvent.click(await screen.findByRole("button", { name: "Send code" }));

    expect(await screen.findByText("We couldn’t send the email.")).toBeInTheDocument();
    expect(screen.getByText("Try again in a few minutes.")).toBeInTheDocument();
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
  });

  it("sends nothing when Cloudflare's check fails, and waits out a limit", async () => {
    const user = me({
      emailVerification: { codeLive: false, lastSentAt: null, resendAvailableAt: null },
    });
    serve({
      user,
      resend: () =>
        new Response(JSON.stringify({ error: "Too many", code: "RATE_LIMITED" }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "40" },
        }),
    });
    renderSheet(user);

    token.mockRejectedValueOnce(new Error("blocked"));
    await userEvent.click(await screen.findByRole("button", { name: "Send code" }));
    expect(await screen.findByText(/We couldn’t check that you’re a person/)).toBeInTheDocument();
    expect(sentTo("/api/auth/resend")).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText(/You can resend it in 0:(40|39)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();
  });

  it("keeps Send code waiting while the last email's countdown runs", async () => {
    const user = me({
      emailVerification: {
        codeLive: false,
        lastSentAt: new Date().toISOString(),
        resendAvailableAt: at(30_000),
      },
    });
    serve({ user });
    renderSheet(user);

    expect(await screen.findByText(/You can resend it in 0:(30|29)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();
  });

  it("closes as confirmed when Send finds the email already confirmed, and asks /me again", async () => {
    const user = me({
      emailVerification: { codeLive: false, lastSentAt: null, resendAvailableAt: null },
    });
    serve({ user, resend: () => failure("EMAIL_ALREADY_VERIFIED", 409) });
    renderSheet(user);
    await screen.findByRole("button", { name: "Send code" });
    const asked = () =>
      fetchMock.mock.calls.filter(([url]) => urlOf(url).endsWith("/api/auth/me")).length;
    const before = asked();

    await userEvent.click(screen.getByRole("button", { name: "Send code" }));

    expect(await screen.findByText("Email confirmed")).toBeInTheDocument();
    await waitFor(() => {
      expect(asked()).toBeGreaterThan(before);
    });
    expect(screen.getAllByText("Email confirmed")).toHaveLength(1);
  });

  it("says a token Cloudflare refused on the server as the check failing", async () => {
    const user = me({
      emailVerification: { codeLive: false, lastSentAt: null, resendAvailableAt: null },
    });
    serve({ user, resend: () => failure("CAPTCHA_INVALID", 400) });
    renderSheet(user);

    await userEvent.click(await screen.findByRole("button", { name: "Send code" }));

    expect(await screen.findByText(/We couldn’t check that you’re a person/)).toBeInTheDocument();
  });

  it("restarts Resend's countdown on a limit, and keeps the code usable when a resend fails", async () => {
    let resends = 0;
    const user = me({
      emailVerification: {
        codeLive: true,
        lastSentAt: at(-60_000),
        resendAvailableAt: at(-1_000),
      },
    });
    serve({
      user,
      verify: () => json({ message: "Email confirmed" }),
      resend: () => {
        resends += 1;
        return resends === 1
          ? new Response(JSON.stringify({ error: "Too many", code: "RATE_LIMITED" }), {
              status: 429,
              headers: { "content-type": "application/json", "retry-after": "50" },
            })
          : failure("EMAIL_SEND_FAILED", 503);
      },
    });
    renderSheet(user);

    await userEvent.click(await screen.findByRole("button", { name: "Resend code" }));
    expect(await screen.findByText(/You can resend it in 0:(50|49)/)).toBeInTheDocument();
    expect(screen.queryByText("Too many requests.")).not.toBeInTheDocument();
  });

  it("opens on what /me answers, not on the copy it had", async () => {
    serve({
      user: me({
        emailVerification: { codeLive: false, lastSentAt: null, resendAvailableAt: null },
      }),
    });
    renderSheet(me());

    expect(await screen.findByRole("button", { name: "Send code" })).toBeEnabled();
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
  });

  it("keeps the digits after a failure on our side", async () => {
    serve({ verify: () => json({ error: "Oops", code: "INTERNAL" }, { status: 500 }) });
    renderSheet();

    await typeCode("482719");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(
      await screen.findByText("Something went wrong on our side. Nothing changed: try again."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("6-digit code")).toHaveValue("482719");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
  });

  it("closes as confirmed when the email was confirmed elsewhere meanwhile", async () => {
    serve({ user: me({ emailVerified: true }) });
    renderSheet();

    expect(await screen.findByText("Email confirmed")).toBeInTheDocument();
    await waitFor(() => {
      expect(confirmEmailStore.getSnapshot().sheetOpen).toBe(false);
    });
  });

  it("says it needs a connection, with its controls off", async () => {
    serve({});
    reportOnline(false);
    renderSheet();

    await screen.findByText("Confirming your email needs a connection.");
    await waitFor(() => {
      expect(screen.getByText("Confirming your email needs a connection.")).toBeVisible();
      expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
      expect(screen.getByLabelText("6-digit code")).toBeDisabled();
    });
  });

  it("takes a mistyped address to Profile & security", async () => {
    serve({});
    renderSheet();

    await userEvent.click(await screen.findByRole("button", { name: "Change it" }));

    expect(push).toHaveBeenCalledWith("/settings/profile");
    expect(confirmEmailStore.getSnapshot().sheetOpen).toBe(false);
  });

  describe("for a new address", () => {
    const NEW = "new@ledgerflow.test";
    const waiting = (overrides: Partial<SessionProfile> = {}) =>
      me({
        emailVerified: true,
        emailVerification: null,
        emailChange: {
          email: NEW,
          expiresAt: at(86_400_000),
          resendAvailableAt: at(42_000),
        },
        ...overrides,
      });

    it("takes the code the new address got, and says every other device was signed out", async () => {
      serve({
        user: waiting(),
        confirmChange: () => json({ user: { ...waiting(), email: NEW, emailChange: undefined } }),
      });
      renderSheet(waiting(), openConfirmNewEmail);

      expect(await screen.findByRole("dialog", { name: "Confirm your new email" })).toBeVisible();
      expect(await screen.findByText(/We sent a 6-digit code to/)).toHaveTextContent(
        `We sent a 6-digit code to ${NEW}. It works for 24 hours.`,
      );
      await typeCode("482719");
      await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

      expect(
        await screen.findByText(`Your email is now ${NEW}. Every other device was signed out.`),
      ).toBeInTheDocument();
      expect(sentTo("/api/auth/confirm-change")).toEqual([{ code: "482719" }]);
      expect(confirmEmailStore.getSnapshot().sheetOpen).toBe(false);
    });

    it("resends to the new address with the email-change check", async () => {
      const user = waiting({
        emailChange: {
          email: NEW,
          expiresAt: at(86_400_000),
          resendAvailableAt: null,
        },
      });
      serve({
        user,
        resendChange: () =>
          json(
            {
              resendAfterSeconds: 60,
              emailChange: { email: NEW, expiresAt: at(86_400_000), resendAvailableAt: at(60_000) },
            },
            { status: 202 },
          ),
      });
      renderSheet(user, openConfirmNewEmail);

      const field = await screen.findByLabelText("6-digit code");
      await userEvent.click(screen.getByRole("button", { name: "Resend code" }));

      await waitFor(() => {
        expect(sentTo("/api/auth/change-email/resend")).toEqual([{ captcha: "captcha-token" }]);
      });
      expect(await screen.findByText(/You can resend it in 0:[56]\d|1:00/)).toBeInTheDocument();
      expect(field).toBeInTheDocument();
    });

    it("ends with the address taken by another account, its code and buttons gone", async () => {
      const user = waiting();
      serve({ user, confirmChange: () => failure("EMAIL_TAKEN", 409) });
      renderSheet(user, openConfirmNewEmail);

      await typeCode("482719");
      await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

      expect(
        await screen.findByText("That address now belongs to another account."),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    });

    it("says nothing waits any more when /me no longer has the change", async () => {
      serve({ user: waiting({ emailChange: null }) });
      renderSheet(waiting(), openConfirmNewEmail);

      expect(await screen.findByText("This change isn’t waiting any more.")).toBeInTheDocument();
      expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
    });

    it("says nothing waits any more when the code finds the change gone", async () => {
      const user = waiting();
      serve({ user, confirmChange: () => failure("EMAIL_CHANGE_NOT_PENDING", 409) });
      renderSheet(user, openConfirmNewEmail);

      await typeCode("482719");
      await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

      expect(await screen.findByText("This change isn’t waiting any more.")).toBeInTheDocument();
    });
  });
});
