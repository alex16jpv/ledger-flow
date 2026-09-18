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
  await signIn(page, request);
  const note = `E2E card adjust ${Date.now()}`;
  const accounts = (await (await request.get("/api/accounts?limit=50")).json()) as {
    data: { id: string; name: string }[];
  };
  const visa = accounts.data.find((account) => account.name === "Visa Gold");
  await page.goto(`/accounts/${visa?.id}`);

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
  expect(created?.toAccountId).toBe(visa?.id);
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
