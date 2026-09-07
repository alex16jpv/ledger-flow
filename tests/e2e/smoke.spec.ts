import { expect, test } from "@playwright/test";

import { expectNoAxeViolations } from "./axe";

test("the root page responds and has no accessibility violations", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);

  await expectNoAxeViolations(page);
});
