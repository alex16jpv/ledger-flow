import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
const FOOD = "01920000-0000-7000-8000-00000000c105";
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

async function signIn(page: Page, request: Request) {
  const response = await request.post("/api/auth/login", { headers: { origin: APP }, data: SEED });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

// Mutations run on a throwaway user (with its 10 seeded defaults) so the seed stays untouched.
async function signUp(page: Page, request: Request) {
  const response = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: {
      name: "Categories E2E",
      email: `e2e-categories-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ledgerflow.test`,
      password: "LedgerFlow!2026",
    },
  });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

test("the grid groups the seed by type with usage counts and the edit form locks a used type", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto("/categories");
  await expect(page.getByRole("heading", { level: 1, name: "Categories" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Expense · \d+$/, pressed: true })).toBeVisible();
  const food = page.getByRole("link", { name: /^Food/ });
  await expect(food).toContainText(/\d+ transactions/);
  await expect(page.getByRole("link", { name: /^Salary/ })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: /^Income · \d+$/ }).click();
  await expect(page).toHaveURL(/type=INCOME/);
  await expect(page.getByRole("link", { name: /^Salary/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "New category" }).last()).toHaveAttribute(
    "href",
    /\/categories\/new\?type=INCOME$/,
  );

  await page.goto(`/categories/${FOOD}/edit`);
  await expect(page.getByRole("heading", { level: 1, name: "Edit category" })).toBeVisible();
  await expect(page.getByText("Expense · preview")).toBeVisible();
  await expect(page.getByText(/The type can’t be changed/)).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Type" }).getByRole("button").first(),
  ).toBeDisabled();
  await expect(page.getByRole("link", { name: "See its transactions" })).toHaveAttribute(
    "href",
    new RegExp(`/transactions\\?category=${FOOD}&period=all$`),
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("a new user creates, retypes, archives and restores categories, and restores the defaults", async ({
  page,
  request,
}) => {
  await signUp(page, request);
  await page.goto("/categories");
  await expect(page.getByRole("button", { name: "Expense · 5", pressed: true })).toBeVisible();

  await page.getByRole("link", { name: "New category" }).first().click();
  await expect(page).toHaveURL(/\/categories\/new\?type=EXPENSE$/);
  await page.getByRole("textbox", { name: "Name" }).fill("Gym");
  await page.getByRole("button", { name: "dumbbell" }).click();
  await page.getByRole("button", { name: "Teal" }).click();
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByText("Category created")).toBeVisible();
  await expect(page).toHaveURL(/\/categories\?type=EXPENSE$/);
  const gym = page.getByRole("link", { name: /^Gym/ });
  await expect(gym).toContainText("unused");

  await page.goto("/categories/new?type=EXPENSE");
  await page.getByRole("textbox", { name: "Name" }).fill("gym");
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(
    page.getByText("You already have an active category named “gym”. Names are case-insensitive."),
  ).toBeVisible();

  await page.goto("/categories");
  await gym.click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit category" })).toBeVisible();
  await page.getByRole("group", { name: "Type" }).getByRole("button", { name: "Income" }).click();
  await expect(page.getByText("Income · preview")).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved")).toBeVisible();
  await expect(page).toHaveURL(/type=INCOME$/);
  await expect(page.getByRole("link", { name: /^Gym/ })).toBeVisible();

  await page.getByRole("link", { name: /^Gym/ }).click();
  await page.getByRole("button", { name: "Archive category" }).click();
  const confirm = page.getByRole("dialog", { name: "Archive Gym?" });
  await expect(confirm).toContainText("Its movements and budgets keep pointing at it");
  await confirm.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Category archived")).toBeVisible();
  await expect(page).toHaveURL(/\/categories\?type=INCOME$/);
  await expect(page.getByRole("link", { name: /^Gym/ })).toHaveCount(0);
  await page.getByRole("button", { name: /^Archived/ }).click();
  await expect(page.getByRole("button", { name: "Restore Gym" })).toBeVisible();

  const taken = await request.post("/api/categories", {
    headers: { origin: APP },
    data: { name: "GYM", type: "EXPENSE" },
  });
  expect(taken.status()).toBe(201);
  const takenId = ((await taken.json()) as { id: string }).id;
  await page.getByRole("button", { name: "Restore Gym" }).click();
  const conflict = page.getByRole("dialog", { name: "That name is taken" });
  await expect(conflict).toContainText("An active category is already named “GYM”.");
  await conflict.getByRole("link", { name: "Open GYM" }).click();
  await expect(page).toHaveURL(new RegExp(`/categories/${takenId}/edit$`));
  await page.getByRole("textbox", { name: "Name" }).fill("Fitness");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved")).toBeVisible();

  await page.getByRole("button", { name: /^Archived/ }).click();
  await page.getByRole("button", { name: "Restore Gym" }).click();
  await expect(page.getByText("Category restored")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Archived/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText("Nothing was missing")).toBeVisible();
  const salary = (await (await request.get("/api/categories?type=INCOME")).json()) as {
    data: { id: string; name: string }[];
  };
  const salaryId = salary.data.find((row) => row.name === "Salary")?.id;
  expect(salaryId).toBeTruthy();
  const archivedSalary = await request.delete(`/api/categories/${salaryId}`, {
    headers: { origin: APP },
  });
  expect(archivedSalary.ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText("Nothing was missing")).toBeVisible();
});
