import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
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
    // Only the name was touched, so only the name travels: a body naming the type and the colour
    // too would make a rename on another device a conflict the user has to answer (§1 example 3).
    expect(JSON.parse(init?.body as string)).toEqual({ name: "Nu Bank" });
  });

  // F-03, variant C: one row, and a sheet with room to say what each of the nine types is — which
  // is what the grid of chips could not do.
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
