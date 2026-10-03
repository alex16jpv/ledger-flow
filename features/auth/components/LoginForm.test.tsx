import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { carriedEmail, carryEmail } from "../carry";
import { LoginForm } from "./LoginForm";

vi.mock("@/lib/i18n/navigation", () => ({
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

function renderForm(
  onSuccess = vi.fn(),
  knownEmail?: string | null,
  forgotPasswordEnabled = false,
  onDeleted = vi.fn(),
) {
  renderWithProviders(
    <QueryProvider>
      <LoginForm
        onSuccess={onSuccess}
        onDeleted={onDeleted}
        forgotPasswordEnabled={forgotPasswordEnabled}
        knownEmail={knownEmail}
      />
    </QueryProvider>,
  );
  return onSuccess;
}

describe("LoginForm", () => {
  beforeEach(() => {
    carryEmail("");
  });

  it("hands over what was typed and the two dates when the account was deleted", async () => {
    const onDeleted = vi.fn();
    const deletedAccount = { deletedOn: "2026-09-28", keptUntil: "2026-10-28" };
    fetchMock.mockResolvedValue(
      json(
        { error: "Conflict", message: "deleted", code: "ACCOUNT_DELETED", deletedAccount },
        { status: 409 },
      ),
    );
    const onSuccess = renderForm(vi.fn(), null, false, onDeleted);
    await userEvent.type(screen.getByLabelText("Email"), "ada@ledgerflow.test");
    await userEvent.type(screen.getByLabelText("Password"), "LedgerFlow!2026");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith(
        { email: "ada@ledgerflow.test", password: "LedgerFlow!2026" },
        deletedAccount,
      );
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens Forgot your password? with the email typed so far", async () => {
    renderForm(vi.fn(), null, true);
    await userEvent.type(screen.getByLabelText("Email"), "ada@ledgerflow.test");
    const forgot = screen.getByRole("link", { name: "Forgot your password?" });
    expect(forgot).toHaveAttribute("href", "/forgot");
    await userEvent.click(forgot);
    expect(carriedEmail()).toBe("ada@ledgerflow.test");
  });

  it("shows Forgot your password? inactive where no captcha is configured", () => {
    renderForm();
    expect(screen.queryByRole("link", { name: /Forgot your password/ })).not.toBeInTheDocument();
    expect(screen.getByText(/soon/)).toBeInTheDocument();
  });

  it("arrives with the email another screen carried over, before the device's", async () => {
    carryEmail("typed@elsewhere.test");
    renderForm(vi.fn(), "ada@ledgerflow.test");
    await waitFor(() => {
      expect(screen.getByLabelText("Email")).toHaveValue("typed@elsewhere.test");
    });
  });

  it("arrives with the device's email written and the password focused", async () => {
    renderForm(vi.fn(), "ada@ledgerflow.test");
    await waitFor(() => {
      expect(screen.getByLabelText("Email")).toHaveValue("ada@ledgerflow.test");
    });
    expect(screen.getByLabelText("Password")).toHaveFocus();
  });

  it("leaves an email the user is already typing alone", async () => {
    renderForm(vi.fn(), null);
    await userEvent.type(screen.getByLabelText("Email"), "someone@else.test");
    expect(screen.getByLabelText("Email")).toHaveValue("someone@else.test");
  });

  it("validates before calling the BFF", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("This field is required.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs in and hands the session to the caller", async () => {
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "John" } }));
    const onSuccess = renderForm();
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "LedgerFlow!2026");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({ user: { id: "u1", name: "John" } });
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
