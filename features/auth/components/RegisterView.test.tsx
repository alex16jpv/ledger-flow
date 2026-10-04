import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";

import { RegisterView } from "./RegisterView";

const replace = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/register",
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/flags", () => ({ isEnabled: () => true }));
const token = vi.fn<() => Promise<string>>();
vi.mock("@/lib/captcha/useHumanCheck", () => ({
  useHumanCheck: () => ({ mount: vi.fn(), interactive: false, token }),
  HumanCheckSlot: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const EMAIL = "ana@example.co";
const PENDING = { email: EMAIL, expiresAt: "2099-01-01T00:00:00.000Z", resendAfterSeconds: 0 };
const fetchMock = vi.fn<typeof fetch>();

type Route = (init: RequestInit | undefined) => Response;

function serve(routes: Record<string, Route>) {
  fetchMock.mockImplementation((input, init) => {
    const key = `${init?.method ?? "GET"} ${urlOf(input)}`;
    const route = routes[key];
    return Promise.resolve(route ? route(init) : json({}, { status: 404 }));
  });
}

const calls = (method: string, path: string) =>
  fetchMock.mock.calls.filter(
    ([input, init]) => (init?.method ?? "GET") === method && urlOf(input) === path,
  );

beforeEach(() => {
  replace.mockReset();
  fetchMock.mockReset();
  token.mockReset().mockResolvedValue("captcha-token");
  vi.stubGlobal("fetch", fetchMock);
  reportOnline(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderView() {
  renderWithProviders(
    <QueryProvider>
      <RegisterView />
    </QueryProvider>,
  );
}

describe("RegisterView", () => {
  it("lands on the code step again after a reload, with the same words for every address", async () => {
    serve({ "GET /api/auth/sign-up": () => json(PENDING) });
    renderView();
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("opens the form when this browser waits for nothing", async () => {
    serve({ "GET /api/auth/sign-up": () => new Response(null, { status: 204 }) });
    renderView();
    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
  });

  it("creates the account with the code and opens onboarding", async () => {
    serve({
      "GET /api/auth/sign-up": () => json(PENDING),
      "POST /api/auth/sign-up/confirm": () =>
        json({ user: { id: "u1", name: "Ana" } }, { status: 201 }),
    });
    renderView();
    await userEvent.type(await screen.findByLabelText("6-digit code"), "482719");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/onboarding");
    });
    const [, init] = calls("POST", "/api/auth/sign-up/confirm")[0] ?? [];
    expect(JSON.parse(init?.body as string)).toEqual({ code: "482719" });
  });

  it("answers every bad code once, and waits for another before Create account works", async () => {
    serve({
      "GET /api/auth/sign-up": () => json(PENDING),
      "POST /api/auth/sign-up/confirm": () =>
        json({ code: "SIGN_UP_CODE_INVALID", message: "no" }, { status: 400 }),
    });
    renderView();
    const code = await screen.findByLabelText("6-digit code");
    await userEvent.type(code, "111111");
    const create = screen.getByRole("button", { name: "Create account" });
    await userEvent.click(create);
    expect(await screen.findByText(/That code doesn’t work/)).toBeInTheDocument();
    expect(create).toBeDisabled();
    expect(code).toHaveFocus();
    await userEvent.keyboard("222222");
    expect(create).toBeEnabled();
  });

  it("goes back to the form for another address, forgetting the sign-up here", async () => {
    serve({
      "GET /api/auth/sign-up": () => json(PENDING),
      "DELETE /api/auth/sign-up": () => new Response(null, { status: 204 }),
    });
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: "Change it" }));
    expect(await screen.findByLabelText("Email")).toHaveValue(EMAIL);
    expect(screen.getByLabelText("Password")).toHaveValue("");
    await waitFor(() => {
      expect(calls("DELETE", "/api/auth/sign-up")).toHaveLength(1);
    });
  });

  it("goes back to the form and says why when Resend finds the sign-up over", async () => {
    serve({
      "GET /api/auth/sign-up": () => json(PENDING),
      "POST /api/auth/sign-up/resend": () =>
        json({ code: "SIGN_UP_EXPIRED", message: "over" }, { status: 409 }),
    });
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: "Resend code" }));
    expect(await screen.findByText("That sign-up is over.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue(EMAIL);
    expect(token).toHaveBeenCalledTimes(1);
  });

  it("goes back to the form when the email got an account while the code was on its way", async () => {
    serve({
      "GET /api/auth/sign-up": () => json(PENDING),
      "POST /api/auth/sign-up/confirm": () =>
        json({ code: "EMAIL_TAKEN", message: "taken" }, { status: 409 }),
    });
    renderView();
    await userEvent.type(await screen.findByLabelText("6-digit code"), "482719");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("That email has an account now.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue(EMAIL);
  });

  it("starts the countdown again after a Resend", async () => {
    serve({
      "GET /api/auth/sign-up": () => json(PENDING),
      "POST /api/auth/sign-up/resend": () =>
        json({ ...PENDING, resendAfterSeconds: 60 }, { status: 202 }),
    });
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: "Resend code" }));
    expect(await screen.findByText(/You can resend it in/)).toBeInTheDocument();
    const [, init] = calls("POST", "/api/auth/sign-up/resend")[0] ?? [];
    expect(JSON.parse(init?.body as string)).toEqual({ captcha: "captcha-token" });
  });

  it("waits for a connection to create the account", async () => {
    serve({ "GET /api/auth/sign-up": () => json(PENDING) });
    renderView();
    await screen.findByLabelText("6-digit code");
    reportOnline(false);
    expect(await screen.findByText("Creating your account needs a connection.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
  });
});
