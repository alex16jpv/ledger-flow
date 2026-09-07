import { expect, test } from "@playwright/test";

const CATALOG = "/en/dev/ui";
const SPINNER = ".animate-spin";
const SKELETON = '[class*="animate-[shimmer"]';

const seconds = (value: string) => Number.parseFloat(value);

test("with reduced motion every transition and animation of the catalog is off", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(CATALOG);

  const button = page.getByRole("button", { name: "Field" }).first();
  await expect(button).toBeVisible();
  expect(
    seconds(await button.evaluate((node) => getComputedStyle(node).transitionDuration)),
  ).toBeLessThanOrEqual(0.001);

  const spinner = page.locator(SPINNER).first();
  await expect(spinner).toBeAttached();
  expect(
    seconds(await spinner.evaluate((node) => getComputedStyle(node).animationDuration)),
  ).toBeLessThanOrEqual(0.001);

  const skeleton = page.locator(SKELETON).first();
  await expect(skeleton).toBeAttached();
  expect(await skeleton.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
});

test("without the preference the same elements do move", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(CATALOG);

  const button = page.getByRole("button", { name: "Field" }).first();
  await expect(button).toBeVisible();
  expect(
    seconds(await button.evaluate((node) => getComputedStyle(node).transitionDuration)),
  ).toBeGreaterThan(0);

  const spinner = page.locator(SPINNER).first();
  await expect(spinner).toBeAttached();
  expect(
    seconds(await spinner.evaluate((node) => getComputedStyle(node).animationDuration)),
  ).toBeGreaterThan(0);

  const skeleton = page.locator(SKELETON).first();
  await expect(skeleton).toBeAttached();
  expect(await skeleton.evaluate((node) => getComputedStyle(node).animationName)).toBe("shimmer");
});
