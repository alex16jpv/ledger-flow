import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
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

function renderForm(onCreated = vi.fn()) {
  renderWithProviders(
    <QueryProvider>
      <AccountForm submitLabel="Continue" onCreated={onCreated} />
    </QueryProvider>,
  );
  return onCreated;
}

describe("AccountForm", () => {
  it("creates the account with the chosen type, color and a zero balance when left empty", async () => {
    fetchMock.mockResolvedValue(
      json({ id: "a1", name: "Bancolombia", isDefault: true }, { status: 201 }),
    );
    const onCreated = renderForm();
    await userEvent.type(screen.getByLabelText("Name"), "Bancolombia");
    await userEvent.click(screen.getByRole("button", { name: "Cash", pressed: false }));
    await userEvent.click(screen.getByRole("button", { name: "Teal" }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));
    });
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;
    expect(body).toEqual({ name: "Bancolombia", type: "CASH", color: "TEAL", balance: 0 });
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
    expect(await screen.findByText("That name is already in use.")).toBeInTheDocument();
  });

  it("opens the full type list from More", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("option", { name: /Loan/ })).toBeInTheDocument();
  });
});
