import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const APP = "http://localhost:3001";

test("registration needs the consent box, then lands on onboarding", async ({ page }) => {
  await page.goto("/register");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const submit = page.getByRole("button", { name: "Create account" });
  await expect(submit).toBeDisabled();
  await page.getByLabel("Name").fill("Register E2E");
  await page.getByLabel("Email").fill(`e2e-register-${Date.now()}@ledgerflow.test`);
  await page.getByLabel("Password").fill("LedgerFlow!2026");
  await expect(page.getByText(/Detected from your region/)).toBeVisible();
  await page.getByRole("checkbox").check();
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
  await page.getByLabel("Name").fill("Someone");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("LedgerFlow!2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/This email already has an account/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
