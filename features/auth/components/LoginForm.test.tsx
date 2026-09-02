import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { LoginForm } from "./LoginForm";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderForm(onSuccess = vi.fn()) {
  renderWithProviders(
    <QueryProvider>
      <LoginForm onSuccess={onSuccess} forgotPasswordEnabled={false} />
    </QueryProvider>,
  );
  return onSuccess;
}

describe("LoginForm", () => {
  it("validates before calling the BFF", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("This field is required.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs in and hands the session to the caller", async () => {
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "Andrés" } }));
    const onSuccess = renderForm();
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "LedgerFlow!2026");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({ user: { id: "u1", name: "Andrés" } });
    });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe(JSON.stringify({ email: "a@b.co", password: "LedgerFlow!2026" }));
    expect((init?.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("shows one uniform message on 401", async () => {
    fetchMock.mockResolvedValue(
      json({ error: "UnauthorizedError", message: "Invalid email or password" }, { status: 401 }),
    );
    renderForm();
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong email or password.");
  });

  it("shows the countdown from Retry-After and disables the button on 429", async () => {
    fetchMock.mockResolvedValue(
      json(
        { error: "TooMany", message: "x", code: "RATE_LIMITED" },
        { status: 429, headers: { "retry-after": "125" } },
      ),
    );
    renderForm();
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "LedgerFlow!2026");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Too many attempts.")).toBeInTheDocument();
    expect(screen.getByText(/You can try again in 2:0\d\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  it("toggles password visibility", async () => {
    renderForm();
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });
});
