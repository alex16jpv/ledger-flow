import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// F-45: Next sets the document's title after a client navigation, so a scan that starts before that
// lands sees a document with no `<title>` and reports `document-title` on a page that has one a
// moment later. Under eight workers that window is wide enough to hit regularly — measured on
// `budgets.spec.ts` (three of three) and `stats.spec.ts`. Waiting for the title is waiting for the
// navigation the test is judging to be the one on screen.
export async function expectNoAxeViolations(page: Page): Promise<void> {
  await expect.poll(() => page.title(), { timeout: 15_000 }).not.toBe("");
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
}
