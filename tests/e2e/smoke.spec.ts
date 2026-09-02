import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the root page responds and has no accessibility violations", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
