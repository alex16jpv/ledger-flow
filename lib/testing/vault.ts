import { dayKey } from "@/lib/format/dates";
import { openVault, type VaultDefinition, type VaultHandle } from "@/lib/local/db";
import type {
  Account,
  Category,
  Contact,
  ReceivedInvitation,
  SentInvitation,
  Settlement,
  SharedExpense,
  SyncBudget,
  SyncChangesResponse,
  SyncSharedGroup,
  SyncTransaction,
  User,
} from "@/types/api";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_TIME_ZONE = "America/Bogota";

export function profile(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    email: "john@example.com",
    name: "John Doe",
    currency: "COP",
    timezone: PROFILE_TIME_ZONE,
    locale: "en",
    lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

export function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "a1",
    name: "Cash",
    type: "CASH",
    balance: 1000,
    openingBalance: 0,
    color: "GREEN",
    userId: USER_ID,
    isDefault: true,
    currency: "COP",
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

export function category(overrides: Partial<Category> = {}): Category {
  return {
    id: "c1",
    name: "Dining",
    icon: "utensils",
    color: "ORANGE",
    type: "EXPENSE",
    userId: USER_ID,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

export function transaction(overrides: Partial<SyncTransaction> = {}): SyncTransaction {
  const date = overrides.date ?? "2026-08-01T10:00:00.000Z";
  const amount = overrides.amount ?? 20.29;
  return {
    id: "t1",
    type: "EXPENSE",
    amount,
    date,
    // The day the server would have frozen, so a row given another date carries the matching one.
    dayKey: dayKey(new Date(date), PROFILE_TIME_ZONE),
    categoryId: "c1",
    description: null,
    fromAccountId: "a1",
    toAccountId: null,
    userId: USER_ID,
    tags: [],
    note: null,
    pendingDetails: false,
    source: "MANUAL",
    currency: "COP",
    // The whole amount is yours until a split and a payment say otherwise.
    countsAsYours: amount,
    sharedExpenseId: null,
    sharedGroupId: null,
    sharedSettlementId: null,
    sharedHistory: [],
    deletedAt: null,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

export function budget(overrides: Partial<SyncBudget> = {}): SyncBudget {
  return {
    id: "b1",
    name: "Dining",
    color: "ORANGE",
    categoryIds: ["c1"],
    type: "EXPENSE",
    currency: "COP",
    amount: 400,
    amountOverrides: {},
    periodType: "MONTHLY",
    periodStartDate: null,
    periodEndDate: null,
    effectiveFrom: "2026-08-01T00:00:00.000Z",
    note: null,
    userId: USER_ID,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

export function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "k1",
    name: "Ana",
    color: "BLUE",
    linkedUserId: null,
    userId: USER_ID,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

export function sharedGroup(overrides: Partial<SyncSharedGroup> = {}): SyncSharedGroup {
  return {
    id: "g1",
    name: "Cartagena",
    color: "TEAL",
    participants: [{ contactId: null, addedAt: "2026-08-01T00:00:00.000Z" }],
    defaultSplit: { mode: "EQUAL", shares: [] },
    writeOffs: [],
    userId: USER_ID,
    currency: "COP",
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

export function sharedExpense(overrides: Partial<SharedExpense> = {}): SharedExpense {
  const amount = overrides.amount ?? 100000;
  return {
    id: "s1",
    groupId: "g1",
    description: "Cena",
    date: "2026-08-10T20:00:00.000Z",
    amount,
    paidByContactId: null,
    customSplit: false,
    split: {
      mode: "EQUAL",
      guests: null,
      shares: [
        { party: "USER", contactId: null, percent: null, fixedAmount: null, amount, collected: 0 },
      ],
    },
    userId: USER_ID,
    currency: "COP",
    deletedAt: null,
    createdAt: "2026-08-10T20:00:00.000Z",
    updatedAt: "2026-08-10T20:00:00.000Z",
    ...overrides,
  };
}

export function settlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: "p1",
    userId: USER_ID,
    counterparty: { kind: "CONTACT", contactId: "k1", expenseId: null },
    date: "2026-08-18T10:00:00.000Z",
    collected: 0,
    paid: 0,
    outsideApp: false,
    currency: "COP",
    deletedAt: null,
    createdAt: "2026-08-18T10:00:00.000Z",
    updatedAt: "2026-08-18T10:00:00.000Z",
    ...overrides,
  };
}

export function sentInvitation(overrides: Partial<SentInvitation> = {}): SentInvitation {
  return {
    id: "i1",
    groupId: "g1",
    contactId: "k1",
    email: "beto@example.com",
    status: "PENDING",
    expiresAt: "2099-01-01T00:00:00.000Z",
    answeredAt: null,
    withdrawnAt: null,
    createdAt: "2026-09-21T10:00:00.000Z",
    updatedAt: "2026-09-21T10:00:00.000Z",
    ...overrides,
  };
}

export function receivedInvitation(
  overrides: Partial<ReceivedInvitation> = {},
): ReceivedInvitation {
  return {
    id: "r1",
    groupId: "g9",
    groupName: "Villa de Leyva weekend",
    groupColor: "TEAL",
    groupCurrency: "COP",
    inviterName: "Ana Ruiz",
    inviterEmail: "ana@example.com",
    status: "PENDING",
    expiresAt: "2099-01-01T00:00:00.000Z",
    answeredAt: null,
    createdAt: "2026-09-21T10:00:00.000Z",
    updatedAt: "2026-09-21T10:00:00.000Z",
    ...overrides,
  };
}

// Every entity the feed carries, so a test names only the rows its case is about.
export function changes(
  overrides: Partial<SyncChangesResponse["changes"]> = {},
): SyncChangesResponse["changes"] {
  return {
    user: null,
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    contacts: [],
    sharedGroups: [],
    sharedExpenses: [],
    settlements: [],
    invitationsSent: [],
    invitationsReceived: [],
    ...overrides,
  };
}

const opened = new Set<VaultHandle>();

// A failed assertion skips `close()`, and an open connection blocks every later delete.
export async function openTestVault(
  userId: string,
  definition?: VaultDefinition,
): Promise<VaultHandle> {
  const handle = definition ? await openVault(userId, definition) : await openVault(userId);
  opened.add(handle);
  return handle;
}

export async function wipeVaults(): Promise<void> {
  for (const handle of opened) handle.close();
  opened.clear();
  if (typeof indexedDB.databases !== "function") return;
  const names = (await indexedDB.databases())
    .map((database) => database.name)
    .filter((name): name is string => typeof name === "string");
  await Promise.all(
    names.map(
      (name) =>
        new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => {
            resolve();
          };
          request.onerror = () => {
            resolve();
          };
          request.onblocked = () => {
            resolve();
          };
        }),
    ),
  );
}
