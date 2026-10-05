import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/Toast";
import type * as Flags from "@/lib/flags";
import type { FeatureFlag } from "@/lib/flags";
import { QueryProvider } from "@/lib/query/QueryProvider";
import type { SessionProfile } from "@/lib/session/api";
import { confirmEmailStore } from "@/lib/session/confirm-email";
import { SessionProvider, useSession } from "@/lib/session/SessionProvider";
import { renderWithProviders } from "@/lib/testing/render";
import type { User } from "@/types/api";

import { ProfileView } from "./ProfileView";

const flow = { on: true };
vi.mock("@/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof Flags>();
  return {
    ...actual,
    isEnabled: (flag: FeatureFlag) =>
      flag === "emailVerification" ? flow.on : actual.isEnabled(flag),
  };
});

const token = vi.fn<() => Promise<string>>();
vi.mock("@/lib/captcha/useHumanCheck", () => ({
  useHumanCheck: () => ({ mount: vi.fn(), interactive: false, token }),
  HumanCheckSlot: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const user: User = {
  id: "u1",
  name: "Ana",
  email: "ana@ledgerflow.test",
  emailVerified: true,
  timezone: "America/Bogota",
  currency: "COP",
  locale: "en",
  theme: null,
  lastLoginAt: null,
  confirmBy: null,
  emailConfirmationRequired: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function renderView(onSaved = vi.fn(), shown: SessionProfile = user) {
  renderWithProviders(
    <QueryProvider>
      <SessionProvider onSignedOut={vi.fn()}>
        <ToastProvider>
          <ProfileView user={shown} onSaved={onSaved} />
        </ToastProvider>
      </SessionProvider>
    </QueryProvider>,
  );
  return onSaved;
}

const failure = (code: string, status: number) =>
  json({ error: "Error", message: code, code }, { status });

const sent = (path: string) =>
  fetchMock.mock.calls
    .filter(([input]) => urlOf(input) === path)
    .map(([, init]) => JSON.parse(init?.body as string) as Record<string, unknown>);

const waiting = {
  email: "new@ledgerflow.test",
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  resendAvailableAt: new Date(Date.now() + 42_000).toISOString(),
};

async function askForNewEmail(address = "new@ledgerflow.test") {
  const email = screen.getByLabelText("Email");
  await userEvent.clear(email);
  await userEvent.type(email, address);
  await userEvent.type(screen.getByLabelText("Current password"), "OldPass!2026");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

beforeEach(() => {
  flow.on = true;
  token.mockReset().mockResolvedValue("captcha-token");
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    if (url.startsWith("/api/auth/me")) return Promise.resolve(json({ user }));
    if (init?.method === "PUT") return Promise.resolve(json({ ...user, name: "Ana María" }));
    if (init?.method === "POST") return Promise.resolve(json({ user, accessToken: "a" }));
    return Promise.resolve(json({}));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  confirmEmailStore.reset();
  vi.unstubAllGlobals();
});

describe("ProfileView", () => {
  it("marks an email not confirmed beside its label, and opens the code sheet from its help", async () => {
    renderView(vi.fn(), { ...user, emailVerified: false });
    expect(screen.getByText("Not confirmed")).toBeInTheDocument();
    expect(screen.getByText(/Confirm it to invite people to Shared/)).toBeInTheDocument();
    expect(screen.queryByText(/A new address gets a code first/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm it" }));
    expect(confirmEmailStore.getSnapshot().sheetOpen).toBe(true);
  });

  it("names the deadline in the help once the account has one", () => {
    renderView(vi.fn(), { ...user, emailVerified: false, confirmBy: "2026-10-12" });
    expect(
      screen.getByText(/Confirm it by October 12 to keep signing in as usual/),
    ).toBeInTheDocument();
  });

  it("asks the new address to confirm itself, and changes nothing else", async () => {
    fetchMock.mockImplementation((input) => {
      const url = urlOf(input);
      if (url.startsWith("/api/auth/me")) return Promise.resolve(json({ user }));
      if (url === "/api/auth/change-email")
        return Promise.resolve(
          json({ resendAfterSeconds: 60, emailChange: waiting }, { status: 202 }),
        );
      return Promise.resolve(json({}));
    });
    const onSaved = renderView();
    expect(
      screen.getByText(/A new address gets a code first: the change happens once you confirm it/),
    ).toBeInTheDocument();
    await askForNewEmail();
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({
        reauthenticated: false,
        newEmail: "new@ledgerflow.test",
        emailRefused: false,
      });
    });
    expect(sent("/api/auth/change-email")).toEqual([
      { email: "new@ledgerflow.test", currentPassword: "OldPass!2026", captcha: "captcha-token" },
    ]);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
    expect(screen.getByLabelText("Email")).toHaveValue(user.email);
  });

  it("saves a new password first and asks for the address with it, which the change would cancel otherwise", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.startsWith("/api/auth/me")) return Promise.resolve(json({ user }));
      if (url === "/api/auth/change-email")
        return Promise.resolve(
          json({ resendAfterSeconds: 60, emailChange: waiting }, { status: 202 }),
        );
      if (init?.method === "PUT") return Promise.resolve(json(user));
      if (init?.method === "POST") return Promise.resolve(json({ user, accessToken: "a" }));
      return Promise.resolve(json({}));
    });
    const onSaved = renderView();
    await userEvent.type(screen.getByLabelText(/^New password/), "Str0ngPass!");
    await askForNewEmail();
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({
        reauthenticated: true,
        newEmail: "new@ledgerflow.test",
        emailRefused: false,
      });
    });
    const order = fetchMock.mock.calls
      .map(([input, init]) => `${init?.method ?? "GET"} ${urlOf(input)}`)
      .filter((call) => !call.includes("/api/auth/me"));
    expect(order).toEqual([
      "PUT /api/users/u1",
      "POST /api/auth/login",
      "POST /api/auth/change-email",
    ]);
    expect(sent("/api/auth/change-email")).toEqual([
      { email: "new@ledgerflow.test", currentPassword: "Str0ngPass!", captcha: "captcha-token" },
    ]);
  });

  it("keeps a saved password when the address is refused after it, and says the email did not change", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.startsWith("/api/auth/me")) return Promise.resolve(json({ user }));
      if (url === "/api/auth/change-email")
        return Promise.resolve(failure("EMAIL_SEND_FAILED", 422));
      if (init?.method === "PUT") return Promise.resolve(json(user));
      if (init?.method === "POST") return Promise.resolve(json({ user, accessToken: "a" }));
      return Promise.resolve(json({}));
    });
    const onSaved = renderView();
    await userEvent.type(screen.getByLabelText(/^New password/), "Str0ngPass!");
    await askForNewEmail("bounced@ledgerflow.test");
    expect(
      await screen.findByText("We can’t send email to this address. Check it, or use another one."),
    ).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledWith({
      reauthenticated: true,
      newEmail: null,
      emailRefused: true,
    });
    expect(screen.getByLabelText(/^Email/)).toHaveValue("bounced@ledgerflow.test");
    expect(screen.getByLabelText(/^New password/)).toHaveValue("");
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("saves nothing when Cloudflare's check is refused, not even the password", async () => {
    token.mockRejectedValueOnce(new Error("blocked"));
    const onSaved = renderView();
    await userEvent.type(screen.getByLabelText(/^New password/), "Str0ngPass!");
    await askForNewEmail();
    expect(await screen.findByText("We couldn’t check that you’re a person.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("says a wrong current password under its field, after one request only", async () => {
    fetchMock.mockImplementation((input) => {
      if (urlOf(input) === "/api/auth/change-email")
        return Promise.resolve(failure("CURRENT_PASSWORD_INVALID", 401));
      return Promise.resolve(json({ user }));
    });
    renderView();
    await askForNewEmail();
    expect(await screen.findByText("Your current password is wrong.")).toBeInTheDocument();
    expect(sent("/api/auth/change-email")).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([input]) => urlOf(input) === "/api/auth/refresh")).toBe(
      false,
    );
    expect(screen.queryByText("We couldn’t check that you’re a person.")).not.toBeInTheDocument();
  });

  it("does not ask for the address when the password failed before it", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.startsWith("/api/auth/me")) return Promise.resolve(json({ user }));
      if (init?.method === "PUT") return Promise.resolve(failure("DB_UNAVAILABLE", 503));
      return Promise.resolve(json({}));
    });
    const onSaved = renderView();
    await userEvent.type(screen.getByLabelText(/^New password/), "Str0ngPass!");
    await askForNewEmail();
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true);
    });
    expect(sent("/api/auth/change-email")).toHaveLength(0);
    expect(screen.getByLabelText(/^Email/)).toHaveValue("new@ledgerflow.test");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("keeps a saved name when the address is refused after it, and empties the current password", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.startsWith("/api/auth/me")) return Promise.resolve(json({ user }));
      if (url === "/api/auth/change-email")
        return Promise.resolve(failure("EMAIL_SEND_FAILED", 422));
      if (init?.method === "PUT") return Promise.resolve(json({ ...user, name: "Ana María" }));
      return Promise.resolve(json({}));
    });
    const onSaved = renderView();
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Ana María");
    await askForNewEmail("bounced@ledgerflow.test");
    expect(
      await screen.findByText("We can’t send email to this address. Check it, or use another one."),
    ).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledWith({
      reauthenticated: false,
      newEmail: null,
      emailRefused: true,
    });
    expect(sent("/api/users/u1")).toEqual([{ name: "Ana María" }]);
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("waits out a limit met after the password was saved, and asks again with the new password only", async () => {
    let limited = true;
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.startsWith("/api/auth/me")) return Promise.resolve(json({ user }));
      if (url === "/api/auth/change-email") {
        if (limited)
          return Promise.resolve(
            new Response(JSON.stringify({ error: "Too many", code: "RATE_LIMITED" }), {
              status: 429,
              headers: { "content-type": "application/json", "retry-after": "1" },
            }),
          );
        return Promise.resolve(
          json({ resendAfterSeconds: 60, emailChange: waiting }, { status: 202 }),
        );
      }
      if (init?.method === "PUT") return Promise.resolve(json(user));
      if (init?.method === "POST") return Promise.resolve(json({ user, accessToken: "a" }));
      return Promise.resolve(json({}));
    });
    const onSaved = renderView();
    await userEvent.type(screen.getByLabelText(/^New password/), "Str0ngPass!");
    await askForNewEmail();
    expect(await screen.findByText(/You can try again in 0:0\d\./)).toBeInTheDocument();
    expect(onSaved).toHaveBeenLastCalledWith({
      reauthenticated: true,
      newEmail: null,
      emailRefused: true,
    });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    limited = false;
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
      },
      { timeout: 3_000 },
    );
    await userEvent.type(screen.getByLabelText("Current password"), "Str0ngPass!");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenLastCalledWith({
        reauthenticated: false,
        newEmail: "new@ledgerflow.test",
        emailRefused: false,
      });
    });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    expect(sent("/api/auth/change-email").at(-1)).toEqual({
      email: "new@ledgerflow.test",
      currentPassword: "Str0ngPass!",
      captcha: "captcha-token",
    });
  });

  it("drops the card of a waiting address once a new password is saved, which cancels it", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.startsWith("/api/auth/me"))
        return Promise.resolve(json({ user: { ...user, emailChange: waiting } }));
      if (init?.method === "PUT") return Promise.resolve(json(user));
      if (init?.method === "POST") return Promise.resolve(json({ user, accessToken: "a" }));
      return Promise.resolve(json({}));
    });
    function FromSession() {
      const { user: shown } = useSession();
      return shown ? <ProfileView user={shown} onSaved={vi.fn()} /> : null;
    }
    renderWithProviders(
      <QueryProvider>
        <SessionProvider onSignedOut={vi.fn()}>
          <ToastProvider>
            <FromSession />
          </ToastProvider>
        </SessionProvider>
      </QueryProvider>,
    );
    expect(await screen.findByText(/Waiting for confirmation at/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^New password/), "Str0ngPass!");
    await userEvent.type(screen.getByLabelText("Current password"), "OldPass!2026");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(screen.queryByText(/Waiting for confirmation at/)).not.toBeInTheDocument();
    });
  });

  it("hides a change whose 24 hours passed", () => {
    renderView(vi.fn(), {
      ...user,
      emailChange: { ...waiting, expiresAt: new Date(Date.now() - 1_000).toISOString() },
    });
    expect(screen.queryByText(/Waiting for confirmation at/)).not.toBeInTheDocument();
  });

  it("says under the field when the address takes none of our email", async () => {
    fetchMock.mockImplementation((input) => {
      if (urlOf(input) === "/api/auth/change-email")
        return Promise.resolve(failure("EMAIL_SEND_FAILED", 422));
      return Promise.resolve(json({ user }));
    });
    renderView();
    await askForNewEmail();
    expect(
      await screen.findByText("We can’t send email to this address. Check it, or use another one."),
    ).toBeInTheDocument();
  });

  it("says a send that failed on our side in an alert, and a refused check with its own", async () => {
    fetchMock.mockImplementation((input) => {
      if (urlOf(input) === "/api/auth/change-email")
        return Promise.resolve(failure("EMAIL_SEND_FAILED", 503));
      return Promise.resolve(json({ user }));
    });
    renderView();
    await askForNewEmail();
    expect(
      await screen.findByText("We couldn’t send the email. Try again in a few minutes."),
    ).toBeInTheDocument();
    token.mockRejectedValueOnce(new Error("blocked"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("We couldn’t check that you’re a person.")).toBeInTheDocument();
  });

  it("waits out a limit with its countdown, and Save changes off until it ends", async () => {
    fetchMock.mockImplementation((input) => {
      if (urlOf(input) === "/api/auth/change-email")
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Too many", code: "RATE_LIMITED" }), {
            status: 429,
            headers: { "content-type": "application/json", "retry-after": "42" },
          }),
        );
      return Promise.resolve(json({ user }));
    });
    renderView();
    await askForNewEmail();
    expect(await screen.findByText("You can try again in 0:42.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.queryByText("Too many attempts. Try again in a moment.")).not.toBeInTheDocument();
  });

  it("keeps the field read-only where there is no Cloudflare check", async () => {
    flow.on = false;
    renderView();
    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("readonly");
    expect(
      screen.getByText("Changing the email needs Cloudflare’s check, which isn’t set up here."),
    ).toBeInTheDocument();
    await userEvent.type(email, "x");
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
  });

  it("shows the address that waits, with Enter code, Resend and Cancel change", async () => {
    // Stamped here, not when the file loads: a busy run would otherwise read the countdown below 0:40.
    const fresh = { ...waiting, resendAvailableAt: new Date(Date.now() + 42_000).toISOString() };
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.startsWith("/api/auth/me"))
        return Promise.resolve(json({ user: { ...user, emailChange: fresh } }));
      if (url === "/api/auth/change-email" && init?.method === "DELETE")
        return Promise.resolve(json({ message: "Nothing waits" }));
      return Promise.resolve(json({}));
    });
    renderView(vi.fn(), { ...user, emailChange: fresh });
    expect(screen.getByText(/Waiting for confirmation at/)).toHaveTextContent(
      "Waiting for confirmation at new@ledgerflow.test",
    );
    expect(screen.getByRole("button", { name: /Resend in 0:4\d/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Enter code" }));
    expect(confirmEmailStore.getSnapshot()).toMatchObject({ sheetOpen: true, target: "new" });
    await userEvent.click(screen.getByRole("button", { name: "Cancel change" }));
    expect(
      await screen.findByText(`Change cancelled. Your account keeps ${user.email}.`),
    ).toBeInTheDocument();
  });

  it("renames without asking for the current password", async () => {
    const onSaved = renderView();
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Ana María");
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({
        reauthenticated: false,
        newEmail: null,
        emailRefused: false,
      });
    });
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(put?.[1]?.body as string)).toEqual({ name: "Ana María" });
  });

  it("asks for the current password on a password change and signs in again with the new pair", async () => {
    const onSaved = renderView();
    await userEvent.type(screen.getByLabelText(/^New password/), "Str0ngPass!");
    expect(screen.getByText(/confirm your current password/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("This field is required.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Current password"), "OldPass!2026");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({
        reauthenticated: true,
        newEmail: null,
        emailRefused: false,
      });
    });
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(put?.[1]?.body as string)).toEqual({
      password: "Str0ngPass!",
      currentPassword: "OldPass!2026",
    });
    const login = fetchMock.mock.calls.find(
      ([input, init]) => init?.method === "POST" && urlOf(input) === "/api/auth/login",
    );
    expect(JSON.parse(login?.[1]?.body as string)).toEqual({
      email: "ana@ledgerflow.test",
      password: "Str0ngPass!",
    });
  });

  it("shows a wrong current password under its field", async () => {
    fetchMock.mockImplementation((input, init) => {
      if (urlOf(input).startsWith("/api/auth/me")) return Promise.resolve(json({ user }));
      if (init?.method === "PUT")
        return Promise.resolve(
          json({ code: "CURRENT_PASSWORD_INVALID", message: "nope" }, { status: 401 }),
        );
      return Promise.resolve(json({}));
    });
    renderView();
    await userEvent.type(screen.getByLabelText(/^New password/), "Str0ngPass!");
    await userEvent.type(screen.getByLabelText("Current password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Your current password is wrong.")).toBeInTheDocument();
  });
});
