import { expect, type Page, test } from "../fixtures";
import { expectNoAxeViolations } from "./axe";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

async function signIn(page: Page, request: Request) {
  const response = await request.post("/api/auth/login", { headers: { origin: APP }, data: SEED });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

function uniqueAmount(): number {
  return 100_000 + Math.floor(Math.random() * 899_999);
}

// The two Playwright projects run the same test at once: a clock-only suffix collides between them.
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ledgerflow.test`;
}

interface Row {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  note: string | null;
  tags: string[];
  fromAccountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
}

async function rows(request: Request): Promise<Row[]> {
  const list = (await (await request.get("/api/transactions?limit=50")).json()) as { data: Row[] };
  return list.data;
}

async function findByAmount(request: Request, amount: number) {
  return (await rows(request)).find((row) => row.amount === amount);
}

async function findByNote(request: Request, note: string) {
  return (await rows(request)).find((row) => row.note === note);
}

test("a transaction is created, edited and deleted from the full form", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  const amount = uniqueAmount();
  await page.goto(`/transactions/new?amount=${amount}&description=E2E%20taxi`);
  await expect(page.getByRole("heading", { level: 1, name: "New transaction" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Description/ })).toHaveValue("E2E taxi");
  await page.getByRole("button", { name: /^Category/ }).click();
  await page
    .getByRole("dialog", { name: "Category" })
    .getByRole("option", { name: /Transportation/ })
    .click();
  await page.getByRole("button", { name: /^Account/ }).click();
  await page.getByRole("dialog", { name: "Account" }).getByRole("option", { name: /Cash/ }).click();
  await page.getByRole("textbox", { name: /^Tags/ }).fill("e2e");
  await page.keyboard.press("Enter");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByText("Transaction saved")).toBeVisible();

  const created = await findByAmount(request, amount);
  expect(created).toMatchObject({ type: "EXPENSE", description: "E2E taxi", tags: ["e2e"] });
  expect(created?.categoryId).toBeTruthy();

  await page.goto(`/transactions/${created?.id}/edit`);
  await expect(page.getByRole("heading", { level: 1, name: "Edit transaction" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Description/ })).toHaveValue("E2E taxi");
  await expect(page.getByRole("button", { name: "Remove tag e2e" })).toBeVisible();
  await page.getByRole("textbox", { name: /^Description/ }).fill("E2E taxi home");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved")).toBeVisible();
  expect((await findByAmount(request, amount))?.description).toBe("E2E taxi home");

  await page.goto(`/transactions/${created?.id}/edit`);
  await page.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this transaction?" });
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Transaction deleted")).toBeVisible();
  expect((await request.get(`/api/transactions/${created?.id}`)).status()).toBe(404);
});

test("a transfer refuses the same account on both sides and swaps them", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  const amount = uniqueAmount();
  await page.goto("/transactions/new");
  await expect(page.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await page.getByRole("button", { name: "Transfer" }).click();
  await expect(page.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await page.getByRole("textbox", { name: "Amount" }).fill(String(amount));
  await page.getByRole("button", { name: /^From/ }).click();
  await page
    .getByRole("dialog", { name: "Account" })
    .getByRole("option", { name: /Bancolombia/ })
    .click();
  await page.getByRole("button", { name: /^To/ }).click();
  const toOptions = page.getByRole("dialog", { name: "Account" }).getByRole("option");
  await expect(toOptions.filter({ hasText: "Bancolombia" })).toHaveCount(0);
  await toOptions.filter({ hasText: /^Savings/ }).click();
  await page.getByRole("button", { name: "Swap accounts" }).click();
  await expect(page.getByRole("button", { name: /^From.*Savings/ })).toBeVisible();
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByText("Transaction saved")).toBeVisible();
  const created = await findByAmount(request, amount);
  expect(created?.type).toBe("TRANSFER");
  expect(created?.fromAccountId).not.toBe(created?.toAccountId);
  await request.delete(`/api/transactions/${created?.id}`, { headers: { origin: APP } });
});

// T-85/T-86: the fourth type left this form, and each of the three says what it is.
test("the form offers three types, says what the one selected is, and stops at tomorrow", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto("/transactions/new");
  await expect(page.getByRole("group", { name: "Type" }).getByRole("button")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Adjustment" })).toHaveCount(0);
  // The shell keeps the quick sheet mounted with the same line inside it, hence the scope.
  await expect(
    page.getByRole("main").getByText("Money leaving one of your accounts and not coming back."),
  ).toBeVisible();

  await page.getByRole("button", { name: "What the three types mean" }).click();
  const explained = page.getByRole("dialog", { name: "What the three types mean" });
  await expect(explained.getByText("Nothing is spent and nothing is earned.")).toBeVisible();
  await explained.getByRole("button", { name: "Close" }).click();

  // F-05: the calendar stops at tomorrow, so the error this used to provoke is unreachable.
  await page.getByRole("button", { name: /^Date/ }).click();
  const calendar = page.getByRole("dialog", { name: "Date" });
  await expect(calendar.getByRole("button", { name: "Next month" })).toBeDisabled();
  await expect(
    calendar.getByText("Days after tomorrow are not available:", { exact: false }),
  ).toBeVisible();
});

// T-86: only a browser shows that the chip filled both sides and what the sentence then says.
test("a chip fills the two sides, the form reads the movement back, and the transfer keeps a category", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  const amount = uniqueAmount();
  await page.goto("/transactions/new");
  await page.getByRole("button", { name: "Transfer" }).click();
  await page.getByRole("textbox", { name: "Amount" }).fill(String(amount));
  await page.getByRole("button", { name: "Pay a card" }).click();

  await expect(page.getByRole("button", { name: /^From.*Bancolombia/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^To.*Visa Gold/ })).toBeVisible();
  await expect(page.getByText(/Visa Gold .* less owed/)).toBeVisible();
  await expect(page.getByText(/Bancolombia −/)).toBeVisible();

  await page.getByRole("button", { name: /^Category \(optional\)/ }).click();
  await page
    .getByRole("dialog", { name: "Category" })
    .getByRole("option", { name: /Credit Card Payment/ })
    .click();
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByText("Transaction saved")).toBeVisible();

  const created = await findByAmount(request, amount);
  expect(created?.type).toBe("TRANSFER");
  expect(created?.categoryId).toBeTruthy();
  await request.delete(`/api/transactions/${created?.id}`, { headers: { origin: APP } });
});

// T-95: on a card the same sheet asks the debt, not the balance with its sign.
test("adjusting a card asks what it owes and books the difference as debt", async ({
  page,
  request,
}) => {
  // Its own user and its own card: the two projects run this at once and used to fight over the seed.
  const signedUp = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Adjust E2E", email: uniqueEmail("adjust"), password: "LedgerFlow!2026" },
  });
  expect(signedUp.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
  const made = await request.post("/api/accounts", {
    headers: { origin: APP },
    data: { name: "Visa Gold", type: "CARD", balance: -1_245_900, creditLimit: 4_000_000 },
  });
  expect(made.status()).toBe(201);
  const visa = (await made.json()) as { id: string };

  const note = `E2E card adjust ${Date.now()}`;
  await page.goto(`/accounts/${visa.id}`);

  await page.getByRole("button", { name: "Adjust balance" }).click();
  const adjusting = page.getByRole("dialog", { name: "Adjust balance" });
  await expect(adjusting.getByRole("button", { name: "Owed", pressed: true })).toBeVisible();
  await expect(adjusting.getByText("Recorded: $1,245,900 owed")).toBeVisible();
  await expectNoAxeViolations(page);
  await adjusting
    .getByRole("textbox", { name: /How much do you owe on Visa Gold right now/ })
    .fill("1233600");
  await expect(adjusting.getByText("$12,300 less owed")).toBeVisible();
  await adjusting.getByRole("textbox", { name: /^Note/ }).fill(note);
  await adjusting.getByRole("button", { name: "Save adjustment" }).click();
  await expect(page.getByText("Adjustment saved")).toBeVisible();

  const created = await findByNote(request, note);
  expect(created?.type).toBe("ADJUSTMENT");
  expect(created?.amount).toBe(12_300);
  expect(created?.toAccountId).toBe(visa.id);
  expect(created?.fromAccountId).toBe(null);

  const removed = await request.delete(`/api/transactions/${created?.id}`, {
    headers: { origin: APP },
  });
  expect(removed.ok()).toBe(true);
});

// T-89: an adjustment is made and edited in the account, on its own amount and never on today's balance.
test("an adjustment is made in the account and edited from its own list", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  const note = `E2E adjust ${Date.now()}`;
  const accounts = (await (await request.get("/api/accounts?limit=50")).json()) as {
    data: { id: string; name: string }[];
  };
  const cash = accounts.data.find((account) => account.name === "Cash");
  await page.goto(`/accounts/${cash?.id}`);

  await page.getByRole("button", { name: "Adjust balance" }).click();
  const adjusting = page.getByRole("dialog", { name: "Adjust balance" });
  await adjusting.getByRole("textbox", { name: /Actual balance in Cash/ }).fill("777777");
  await adjusting.getByRole("textbox", { name: /^Note/ }).fill(note);
  await adjusting.getByRole("button", { name: "Save adjustment" }).click();
  await expect(page.getByText("Adjustment saved")).toBeVisible();

  const created = await findByNote(request, note);
  expect(created?.type).toBe("ADJUSTMENT");

  const row = page.getByRole("button", { name: /Balance adjustment/ }).first();
  await row.click();
  const editing = page.getByRole("dialog", { name: "Edit adjustment" });
  await expect(editing.getByText(/Cash/)).toBeVisible();
  const amount = uniqueAmount();
  await editing.getByRole("textbox", { name: "Amount" }).fill(String(amount));
  await editing.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Adjustment updated")).toBeVisible();
  expect((await findByNote(request, note))?.amount).toBe(amount);

  await row.click();
  await editing.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("dialog", { name: "Delete this transaction?" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("Transaction deleted")).toBeVisible();
  expect((await request.get(`/api/transactions/${created?.id}`)).status()).toBe(404);
});

// T-93: the rule is the server's; the form's job is not to offer what it will refuse.
test("an income is not offered a card or a loan, and the server refuses one anyway", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: {
      name: "Rules E2E",
      email: uniqueEmail("rules"),
      password: "LedgerFlow!2026",
    },
  });
  expect(created.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);

  const account = async (data: Record<string, unknown>): Promise<{ id: string }> => {
    const response = await request.post("/api/accounts", { headers: { origin: APP }, data });
    expect(response.status()).toBe(201);
    return (await response.json()) as { id: string };
  };
  const bank = await account({ name: "Bank", type: "ACCOUNT", balance: 20_000 });
  const card = await account({
    name: "Visa E2E",
    type: "CARD",
    balance: -1_245,
    creditLimit: 4_000,
  });
  const loan = await account({
    name: "Loan E2E",
    type: "LOAN",
    balance: -8_400,
    borrowedAmount: 12_000,
  });
  const overdraft = await account({
    name: "Overdraft E2E",
    type: "OVERDRAFT",
    balance: 320,
    creditLimit: 2_000,
  });

  await page.goto("/transactions/new");
  await page.getByRole("button", { name: "Income" }).click();
  await page.getByRole("button", { name: /^Account/ }).click();
  const picker = page.getByRole("dialog", { name: "Account" });
  await expect(picker.getByRole("option", { name: /Bank/ })).toBeVisible();
  await expect(picker.getByRole("option", { name: /Overdraft E2E/ })).toBeVisible();
  await expect(picker.getByRole("option", { name: /Visa E2E/ })).toHaveCount(0);
  await expect(picker.getByRole("option", { name: /Loan E2E/ })).toHaveCount(0);
  await expect(picker.getByText(/is a payment, not income/)).toBeVisible();

  const income = async (toAccountId: string) =>
    request.post("/api/transactions", {
      headers: { origin: APP },
      data: { type: "INCOME", amount: 600, date: new Date().toISOString(), toAccountId },
    });

  for (const target of [card, loan]) {
    const refused = await income(target.id);
    expect(refused.status()).toBe(400);
    expect(((await refused.json()) as { code: string }).code).toBe("INCOME_ON_CARD_OR_LOAN");
  }

  // The overdraft is the one debt type that takes income: its positive balance is its ordinary state.
  expect((await income(overdraft.id)).status()).toBe(201);

  const overpaid = await request.post("/api/transactions", {
    headers: { origin: APP },
    data: {
      type: "TRANSFER",
      amount: 9_000,
      date: new Date().toISOString(),
      fromAccountId: bank.id,
      toAccountId: loan.id,
    },
  });
  expect(overpaid.status()).toBe(400);
  expect(((await overpaid.json()) as { code: string }).code).toBe("LOAN_OVERPAID");
});

test("a transfer can be paid from somewhere else, and only into an account that owes", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: {
      name: "Outside E2E",
      email: uniqueEmail("outside"),
      password: "LedgerFlow!2026",
    },
  });
  expect(created.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);

  const account = async (data: Record<string, unknown>): Promise<{ id: string }> => {
    const response = await request.post("/api/accounts", { headers: { origin: APP }, data });
    expect(response.status()).toBe(201);
    return (await response.json()) as { id: string };
  };
  await account({ name: "Bank", type: "ACCOUNT", balance: 5_000_000 });
  await account({ name: "Savings E2E", type: "SAVINGS", balance: 1_000_000 });
  const card = await account({
    name: "Visa E2E",
    type: "CARD",
    balance: -2_000_000,
    creditLimit: 4_000_000,
  });

  const amount = uniqueAmount();
  await page.goto("/transactions/new");
  await page.getByRole("button", { name: "Transfer" }).click();
  await page.getByRole("textbox", { name: "Amount" }).fill(String(amount));

  await page.getByRole("button", { name: "Move to savings" }).click();
  await page.getByRole("button", { name: /^From/ }).click();
  const plain = page.getByRole("dialog", { name: "Account" }).filter({ visible: true });
  await expect(plain.getByRole("option", { name: /Somewhere else/ })).toHaveCount(0);
  await plain.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Pay a card" }).click();
  await page.getByRole("button", { name: /^From/ }).click();
  const debt = page.getByRole("dialog", { name: "Account" }).filter({ visible: true });
  await debt.getByRole("option", { name: /Somewhere else/ }).click();

  await expect(page.getByRole("button", { name: /From.*Somewhere else/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Swap accounts" })).toBeDisabled();
  await expect(page.getByText(/never was in Ledger Flow/)).toBeVisible();
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page).toHaveURL(/\/transactions$/);

  const saved = await findByAmount(request, amount);
  expect(saved).toMatchObject({
    type: "ADJUSTMENT",
    fromAccountId: null,
    toAccountId: card.id,
    categoryId: null,
    description: "Paid from outside Ledger Flow",
  });
  const after = (await (await request.get(`/api/accounts/${card.id}`)).json()) as {
    balance: number;
  };
  expect(after.balance).toBe(-2_000_000 + amount);
});

test("a loan instalment is saved as a payment and an interest expense", async ({
  page,
  request,
}) => {
  const signedUp = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Instalment E2E", email: uniqueEmail("instalment"), password: "LedgerFlow!2026" },
  });
  expect(signedUp.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);

  const account = async (data: Record<string, unknown>): Promise<{ id: string }> => {
    const response = await request.post("/api/accounts", { headers: { origin: APP }, data });
    expect(response.status()).toBe(201);
    return (await response.json()) as { id: string };
  };
  await account({ name: "Bank", type: "ACCOUNT", balance: 20_000_000 });
  const loan = await account({
    name: "Car loan",
    type: "LOAN",
    balance: -8_400_000,
    borrowedAmount: 12_000_000,
  });

  await page.goto(`/accounts/${loan.id}`);
  await page.getByRole("button", { name: /Pay this loan/ }).click();
  const paying = page.getByRole("dialog", { name: "Pay Car loan" });
  await paying.getByRole("textbox", { name: "Amount to pay" }).fill("420000");
  await paying.getByRole("textbox", { name: "Of which interest" }).fill("126000");
  await expect(paying.getByText(/Car loan \$294,000 less owed/)).toBeVisible();
  await paying.getByRole("button", { name: "Pay", exact: true }).click();
  await expect(page.getByText("Payment recorded")).toBeVisible();

  const saved = await rows(request);
  const transfer = saved.find((row) => row.type === "TRANSFER" && row.amount === 294_000);
  const interest = saved.find((row) => row.type === "EXPENSE" && row.amount === 126_000);
  expect(transfer).toMatchObject({ toAccountId: loan.id });
  expect(interest?.description).toBe("Interest on Car loan");
  expect(interest?.toAccountId).toBeNull();

  const categories = (await (await request.get("/api/categories?type=EXPENSE")).json()) as {
    data: { id: string; seedKey: string | null }[];
  };
  const seeded = categories.data.find((row) => row.seedKey === "interest");
  expect(seeded).toBeDefined();
  expect(interest?.categoryId).toBe(seeded?.id);

  const after = (await (await request.get(`/api/accounts/${loan.id}`)).json()) as {
    balance: number;
  };
  expect(after.balance).toBe(-8_400_000 + 294_000);
});
