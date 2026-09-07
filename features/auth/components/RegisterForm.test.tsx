import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { RegisterForm } from "./RegisterForm";

const replace = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/register",
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
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

  it("sends the detected settings and the UI locale", async () => {
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
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      name: "John Doe",
      email: "john.doe@example.com",
      currency: "COP",
      locale: "en",
    });
    expect(typeof body.timezone).toBe("string");
    expect(body).not.toHaveProperty("consent");
  });

  it("shows the taken-email error inline with a sign-in link", async () => {
    fetchMock.mockResolvedValue(
      json({ error: "Conflict", message: "taken", code: "EMAIL_TAKEN" }, { status: 409 }),
    );
    renderForm();
    await screen.findByRole("button", { name: /COP · / });
    await fillValid();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/This email already has an account/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
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

  // F-02: the account's language could only be whatever the URL happened to carry, and nothing on
  // the screen said so or let the user change it before the account existed.
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
