import { expect, type Locator, test } from "@playwright/test";

const CATALOG = "/en/dev/ui";
const SPINNER = ".animate-spin";
const SKELETON = '[class*="animate-[shimmer"]';

type Duration = "animationDuration" | "transitionDuration";

// Computed styles come back empty while the element is still being painted, so the reading is polled.
async function durationOf(locator: Locator, property: Duration): Promise<number> {
  await expect(locator).toBeVisible();
  let value = Number.NaN;
  await expect
    .poll(async () => {
      value = Number.parseFloat(
        await locator.evaluate((node, name) => getComputedStyle(node)[name], property),
      );
      return Number.isNaN(value);
    })
    .toBe(false);
  return value;
}

test("with reduced motion every transition and animation of the catalog is off", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(CATALOG);

  const button = page.getByRole("button", { name: "Field" }).first();
  expect(await durationOf(button, "transitionDuration")).toBeLessThanOrEqual(0.001);

  const spinner = page.locator(SPINNER).first();
  expect(await durationOf(spinner, "animationDuration")).toBeLessThanOrEqual(0.001);

  const skeleton = page.locator(SKELETON).first();
  await expect(skeleton).toBeVisible();
  expect(await skeleton.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");

  // F-74: a spinner that cannot spin is a broken arc, so the ring closes instead.
  const ring = await spinner.evaluate((node) => {
    const style = getComputedStyle(node);
    return [style.borderTopColor, style.borderRightColor, style.borderLeftColor];
  });
  expect(new Set(ring).size).toBe(1);
});

test("without the preference the same elements do move", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(CATALOG);

  const button = page.getByRole("button", { name: "Field" }).first();
  expect(await durationOf(button, "transitionDuration")).toBeGreaterThan(0);

  const spinner = page.locator(SPINNER).first();
  expect(await durationOf(spinner, "animationDuration")).toBeGreaterThan(0);

  const skeleton = page.locator(SKELETON).first();
  await expect(skeleton).toBeVisible();
  expect(await skeleton.evaluate((node) => getComputedStyle(node).animationName)).toBe("shimmer");

  const ring = await spinner.evaluate((node) => {
    const style = getComputedStyle(node);
    return [style.borderTopColor, style.borderRightColor];
  });
  expect(ring[0]).not.toBe(ring[1]);
});
