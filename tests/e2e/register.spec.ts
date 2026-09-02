import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";

test("registration needs the consent box, then lands on onboarding", async ({ page }) => {
  await page.goto("/register");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const submit = page.getByRole("button", { name: "Create account" });
  await expect(submit).toBeDisabled();
  await page.getByRole("textbox", { name: "Name" }).fill("Register E2E");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`e2e-register-${Date.now()}@ledgerflow.test`);
  await page.getByLabel("Password", { exact: true }).fill("LedgerFlow!2026");
  await expect(page.getByText(/Detected from your region/)).toBeVisible();
  await page.getByRole("checkbox").check({ force: true });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).toHaveURL(`${APP}/onboarding`);
});

test("a taken email shows the inline error with a sign-in link", async ({ page, request }) => {
  const email = `e2e-taken-${Date.now()}@ledgerflow.test`;
  await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Taken", email, password: "LedgerFlow!2026" },
  });
  await request.post("/api/auth/logout", { headers: { origin: APP } });
  await page.goto("/register");
  await page.getByRole("textbox", { name: "Name" }).fill("Someone");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("LedgerFlow!2026");
  await page.getByRole("checkbox").check({ force: true });
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/This email already has an account/)).toBeVisible();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "already has an account" })
      .getByRole("link", { name: "Sign in" }),
  ).toBeVisible();
});

test("the currency picker opens with the search box focused", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: /[A-Z]{3} · / }).click();
  const dialog = page.getByRole("dialog", { name: "Choose your currency" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("searchbox", { name: "Search" })).toBeFocused();
  await page.keyboard.type("euro");
  await expect(dialog.getByRole("option", { name: /EUR/ })).toBeVisible();
});
