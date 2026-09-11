import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// F-45: Next sets the title after a client navigation, so a scan before it reports document-title.
export async function expectNoAxeViolations(page: Page): Promise<void> {
  await expect.poll(() => page.title(), { timeout: 15_000 }).not.toBe("");
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
}
