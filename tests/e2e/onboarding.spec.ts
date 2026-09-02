import { expect, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";

test("onboarding creates the first account and the global budget, then lands on home", async ({
  page,
  request,
}) => {
  const email = `e2e-onboarding-${Date.now()}@ledgerflow.test`;
  await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Onboarding E2E", email, password: "LedgerFlow!2026" },
  });
  await page.context().addCookies((await request.storageState()).cookies);

  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your first account");
  await page.getByLabel("Name").fill("Bancolombia");
  await page.getByRole("button", { name: "Bank account" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A ceiling for the month");
  await page.getByRole("button", { name: "$2,000,000" }).click();
  await page.getByRole("button", { name: "Create budget" }).click();
  await expect(page).toHaveURL(`${APP}/home`);

  const accounts = (await (await request.get("/api/accounts")).json()) as {
    data: { name: string; isDefault: boolean }[];
  };
  expect(accounts.data).toEqual([
    expect.objectContaining({ name: "Bancolombia", isDefault: true }),
  ]);
  const budgets = (await (await request.get("/api/budgets")).json()) as {
    data: { categoryIds: string[]; periodType: string }[];
  };
  expect(budgets.data).toEqual([
    expect.objectContaining({ categoryIds: [], periodType: "MONTHLY" }),
  ]);
});
