import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { drawOf } from "@/lib/testing/colors";
import { UUID } from "@/lib/testing/ids";
import { renderWithProviders } from "@/lib/testing/render";

import { AccountForm } from "./AccountForm";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderForm(onSaved = vi.fn()) {
  renderWithProviders(
    <QueryProvider>
      <AccountForm submitLabel="Continue" onSaved={onSaved} />
    </QueryProvider>,
  );
  return onSaved;
}

// The type is a row that opens a sheet now (F-03), not a chip in a grid.
async function chooseType(label: string) {
  await userEvent.click(screen.getByRole("button", { name: /^Type/ }));
  const sheet = screen.getByRole("dialog", { name: "Account type" });
  await userEvent.click(within(sheet).getByRole("option", { name: new RegExp(`^${label}`) }));
}

describe("AccountForm", () => {
  it("opens on a drawn colour and creates the account with it (T-74)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(drawOf("PURPLE"));
    fetchMock.mockResolvedValue(json({ id: "a3" }, { status: 201 }));
    renderForm();
    const swatches = within(screen.getByRole("group", { name: "Color" }));
    expect(
      swatches.getAllByRole("button", { pressed: true }).map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Purple"]);
    await userEvent.type(screen.getByLabelText("Name"), "Nequi");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;
    expect(body.color).toBe("PURPLE");
  });

  it("creates the account with the chosen type, color and a zero balance when left empty", async () => {
    fetchMock.mockResolvedValue(
      json({ id: "a1", name: "Bancolombia", isDefault: true }, { status: 201 }),
    );
    const onSaved = renderForm();
    await userEvent.type(screen.getByLabelText("Name"), "Bancolombia");
    await chooseType("Cash");
    await userEvent.click(screen.getByRole("button", { name: "Teal" }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));
    });
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;
    // The create carries the client-minted id (O-B1), which is what makes it idempotent.
    expect(body).toEqual({
      id: expect.stringMatching(UUID),
      name: "Bancolombia",
      type: "CASH",
      color: "TEAL",
      balance: 0,
    });
  });

  it("sends the typed opening balance", async () => {
    fetchMock.mockResolvedValue(json({ id: "a2" }, { status: 201 }));
    renderForm();
    await userEvent.type(screen.getByLabelText("Name"), "Savings");
    await userEvent.type(screen.getByRole("textbox", { name: "Current balance" }), "3420500");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;
    expect(body.balance).toBe(3420500);
  });

  it("shows the duplicate-name error under the name field", async () => {
    fetchMock.mockResolvedValue(
      json({ error: "Conflict", message: "dup", code: "DUPLICATE" }, { status: 409 }),
    );
    renderForm();
    await userEvent.type(screen.getByLabelText("Name"), "Cash");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      await screen.findByText(
        "You already have an active account named “Cash”. Names are case-insensitive.",
      ),
    ).toBeInTheDocument();
  });

  it("edits name, type and color without a balance field and previews the account", async () => {
    fetchMock.mockResolvedValue(json({ id: "a1", name: "Nu Bank" }));
    const onSaved = vi.fn();
    renderWithProviders(
      <QueryProvider>
        <AccountForm
          account={{
            id: "a1",
            name: "Nu",
            type: "SAVINGS",
            balance: 250_000,
            openingBalance: 0,
            color: "PURPLE",
            userId: "u1",
            isDefault: true,
            currency: "COP",
            archivedAt: null,
            createdAt: "",
            updatedAt: "",
          }}
          submitLabel="Save changes"
          onSaved={onSaved}
        />
      </QueryProvider>,
    );
    expect(screen.queryByRole("textbox", { name: "Current balance" })).not.toBeInTheDocument();
    expect(screen.getByText("250,000")).toBeInTheDocument();
    expect(screen.getByText("Main")).toBeInTheDocument();
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Nu Bank");
    expect(screen.getByText("Savings · preview")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/accounts/a1");
    expect(init?.method).toBe("PUT");
    // §1 example 3: only what was touched travels, or a rename elsewhere becomes a conflict.
    expect(JSON.parse(init?.body as string)).toEqual({ name: "Nu Bank" });
  });

  it("asks a debt account what it owes and stores it as the debt (T-88)", async () => {
    fetchMock.mockResolvedValue(json({ id: "a4" }, { status: 201 }));
    renderForm();
    await userEvent.type(screen.getByLabelText("Name"), "Visa Gold");
    await chooseType("Credit card");

    expect(screen.queryByLabelText("Current balance")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("How much do you owe on it right now?"), "1245900");
    await userEvent.type(screen.getByLabelText("Credit limit"), "4000000");
    expect(screen.getByText("available · Credit card · preview")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      type: "CARD",
      balance: -1245900,
      creditLimit: 4000000,
    });
  });

  it("offers the amount borrowed to a loan and a credit limit to nothing else (T-88)", async () => {
    renderForm();
    await chooseType("Loan");
    expect(screen.getByLabelText("Amount borrowed")).toBeInTheDocument();
    expect(screen.queryByLabelText("Credit limit")).not.toBeInTheDocument();

    await chooseType("Cash");
    expect(screen.queryByLabelText("Amount borrowed")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Current balance")).toBeInTheDocument();
  });

  it("clears an amount the new type cannot carry, in the same write (T-88)", async () => {
    fetchMock.mockResolvedValue(json({ id: "a1" }));
    const onSaved = vi.fn();
    renderWithProviders(
      <QueryProvider>
        <AccountForm
          account={{
            id: "a1",
            name: "Visa Gold",
            type: "CARD",
            balance: -1_245_900,
            openingBalance: 0,
            creditLimit: 4_000_000,
            color: "PURPLE",
            userId: "u1",
            isDefault: false,
            currency: "COP",
            archivedAt: null,
            createdAt: "",
            updatedAt: "",
          }}
          submitLabel="Save changes"
          onSaved={onSaved}
        />
      </QueryProvider>,
    );
    expect(screen.getByLabelText("Credit limit")).toHaveValue("4,000,000");

    await chooseType("Cash");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      type: "CASH",
      creditLimit: null,
    });
  });

  // F-03, variant C: one row and a sheet with room to say what each of the nine types is.
  it("offers all nine account types in a sheet, each with the line that explains it", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: /^Type/ }));
    const sheet = screen.getByRole("dialog", { name: "Account type" });
    for (const [label, description] of [
      ["Cash", "Notes and coins you carry"],
      ["Bank account", "A checking or current account"],
      ["Credit card", "Spending you pay back later"],
      ["Debit card", "Tied to a bank account"],
      ["Savings", "Money you keep aside"],
      ["Investment", "Funds, stocks, crypto"],
      ["Overdraft", "A negative balance you can use"],
      ["Loan", "Money you owe"],
      ["Other", "Anything else"],
    ]) {
      const option = within(sheet).getByRole("option", { name: new RegExp(`^${label}`) });
      expect(option).toHaveTextContent(description!);
    }
    // The row shows the chosen one with its description, so the choice reads without opening it.
    expect(screen.getByRole("button", { name: /^Type/ })).toHaveTextContent(
      "Bank account · a checking or current account",
    );
  });

  // R-5 §A: the API refuses an empty PUT, and offline it would sit in the attention tray.
  it("saving an untouched edit sends nothing and hands back the account as it was", async () => {
    const account = {
      id: "a1",
      name: "Nu",
      type: "SAVINGS" as const,
      balance: 250_000,
      openingBalance: 0,
      color: "PURPLE" as const,
      userId: "u1",
      isDefault: true,
      currency: "COP",
      archivedAt: null,
      createdAt: "",
      updatedAt: "",
    };
    const onSaved = vi.fn();
    renderWithProviders(
      <QueryProvider>
        <AccountForm account={account} submitLabel="Save changes" onSaved={onSaved} />
      </QueryProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(account);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
