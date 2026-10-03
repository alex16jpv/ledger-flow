import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { sectionOf } from "@/features/shared/ledger";
import type { SharedLedgerRows } from "@/lib/local/repository";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import { account, contact, sharedExpense, sharedGroup } from "@/lib/testing/vault";
import type { SharedGroup, SharedShare, SyncSharedGroup } from "@/types/api";

import { ArchiveGroupSheet, WriteOffSheet } from "./WriteOffSheet";

const ANA = "k1";
const BETO = "k2";
const CARLA = "k3";
const fetchMock = vi.fn<typeof fetch>();
const pagination = { limit: 100, offset: 0, total: 1, hasMore: false, nextCursor: null };
const bank = account({ id: "banco", name: "Bancolombia" });
const lifestyle = {
  id: "cat-life",
  name: "Lifestyle",
  icon: "gift",
  color: "PINK",
  type: "EXPENSE",
  seedKey: null,
  archivedAt: null,
};

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/shared",
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((input, init) => {
    const href = urlOf(input);
    if (href.startsWith("/api/settlements") && init?.method === "POST") {
      return Promise.resolve(json({ settlement: {}, covered: [], refunded: 0, restamped: [] }));
    }
    if (href.includes("/api/categories")) {
      return Promise.resolve(json({ data: [lifestyle], pagination }));
    }
    return Promise.resolve(json({ data: [bank], pagination }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const share = (contactId: string | null, amount: number): SharedShare => ({
  party: contactId === null ? "USER" : "CONTACT",
  contactId,
  percent: null,
  fixedAmount: null,
  amount,
  collected: 0,
});

const withTotals = (row: SyncSharedGroup): SharedGroup => ({
  ...row,
  status: "OPEN",
  totals: {
    amount: 0,
    yourShare: 0,
    owedToYou: 0,
    writtenOff: 0,
    youOwe: 0,
    collected: 0,
    expenseCount: 0,
    dateFrom: null,
    dateTo: null,
  },
});

// Ana owes you 60,000 of the food and you owe her 30,000 of the tickets; Beto owes you 40,000.
// With Carla: she owes you 40,000 of the food and you owe her 10,000 of a taxi she paid.
function nightOut({ carla = false } = {}) {
  const rows: SharedLedgerRows = {
    groups: [withTotals(sharedGroup({ id: "g1", name: "Night out" }))],
    expenses: [
      sharedExpense({
        id: "s1",
        description: "Food",
        amount: carla ? 200_000 : 160_000,
        split: {
          mode: "EQUAL",
          guests: null,
          shares: [
            share(null, 60_000),
            share(ANA, 60_000),
            share(BETO, 40_000),
            ...(carla ? [share(CARLA, 40_000)] : []),
          ],
        },
      }),
      sharedExpense({
        id: "s2",
        description: "Tickets",
        date: "2026-08-14T20:00:00.000Z",
        amount: 60_000,
        paidByContactId: ANA,
        split: { mode: "EQUAL", guests: null, shares: [share(null, 30_000), share(ANA, 30_000)] },
      }),
      ...(carla
        ? [
            sharedExpense({
              id: "s3",
              description: "Taxi",
              date: "2026-08-15T20:00:00.000Z",
              amount: 20_000,
              paidByContactId: CARLA,
              split: {
                mode: "EQUAL" as const,
                guests: null,
                shares: [share(null, 10_000), share(CARLA, 10_000)],
              },
            }),
          ]
        : []),
    ],
    settlements: [],
    undone: [],
    dropped: [],
    unstored: new Set(),
  };
  const section = sectionOf(rows, [
    contact({ id: ANA, name: "Ana Ruiz" }),
    contact({ id: BETO, name: "Beto Cano" }),
    contact({ id: CARLA, name: "Carla Díaz" }),
  ]);
  const [view] = section.groups;
  if (!view) throw new Error("no group");
  const person = (contactId: string) => {
    const found = view.people.find((one) => one.contactId === contactId);
    if (!found) throw new Error(`no ${contactId}`);
    return found;
  };
  return { section, view, ana: person(ANA), beto: person(BETO) };
}

const render = (ui: React.ReactElement) =>
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>{ui}</ToastProvider>
    </QueryProvider>,
  );

async function openSheet(name: string) {
  const sheets = await screen.findAllByRole("dialog", { name });
  const shown = sheets.find((sheet) => sheet.hasAttribute("open"));
  if (!shown) throw new Error(`no ${name} sheet is open`);
  return shown;
}

async function chooseAccountAndCategory() {
  await userEvent.click(screen.getByRole("button", { name: /^Where both are recorded/ }));
  await userEvent.click(
    await within(await openSheet("Account")).findByRole("option", { name: /Bancolombia/ }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: /^Category for your \$30,000 of Tickets/ }),
  );
  await userEvent.click(
    await within(await openSheet("Category")).findByRole("option", { name: /Lifestyle/ }),
  );
}

const settlementsPosted = () =>
  fetchMock.mock.calls
    .filter(
      ([input, init]) => urlOf(input).startsWith("/api/settlements") && init?.method === "POST",
    )
    .map(([, init]) => JSON.parse(init?.body as string) as Record<string, unknown>);

describe("writing somebody off", () => {
  it("writes off what is open, with no account and nothing recorded, when you owe them nothing", async () => {
    const { section, view, beto } = nightOut();
    const onConfirm = vi.fn();
    render(
      <WriteOffSheet
        open
        section={section}
        view={view}
        person={beto}
        pending={false}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /^Where both are recorded/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Write off $40,000" }));

    expect(onConfirm).toHaveBeenCalledWith({
      owing: [{ contactId: BETO, expenseId: null, amount: 40_000 }],
      crossings: [],
    });
    expect(settlementsPosted()).toEqual([]);
  });

  it("squares the group with somebody you also owe, and writes off only the rest", async () => {
    const { section, view, ana } = nightOut();
    const onConfirm = vi.fn();
    render(
      <WriteOffSheet
        open
        section={section}
        view={view}
        person={ana}
        pending={false}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    expect(await openSheet("Square Night out with Ana Ruiz")).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Write off $30,000" });
    expect(confirm).toBeDisabled();

    await chooseAccountAndCategory();
    await userEvent.click(confirm);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        owing: [{ contactId: ANA, expenseId: null, amount: 30_000 }],
        crossings: [expect.any(String)],
      });
    });
    expect(settlementsPosted()).toEqual([
      expect.objectContaining({
        collected: 30_000,
        paid: 30_000,
        groupId: "g1",
        accountId: "banco",
        categories: [{ expenseId: "s2", categoryId: "cat-life" }],
      }),
    ]);
  });

  it("records the crossing once, however fast the button is pressed twice", async () => {
    const { section, view, ana } = nightOut();
    const onConfirm = vi.fn();
    render(
      <WriteOffSheet
        open
        section={section}
        view={view}
        person={ana}
        pending={false}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    await chooseAccountAndCategory();
    await userEvent.dblClick(screen.getByRole("button", { name: "Write off $30,000" }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    expect(settlementsPosted()).toHaveLength(1);
  });
});

describe("archiving a group", () => {
  it("squares whoever you also owe first, and writes off what is left of everybody", async () => {
    const { section, view } = nightOut();
    const onConfirm = vi.fn();
    render(
      <ArchiveGroupSheet
        open
        section={section}
        view={view}
        pending={false}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    const confirm = screen.getByRole("button", { name: "Archive and write off $70,000" });
    expect(confirm).toBeDisabled();
    await chooseAccountAndCategory();
    await userEvent.click(confirm);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        owing: [
          { contactId: ANA, expenseId: null, amount: 30_000 },
          { contactId: BETO, expenseId: null, amount: 40_000 },
        ],
        crossings: [expect.any(String)],
      });
    });
    expect(settlementsPosted()).toHaveLength(1);
  });

  it("squares everybody you also owe, one payment each, before writing off the rest", async () => {
    const { section, view } = nightOut({ carla: true });
    const onConfirm = vi.fn();
    render(
      <ArchiveGroupSheet
        open
        section={section}
        view={view}
        pending={false}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/You also owe Ana Ruiz and Carla Díaz here/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Where both are recorded/ }));
    await userEvent.click(
      await within(await openSheet("Account")).findByRole("option", { name: /Bancolombia/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^Category for the expenses this records/ }),
    );
    await userEvent.click(
      await within(await openSheet("Category")).findByRole("option", { name: /Lifestyle/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Archive and write off $100,000" }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    expect(settlementsPosted()).toEqual([
      expect.objectContaining({ contactId: ANA, collected: 30_000, paid: 30_000 }),
      expect.objectContaining({ contactId: CARLA, collected: 10_000, paid: 10_000 }),
    ]);
    expect(onConfirm.mock.calls[0]?.[0]).toMatchObject({
      owing: [
        { contactId: ANA, amount: 30_000 },
        { contactId: BETO, amount: 40_000 },
        { contactId: CARLA, amount: 30_000 },
      ],
    });
  });
});
