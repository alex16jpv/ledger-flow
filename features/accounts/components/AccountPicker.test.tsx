import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import type { Account } from "@/types/api";

import { AccountPicker } from "./AccountPicker";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();

function account(id: string, name: string, extra: Partial<Account> = {}): Account {
  return {
    id,
    name,
    type: "ACCOUNT",
    balance: 3420500,
    openingBalance: 0,
    color: "BLUE",
    userId: "u1",
    isDefault: false,
    currency: "COP",
    archivedAt: null,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

const accounts = [
  account("banco", "Bancolombia", { isDefault: true }),
  account("cash", "Cash", { type: "CASH", balance: 184000, color: "GRAY" }),
  account("visa", "Visa Gold", { type: "CARD", balance: -1245900, color: "PURPLE" }),
];

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    json({
      data: accounts,
      pagination: { limit: 100, offset: 0, total: 3, hasMore: false, nextCursor: null },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AccountPicker", () => {
  it("shows the selected account with its balance and lists the others with type and Main badge", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <QueryProvider>
        <AccountPicker value="banco" onChange={onChange} />
      </QueryProvider>,
    );
    const picker = await screen.findByRole("button", { name: /Bancolombia · \$3,420,500/ });
    await userEvent.click(picker);
    const listbox = screen.getByRole("listbox", { name: "Account" });
    expect(within(listbox).getAllByRole("option")).toHaveLength(3);
    const main = within(listbox).getByRole("option", { name: /Bancolombia/ });
    expect(main).toHaveAttribute("aria-selected", "true");
    expect(within(main).getByText("Main")).toBeVisible();
    expect(within(listbox).getByRole("option", { name: /Cash/ })).toHaveTextContent("$184,000");
    expect(within(listbox).getByRole("option", { name: /Visa Gold/ })).toHaveTextContent(
      "−$1,245,900",
    );

    expect(main).toHaveFocus();
    await userEvent.click(within(listbox).getByRole("option", { name: /Visa Gold/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: "visa" }));
    expect(
      screen.getByText("Archived accounts are not listed. Balances update as you save."),
    ).toBeInTheDocument();
  });

  it("hides the excluded account so a transfer cannot target its own source", async () => {
    renderWithProviders(
      <QueryProvider>
        <AccountPicker value={null} onChange={vi.fn()} label="To" exclude="banco" />
      </QueryProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /Choose an account/ }));
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    expect(names.some((name) => name?.includes("Bancolombia"))).toBe(false);
    expect(names).toHaveLength(2);
    expect(screen.getByRole("option", { name: /Cash/ })).toHaveFocus();
  });

  it("creates an account inline and selects it", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <QueryProvider>
        <AccountPicker value={null} onChange={onChange} />
      </QueryProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /Choose an account/ }));
    await userEvent.click(screen.getByRole("button", { name: /New account/ }));
    expect(screen.getByRole("heading", { name: "New account" })).toBeVisible();
    fetchMock.mockResolvedValueOnce(
      json(account("nu", "Nu", { type: "SAVINGS", balance: 0 }), { status: 201 }),
    );
    await userEvent.type(screen.getByLabelText("Name"), "Nu");
    await userEvent.click(screen.getByRole("button", { name: "Savings", pressed: false }));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: "nu" }));
    });
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(post?.[1]?.body as string)).toMatchObject({ name: "Nu", type: "SAVINGS" });
  });
});
