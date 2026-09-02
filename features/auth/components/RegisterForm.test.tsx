import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { RegisterForm } from "./RegisterForm";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
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
  await userEvent.type(screen.getByLabelText("Name"), "Andrés Valencia");
  await userEvent.type(screen.getByLabelText("Email"), "andres@example.com");
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
      json({ user: { id: "u1", name: "Andrés", reactivated: false } }, { status: 201 }),
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
      name: "Andrés Valencia",
      email: "andres@example.com",
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
});
