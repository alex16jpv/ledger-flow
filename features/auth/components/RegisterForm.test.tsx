import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { carriedEmail, carryEmail } from "../carry";
import { RegisterForm } from "./RegisterForm";

const replace = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/register",
  Link: ({
    children,
    href,
    onClick,
  }: {
    children: React.ReactNode;
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
let siteKey = true;
vi.mock("@/lib/flags", () => ({
  isEnabled: (flag: string) =>
    (flag === "forgotPassword" || flag === "emailVerification") && siteKey,
}));
const token = vi.fn<() => Promise<string>>();
vi.mock("@/lib/captcha/useHumanCheck", () => ({
  useHumanCheck: () => ({ mount: vi.fn(), interactive: false, token }),
  HumanCheckSlot: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  replace.mockReset();
  fetchMock.mockReset();
  token.mockReset().mockResolvedValue("captcha-token");
  siteKey = true;
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(navigator, "language", "get").mockReturnValue("es-CO");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderForm(onSuccess = vi.fn()) {
  renderWithProviders(
    <QueryProvider>
      <RegisterForm locale="en" onSuccess={onSuccess} />
    </QueryProvider>,
  );
  return onSuccess;
}

async function fillValid() {
  await userEvent.type(screen.getByLabelText("Name"), "John Doe");
  await userEvent.type(screen.getByLabelText("Email"), "john.doe@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "LedgerFlow!2026");
}

describe("RegisterForm", () => {
  it("detects currency and time zone from the device and keeps the button disabled until consent", async () => {
    renderForm();
    expect(await screen.findByRole("button", { name: /COP · Colombian Peso/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Detected from your device.*(\/|UTC)/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
  });

  it("sends the detected settings, the UI locale and Cloudflare's token", async () => {
    fetchMock.mockResolvedValue(
      json({ user: { id: "u1", name: "John", reactivated: false } }, { status: 201 }),
    );
    const onSuccess = renderForm();
    await screen.findByRole("button", { name: /COP · / });
    await fillValid();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(token).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      name: "John Doe",
      email: "john.doe@example.com",
      currency: "COP",
      locale: "en",
      captcha: "captcha-token",
    });
    expect(typeof body.timezone).toBe("string");
    expect(body).not.toHaveProperty("consent");
  });

  it("says no account can be created where there is no site key, and keeps the button off", async () => {
    siteKey = false;
    renderForm();
    await screen.findByRole("button", { name: /COP · / });
    expect(screen.getByText("You can’t create an account here.")).toBeInTheDocument();
    await fillValid();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Password"), "{Enter}");
    expect(token).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates nothing when Cloudflare's check fails, and says so", async () => {
    token.mockRejectedValue(new Error("blocked"));
    renderForm();
    await screen.findByRole("button", { name: /COP · / });
    await fillValid();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/We couldn’t check that you’re a person/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says a refused token and an unchecked one apart from an account that may exist", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: "Bad", message: "no", code: "CAPTCHA_INVALID" }, { status: 400 }),
    );
    renderForm();
    await screen.findByRole("button", { name: /COP · / });
    await fillValid();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/We couldn’t check that you’re a person/)).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(
      json({ error: "Unavailable", message: "no", code: "CAPTCHA_UNAVAILABLE" }, { status: 503 }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      await screen.findByText("Something went wrong on our side. Nothing changed: try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/We couldn’t check that you’re a person/)).not.toBeInTheDocument();
    expect(screen.queryByText(/may already exist/)).not.toBeInTheDocument();
  });

  it("offers both ways back for a taken address, each carrying it over", async () => {
    carryEmail("");
    fetchMock.mockResolvedValue(
      json({ error: "Conflict", message: "taken", code: "EMAIL_TAKEN" }, { status: 409 }),
    );
    renderForm();
    await screen.findByRole("button", { name: /COP · / });
    await fillValid();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    const reset = await screen.findByRole("link", { name: "reset your password" });
    expect(reset).toHaveAttribute("href", "/forgot");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    await userEvent.click(reset);
    expect(carriedEmail()).toBe("john.doe@example.com");
  });

  it("suggests signing in when the backend answers 500", async () => {
    fetchMock.mockResolvedValue(
      json({ error: "Internal", message: "boom", code: "INTERNAL" }, { status: 500 }),
    );
    renderForm();
    await screen.findByRole("button", { name: /COP · / });
    await fillValid();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/Your account may already exist/)).toBeInTheDocument();
  });

  // F-02: the account's language was whatever the URL carried, with no way to change it.
  it("shows the language it will create the account with, and switches it in place", async () => {
    renderForm();

    const row = await screen.findByRole("button", { name: /English/ });

    await userEvent.click(row);
    const sheet = screen.getByRole("dialog", { name: "Language" });
    // The device asked for Spanish, so that is the row that says where it came from.
    expect(within(sheet).getByRole("option", { name: /Español/ })).toHaveTextContent(
      "Detected from your device",
    );
    expect(within(sheet).getByText(/The whole screen changes right away/)).toBeVisible();

    await userEvent.click(within(sheet).getByRole("option", { name: /Español/ }));

    // The whole screen moves to the other language; the account is created from the URL's locale.
    expect(replace).toHaveBeenCalledWith({ pathname: "/register", query: {} }, { locale: "es" });
  });
});
