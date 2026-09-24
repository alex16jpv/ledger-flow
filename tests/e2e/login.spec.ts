import { expect, test, uniqueEmail } from "../fixtures";
import { expectNoAxeViolations } from "./axe";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";

test("a user can sign in and lands on home; a wrong password shows one message", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("login");
  const password = "LedgerFlow!2026";
  const registered = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Login E2E", email, password },
  });
  expect(registered.ok(), await registered.text()).toBe(true);
  await request.post("/api/auth/logout", { headers: { origin: APP } });

  await page.goto("/login?next=%2Fhome");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome back");
  await expectNoAxeViolations(page);

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();

  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${APP}/home`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Login");
});

test("a crafted next never takes a fresh sign-in off the app", async ({ page, request }) => {
  const email = uniqueEmail("login-next");
  const password = "LedgerFlow!2026";
  const registered = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Next E2E", email, password },
  });
  expect(registered.ok(), await registered.text()).toBe(true);
  await request.post("/api/auth/logout", { headers: { origin: APP } });

  await page.goto(`/login?reauth=1&next=${encodeURIComponent("/\\evil.example")}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${APP}/home`);

  await page.goto(`/login?next=${encodeURIComponent("/budgets?view=all")}`);
  await expect(page).toHaveURL(`${APP}/budgets?view=all`);

  await page.goto(`/es/login?next=${encodeURIComponent("/budgets?view=all")}`);
  await expect(page).toHaveURL(`${APP}/es/budgets?view=all`);
});

// iOS zooms in on a focused field under 16px and never back out (design/spec/typography.md).
test("no field is small enough to make iOS zoom in on focus", async ({ page }) => {
  await page.goto("/login");
  const sizes = await page
    .locator("input:not([type=checkbox])")
    .evaluateAll((fields) => fields.map((field) => parseFloat(getComputedStyle(field).fontSize)));
  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16);
});
