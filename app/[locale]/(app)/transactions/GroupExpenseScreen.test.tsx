import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { UUID } from "@/lib/testing/ids";
import { renderWithProviders } from "@/lib/testing/render";
import { contact, sharedGroup } from "@/lib/testing/vault";
import type { SharedGroup } from "@/types/api";

import { GroupExpenseScreen } from "./GroupExpenseScreen";

const replace = vi.fn();
let search = "group=g1&amount=4500&accountId=a1";
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace }),
  usePathname: () => "/transactions/new",
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

const ANA = "k1";
const page = (data: unknown[]) =>
  json({
    data,
    pagination: { limit: 100, offset: 0, total: data.length, hasMore: false, nextCursor: null },
  });

const accounts = [
  { id: "a1", name: "Bancolombia", type: "ACCOUNT", balance: 100, isDefault: true, color: "BLUE" },
];
const categories = [
  { id: "c1", name: "Food", icon: "utensils", color: "ORANGE", type: "EXPENSE", archivedAt: null },
];
const saved = {
  id: "t9",
  type: "EXPENSE",
  amount: 4500,
  date: "2026-09-21T17:00:00.000Z",
  dayKey: "2026-09-21",
  categoryId: null,
  description: "Beach club",
  note: null,
  tags: [],
  fromAccountId: "a1",
  toAccountId: null,
  countsAsYours: 4500,
  sharedExpenseId: null,
  sharedGroupId: null,
  sharedSettlementId: null,
  sharedHistory: [],
  pendingDetails: false,
  source: "MANUAL",
  userId: "u1",
  currency: "COP",
  createdAt: "2026-09-21T17:00:00.000Z",
  updatedAt: "2026-09-21T17:00:00.000Z",
};

function group(over: Partial<SharedGroup> = {}): SharedGroup {
  return {
    ...sharedGroup({
      id: "g1",
      name: "Night out",
      participants: [
        { contactId: null, addedAt: "2026-09-01T00:00:00.000Z" },
        { contactId: ANA, addedAt: "2026-09-01T00:00:00.000Z" },
      ],
    }),
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
    ...over,
  };
}

const fetchMock = vi.fn<typeof fetch>();
const calls = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);
const expensePosts = () =>
  calls("POST").filter(([input]) => urlOf(input).includes("/shared-groups/g1/expenses"));

function routeFetch(rows: SharedGroup[] = [group()], expensePost?: () => Promise<Response>) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    if (url.includes("/api/accounts")) return Promise.resolve(page(accounts));
    if (url.includes("/api/categories")) return Promise.resolve(page(categories));
    if (url.endsWith("/api/transactions/tags")) return Promise.resolve(json({ data: [] }));
    if (url.endsWith("/api/transactions") && method === "POST")
      return Promise.resolve(json(saved, { status: 201 }));
    if (url.includes("/shared-groups/g1/expenses") && method === "POST")
      return expensePost
        ? expensePost()
        : Promise.resolve(json({ id: "s1", groupId: "g1" }, { status: 201 }));
    if (url.startsWith("/api/contacts")) return Promise.resolve(page([contact({ id: ANA })]));
    if (url.includes("/expenses")) return Promise.resolve(page([]));
    if (url.startsWith("/api/settlements")) return Promise.resolve(page([]));
    return Promise.resolve(page(rows));
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  search = "group=g1&amount=4500&accountId=a1";
  vi.stubGlobal("fetch", fetchMock);
  routeFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function view() {
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <GroupExpenseScreen groupId="g1" />
      </ToastProvider>
    </QueryProvider>,
  );
}

describe("GroupExpenseScreen", () => {
  it("writes the movement and the group's expense in one gesture, with the split inherited", async () => {
    view();

    expect(await screen.findByText(/This goes into Night out/)).toHaveTextContent(
      "split equally between 2 people",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save and add to the group" }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/shared/groups/g1");
    });
    const [movement] = calls("POST");
    expect(JSON.parse(movement?.[1]?.body as string)).toMatchObject({
      type: "EXPENSE",
      amount: 4500,
      fromAccountId: "a1",
    });
    // Inheriting the group's split is sending none: carrying one is what marks it as the expense's own.
    expect(JSON.parse(expensePosts()[0]?.[1]?.body as string)).toEqual({
      id: expect.stringMatching(UUID),
      transactionId: "t9",
    });
  });

  it("does not offer a type nobody can share", async () => {
    view();

    await screen.findByRole("button", { name: "Save and add to the group" });
    expect(screen.queryByRole("group", { name: "Type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transfer" })).not.toBeInTheDocument();
    expect(screen.getByText(/Money leaving one of your accounts/)).toBeVisible();
  });

  it("takes the percentages from the group when that is what it splits by", async () => {
    routeFetch([group({ defaultSplit: { mode: "PERCENT", shares: [] } })]);
    view();

    expect(await screen.findByText(/This goes into Night out/)).toHaveTextContent(
      "split between 2 people by the percentages it sets",
    );
  });

  it("says an archived group is read, not worked, instead of recording into it", async () => {
    routeFetch([group({ archivedAt: "2026-09-20T00:00:00.000Z" })]);
    view();

    expect(await screen.findByText("Night out is archived")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Save and add to the group" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open the group" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Back to Shared" })).toBeVisible();
  });

  it("draws the other three states rather than a form over nothing", async () => {
    routeFetch([]);
    const { unmount } = renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <GroupExpenseScreen groupId="g1" />
        </ToastProvider>
      </QueryProvider>,
    );
    // Loading: the silhouette, announced, and no form yet.
    expect(screen.getByRole("status", { name: "Loading" })).toBeVisible();
    // A group this device does not have is said, with the way back.
    expect(await screen.findByText("This shared group doesn’t exist.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Back to Shared" })).toBeVisible();
    unmount();

    fetchMock.mockImplementation(() => Promise.reject(new TypeError("offline")));
    view();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Save and add to the group" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the movement when the group refuses it, and retries only that half", async () => {
    let refuse = true;
    routeFetch([group()], () => {
      const answer = refuse
        ? json({ code: "INTERNAL", message: "no" }, { status: 500 })
        : json({ id: "s1", groupId: "g1" }, { status: 201 });
      refuse = false;
      return Promise.resolve(answer);
    });
    view();

    await userEvent.click(await screen.findByRole("button", { name: "Save and add to the group" }));
    expect(await screen.findByText(/The movement is saved/)).toBeVisible();
    expect(screen.getByText("Beach club")).toBeVisible();
    expect(replace).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Add it to the group again" }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/shared/groups/g1");
    });
    // The movement was written once; only the half that failed went out again.
    expect(
      calls("POST").filter(([input]) => urlOf(input).endsWith("/api/transactions")),
    ).toHaveLength(1);
    expect(expensePosts()).toHaveLength(2);
    // And it went out under the id it was minted with: a second try never opens a second expense.
    const ids = expensePosts().map(
      ([, init]) => (JSON.parse(init?.body as string) as { id: string }).id,
    );
    expect(ids[0]).toBe(ids[1]);
  });

  it("stays on the refusal when the second try is refused too, and says what it was", async () => {
    routeFetch([group()], () =>
      Promise.resolve(json({ code: "SPLIT_INVALID", message: "no" }, { status: 422 })),
    );
    view();

    await userEvent.click(await screen.findByRole("button", { name: "Save and add to the group" }));
    const retry = await screen.findByRole("button", { name: "Add it to the group again" });
    await userEvent.click(retry);

    await waitFor(() => {
      expect(expensePosts()).toHaveLength(2);
    });
    expect(await screen.findByText(/The movement is saved/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Add it to the group again" })).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });
});
