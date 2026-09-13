import { expect, test, uniqueEmail } from "../fixtures";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";

test("onboarding creates the first account and the global budget, then lands on home", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("onboarding");
  const registered = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Onboarding E2E", email, password: "LedgerFlow!2026" },
  });
  expect(registered.ok(), await registered.text()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);

  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your first account");
  await page.getByRole("textbox", { name: "Name" }).fill("Bancolombia");
  // F-03: the onboarding chooses the type the same way the account form does, in a sheet.
  await page.getByRole("button", { name: /^Type/ }).click();
  await page
    .getByRole("dialog", { name: "Account type" })
    .getByRole("option", { name: /^Bank account/ })
    .click();
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
