import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";

test("a user can sign in and lands on home; a wrong password shows one message", async ({
  page,
  request,
}) => {
  const email = `e2e-login-${Date.now()}@ledgerflow.test`;
  const password = "LedgerFlow!2026";
  await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Login E2E", email, password },
  });
  await request.post("/api/auth/logout", { headers: { origin: APP } });

  await page.goto("/login?next=%2Fhome");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome back");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();

  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${APP}/home`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Login");
});
