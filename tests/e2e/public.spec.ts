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
  await expect(
    page.getByRole("heading", { level: 2, name: "Up and running in a minute" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  const html = await (await request.get("/")).text();
  expect(html).toContain("See where your money actually goes.");
  expect(html).toContain('<html lang="en"');

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

  // F-37: the footer sits at the very bottom of a page taller than the emulated phone's viewport,
  // and Chromium's mobile emulation hit-tests a click there against a layout viewport ~96 px taller
  // than the one Playwright measures in, so the click lands on the section above the footer. The
  // keyboard reaches it without coordinates at all — and a footer link has to answer the keyboard.
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
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", /\/home$/);
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
});
