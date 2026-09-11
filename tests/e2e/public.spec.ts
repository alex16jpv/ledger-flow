import { expect, test } from "@playwright/test";

import { expectNoAxeViolations } from "./axe";

test("the landing is static, bilingual and links to sign-up, sign-in and the legal pages", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "See where your money actually goes.",
  );
  await expect(page.getByRole("link", { name: "Create your free account" })).toHaveAttribute(
    "href",
    /\/register$/,
  );
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toHaveAttribute(
    "href",
    /\/login$/,
  );
  await expect(page.getByRole("img", { name: "Preview of the home screen" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Built for the small stuff" }),
  ).toBeVisible();
  await expect(page.getByText(/free expense tracker and budget app/)).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Up and running in a minute" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  const html = await (await request.get("/")).text();
  expect(html).toContain("See where your money actually goes.");
  expect(html).toContain('<html lang="en"');
  await expect(page.getByRole("link", { name: "English" })).toHaveAttribute("href", /\/$/);
  await expect(page.getByRole("link", { name: "Español" })).toHaveAttribute("href", /\/es$/);

  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms of service" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ledgerflow@alexpiral.com" }).first(),
  ).toHaveAttribute("href", "mailto:ledgerflow@alexpiral.com");
  await page.goto("/");

  await page.getByRole("link", { name: "Language" }).click();
  await expect(page).toHaveURL(/\/es$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Mira a dónde se va tu dinero de verdad.",
  );

  await expect(page.getByRole("link", { name: "English" })).toHaveAttribute("href", /\/en$/);

  // F-37: Chromium's mobile emulation hit-tests a footer click ~96 px off, so focus is used.
  const privacy = page.getByRole("link", { name: "Política de privacidad" });
  await expect(privacy).toHaveAttribute("href", /\/es\/privacy$/);
  await privacy.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/es\/privacy$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Política de privacidad" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Ley 1581/ })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("an unknown public address answers a real 404 inside the public frame", async ({
  page,
  request,
}) => {
  expect((await request.get("/this-page-does-not-exist")).status()).toBe(404);
  await page.goto("/this-page-does-not-exist");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", /\/home$/);
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  await expectNoAxeViolations(page);
});

// P-33 (owner, 2026-09-08): the root is the app's door, and the pitch is for visitors only.
test("the root opens the app for a device that carries the session marker", async ({
  page,
  request,
}) => {
  const email = `e2e-root-${Date.now()}-${Math.random().toString(16).slice(2)}@ledgerflow.test`;
  await request.post("/api/auth/register", {
    headers: { origin: process.env.E2E_APP_URL ?? "http://localhost:3002" },
    data: { name: "Root E2E", email, password: "LedgerFlow!2026", locale: "en" },
  });
  await page.context().addCookies((await request.storageState()).cookies);

  await page.goto("/");

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Hi,/);
});

test("the root still shows the landing to a visitor with no marker", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
