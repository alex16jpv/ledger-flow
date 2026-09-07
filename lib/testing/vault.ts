import { openVault, type VaultDefinition, type VaultHandle } from "@/lib/local/db";
import type { Account, Category, SyncBudget, SyncTransaction, User } from "@/types/api";

const USER_ID = "11111111-1111-4111-8111-111111111111";

export function profile(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    email: "john@example.com",
    name: "John Doe",
    currency: "COP",
    timezone: "America/Bogota",
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
  return {
    id: "t1",
    type: "EXPENSE",
    amount: 20.29,
    date: "2026-08-01T10:00:00.000Z",
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

const opened = new Set<VaultHandle>();

// A failed assertion skips the close() at the end of a test, and the open connection then blocks
// deleteDatabase for every test after it. Tracking the handles keeps one failure from cascading.
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
