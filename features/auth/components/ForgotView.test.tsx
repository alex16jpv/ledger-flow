import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { carryEmail, rememberSentCode } from "../carry";
import { ForgotView } from "./ForgotView";

const replace = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/forgot",
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const token = vi.fn<() => Promise<string>>();
vi.mock("@/lib/captcha/useHumanCheck", () => ({
  useHumanCheck: () => ({ mount: vi.fn(), interactive: false, token }),
  HumanCheckSlot: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
const EMAIL = "ada@ledgerflow.test";

const sentTo = (path: string) =>
  fetchMock.mock.calls.filter(([url]) => urlOf(url).endsWith(path)).map(([, init]) => init);

beforeEach(() => {
  replace.mockReset();
  fetchMock.mockReset();
  token.mockReset().mockResolvedValue("captcha-token");
  vi.stubGlobal("fetch", fetchMock);
  carryEmail("");
  rememberSentCode(null);
  reportOnline(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderView() {
  renderWithProviders(
    <QueryProvider>
      <ForgotView />
    </QueryProvider>,
  );
}

async function sendCode(email = EMAIL) {
  fetchMock.mockResolvedValueOnce(json({ resendAfterSeconds: 60 }, { status: 202 }));
  const field = screen.getByLabelText("Email");
  await userEvent.clear(field);
  await userEvent.type(field, email);
  await userEvent.click(screen.getByRole("button", { name: "Send code" }));
  await screen.findByRole("heading", { name: "Check your email" });
}

describe("ForgotView", () => {
  it("arrives with the email another screen carried over", () => {
    carryEmail(EMAIL);
    renderView();
    expect(screen.getByLabelText("Email")).toHaveValue(EMAIL);
  });

  it("asks for the captcha when sending, and moves on with the same words for any address", async () => {
    renderView();
    await sendCode();
    expect(token).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sentTo("/api/auth/forgot")[0]?.body as string)).toEqual({
      email: EMAIL,
      captcha: "captcha-token",
    });
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    expect(screen.getByText(/You can resend it in 1:00/)).toBeInTheDocument();
  });

  it("says the check failed, and sends nothing, when Cloudflare gives no token", async () => {
    token.mockRejectedValueOnce(new Error("blocked"));
    renderView();
    await userEvent.type(screen.getByLabelText("Email"), EMAIL);
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("We couldn’t check that you’re a person.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads a refused token as the check failing, and an unavailable one as our failure", async () => {
    renderView();
    await userEvent.type(screen.getByLabelText("Email"), EMAIL);
    fetchMock.mockResolvedValueOnce(json({ code: "CAPTCHA_INVALID" }, { status: 400 }));
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("We couldn’t check that you’re a person.")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(json({ code: "CAPTCHA_UNAVAILABLE" }, { status: 503 }));
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(
      await screen.findByText("Something went wrong on our side. Nothing changed: try again."),
    ).toBeInTheDocument();
  });

  it("counts down a 429 in hours and minutes, with Send code disabled", async () => {
    renderView();
    await userEvent.type(screen.getByLabelText("Email"), EMAIL);
    fetchMock.mockResolvedValueOnce(
      json({ code: "RATE_LIMITED" }, { status: 429, headers: { "retry-after": "11400" } }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText(/ask for a code again in 3 h 10 min/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();
  });

  it("says it needs a connection, with Send code disabled, when offline", () => {
    act(() => {
      reportOnline(false);
    });
    renderView();
    expect(screen.getByText("Sending the code needs a connection.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();
  });

  it("keeps the email for a password manager and saves with the code", async () => {
    renderView();
    await sendCode();
    expect(document.querySelector('input[autocomplete="username"]')).toHaveValue(EMAIL);
    await userEvent.type(screen.getByLabelText("6-digit code"), "482719");
    await userEvent.type(screen.getByLabelText("New password"), "LedgerFlow!2027");
    fetchMock.mockResolvedValueOnce(json({ user: { id: "u1" }, restored: false }));
    await userEvent.click(screen.getByRole("button", { name: "Save password and sign in" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith({ pathname: "/home", query: { passwordChanged: "1" } });
    });
    expect(JSON.parse(sentTo("/api/auth/reset")[0]?.body as string)).toEqual({
      email: EMAIL,
      code: "482719",
      newPassword: "LedgerFlow!2027",
    });
  });

  it("says the account is back when the new password restored a deleted one", async () => {
    renderView();
    await sendCode();
    await userEvent.type(screen.getByLabelText("6-digit code"), "482719");
    await userEvent.type(screen.getByLabelText("New password"), "LedgerFlow!2027");
    fetchMock.mockResolvedValueOnce(json({ user: { id: "u1" }, restored: true }));
    await userEvent.click(screen.getByRole("button", { name: "Save password and sign in" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith({
        pathname: "/home",
        query: { passwordChanged: "1", restored: "1" },
      });
    });
  });

  it("answers a bad code once, and waits for another code before Save works again", async () => {
    renderView();
    await sendCode();
    const code = screen.getByLabelText("6-digit code");
    await userEvent.type(code, "111111");
    await userEvent.type(screen.getByLabelText("New password"), "LedgerFlow!2027");
    fetchMock.mockResolvedValueOnce(json({ code: "RESET_CODE_INVALID" }, { status: 400 }));
    const save = screen.getByRole("button", { name: "Save password and sign in" });
    await userEvent.click(save);
    expect(await screen.findByText(/That code doesn’t work/)).toBeInTheDocument();
    expect(save).toBeDisabled();
    expect(code).toHaveFocus();
    expect(screen.getByLabelText("New password")).toHaveValue("LedgerFlow!2027");

    await userEvent.keyboard("222222");
    expect(code).toHaveValue("222222");
    expect(save).toBeEnabled();
    expect(screen.queryByText(/That code doesn’t work/)).not.toBeInTheDocument();
  });

  it("goes back to the first step with the address in place to change it", async () => {
    renderView();
    await sendCode();
    await userEvent.click(screen.getByRole("button", { name: "Change it" }));
    expect(screen.getByRole("heading", { name: "Forgot your password?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue(EMAIL);
  });

  it("keeps the code step across a remount, as the language chip does", async () => {
    renderView();
    await sendCode();
    document.body.innerHTML = "";
    renderView();
    expect(screen.getByRole("heading", { name: "Check your email" })).toBeInTheDocument();
  });
});
