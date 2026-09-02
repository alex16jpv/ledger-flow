import { expect, test } from "@playwright/test";

test("English has no prefix and sets <html lang>", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "See where your money actually goes.",
  );
  await expect(page.locator("main p").first()).toContainText("three seconds");
});

test("Spanish lives under /es", async ({ page }) => {
  await page.goto("/es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("main p").first()).toContainText("tres segundos");
});

test("the locale cookie wins over Accept-Language", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-US" });
  await context.addCookies([{ name: "lf_locale", value: "es", domain: "localhost", path: "/" }]);
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/es$/);
  await context.close();
});
