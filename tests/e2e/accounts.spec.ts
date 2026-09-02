import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
const BANCOLOMBIA = "01920000-0000-7000-8000-00000000a001";
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

async function signIn(page: Page, request: Request) {
  const response = await request.post("/api/auth/login", { headers: { origin: APP }, data: SEED });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

// Mutations run on a throwaway user so the parallel specs keep the seed's main account untouched.
async function signUp(page: Page, request: Request) {
  const response = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: {
      name: "Accounts E2E",
      email: `e2e-accounts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ledgerflow.test`,
      password: "LedgerFlow!2026",
    },
  });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

async function createAccount(request: Request, name: string, type = "CASH") {
  const response = await request.post("/api/accounts", {
    headers: { origin: APP },
    data: { name, type, balance: 0 },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string };
}

test("the list sums the seed accounts, folds the archived one and opens the main account's detail", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { level: 1, name: "Accounts" })).toBeVisible();
  await expect(page.getByText("Total balance")).toBeVisible();
  await expect(page.getByText(/\d+ active accounts · \d+ archived/)).toBeVisible();
  await expect(page.getByText("Card debt")).toBeVisible();
  await expect(page.getByRole("link", { name: /Bancolombia.*Main/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Nequi/ })).toBeHidden();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: /^Archived/ }).click();
  await expect(page.getByRole("link", { name: /Nequi.*Archived/ })).toBeVisible();

  await page.getByRole("link", { name: /Bancolombia.*Main/ }).click();
  await expect(page).toHaveURL(new RegExp(`/accounts/${BANCOLOMBIA}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Bancolombia" })).toBeVisible();
  await expect(page.getByText(/Opening balance .* · created .* · COP/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Main account" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Archive" })).toBeDisabled();
  await expect(page.getByText(/make another one your main account first/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Quick expense/ }).first()).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page.getByRole("link", { name: "Open with filters" })).toHaveAttribute(
    "href",
    new RegExp(`/transactions\\?account=${BANCOLOMBIA}&period=all$`),
  );
});

test("a new user creates, edits, promotes, archives and restores accounts, with the duplicate-name paths", async ({
  page,
  request,
}) => {
  await signUp(page, request);
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: "Create your first account" })).toBeVisible();
  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/accounts\/new$/);
  await page.getByRole("textbox", { name: "Name" }).fill("Wallet");
  await page.getByRole("button", { name: "Cash", exact: true }).click();
  await expect(page.getByText("Cash · preview")).toBeVisible();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Account created")).toBeVisible();
  await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Main", { exact: true })).toBeVisible();

  const second = await createAccount(request, "Second", "SAVINGS");
  await page.goto("/accounts/new");
  await page.getByRole("textbox", { name: "Name" }).fill("second");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText(
      "You already have an active account named “second”. Names are case-insensitive.",
    ),
  ).toBeVisible();

  await page.goto(`/accounts/${second.id}`);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(new RegExp(`/accounts/${second.id}/edit$`));
  const name = page.getByRole("textbox", { name: "Name" });
  await expect(name).toHaveValue("Second");
  await expect(page.getByRole("textbox", { name: "Current balance" })).toHaveCount(0);
  await name.fill("Second savings");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Second savings" })).toBeVisible();
  // Owner report P-26: after saving, "back" must not reopen the edit form.
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/accounts$/);
  await page.goto(`/accounts/${second.id}`);

  await page.getByRole("button", { name: "Main account" }).click();
  const confirm = page.getByRole("dialog", { name: "Make Second savings your main account?" });
  await expect(confirm).toContainText("Wallet stops being the main account.");
  await confirm.getByRole("button", { name: "Make main" }).click();
  await expect(page.getByText("Second savings is now your main account")).toBeVisible();
  await expect(page.getByRole("button", { name: "Main account" })).toBeDisabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Wallet is your main account again")).toBeVisible();
  await expect(page.getByRole("button", { name: "Main account" })).toBeEnabled();

  await page.getByRole("button", { name: "Archive" }).click();
  await page
    .getByRole("dialog", { name: "Archive Second savings?" })
    .getByRole("button", { name: "Archive" })
    .click();
  await expect(page.getByText("Account archived")).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore" })).toBeVisible();
  await expect(page.getByText(/This account is archived/)).toBeVisible();

  await createAccount(request, "second SAVINGS");
  await page.getByRole("button", { name: "Restore" }).click();
  const conflict = page.getByRole("dialog", { name: "That name is taken" });
  await expect(conflict).toContainText("An active account is already named “second SAVINGS”.");
  await expect(conflict.getByRole("button", { name: /^Restore/ })).toBeDisabled();
  await conflict.getByRole("textbox", { name: "New name" }).fill("Third");
  await conflict.getByRole("button", { name: "Restore as “Third”" }).click();
  await expect(page.getByText("Account restored")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Third" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
  const accounts = (await (await request.get("/api/accounts")).json()) as {
    data: { name: string; isDefault: boolean }[];
  };
  expect(accounts.data.map((row) => [row.name, row.isDefault])).toEqual(
    expect.arrayContaining([
      ["Wallet", true],
      ["second SAVINGS", false],
      ["Third", false],
    ]),
  );
});
