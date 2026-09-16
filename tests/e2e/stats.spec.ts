import { expect, type Page, test } from "../fixtures";
import { expectNoAxeViolations } from "./axe";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

async function signIn(page: Page, request: Request) {
  const response = await request.post("/api/auth/login", { headers: { origin: APP }, data: SEED });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

test("stats show the seed month by category, by day and by tag, and drill into the list", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto("/stats?reference=2026-08");
  await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible();
  await expect(page.getByText("Total spent")).toBeVisible();
  await expect(page.getByText(/\d+ transactions · average/)).toBeVisible();
  await expect(page.getByRole("img", { name: "Share by category" })).toBeVisible();
  const food = page.getByRole("button", { name: /^Food/ });
  await expect(food).toContainText(/\d+ %/);
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Days" }).click();
  await expect(page).toHaveURL(/groupBy=day/);
  const days = page.getByRole("group", { name: "Per day" });
  await expect(days).toBeVisible();
  const line = days.locator("xpath=following-sibling::p[1]");
  await expect(line).toHaveText(/^Highest day · /);
  await days.getByRole("button").nth(8).focus();
  await expect(line).toHaveText(/· \d+ transactions?\n?\$/);
  await expect(page.getByText("Priciest day")).toBeVisible();
  await expect(page.getByRole("heading", { name: /· highest$/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Average by weekday: / })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Biggest this period" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Calendar" }).click();
  const calendar = page.getByRole("group", { name: "Per day" });
  await expect(calendar).toBeVisible();
  await expect(calendar.getByRole("button").first()).toHaveText("1");
  await expect(page.getByText("Less")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.reload();
  await expect(page.getByRole("group", { name: "Per day" }).getByRole("button").first()).toHaveText(
    "1",
  );
  await page.getByRole("button", { name: "Bars" }).click();

  await page.getByRole("button", { name: "Accounts" }).click();
  await expect(page).toHaveURL(/groupBy=account/);
  const bar = page.getByRole("img", { name: /^Share by account: / });
  await expect(bar).toBeVisible();
  const accountRows = page.getByRole("button", { name: /\d+ %/ });
  await expect(accountRows.first()).toContainText(/txns?$/);
  expect(await accountRows.count()).toBeGreaterThan(0);
  await expect(
    page.getByText(/Transfers between your own accounts are not spending/),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Tags" }).click();
  await expect(page).toHaveURL(/groupBy=tag/);
  await expect(page.getByText(/counts in each of them/)).toBeVisible();
  await expect(page.getByRole("button", { name: /#coffee/ })).toBeVisible();

  await page.getByRole("button", { name: "Income" }).click();
  await expect(page).toHaveURL(/type=INCOME/);
  await expect(page.getByText("Total income")).toBeVisible();

  await page.getByRole("button", { name: "Categories" }).click();
  await expect(page).not.toHaveURL(/groupBy=/);
  await page.getByRole("button", { name: "Expenses" }).click();
  await expect(page).not.toHaveURL(/type=/);
  await page.getByRole("button", { name: /^Food/ }).click();
  await expect(page).toHaveURL(
    /\/transactions\?period=custom&from=2026-08-01&to=2026-08-31&type=EXPENSE&category=/,
  );
  await expect(page.getByRole("button", { name: "Expenses", pressed: true })).toBeVisible();
});

// The seed's reference month is the one the sibling test reads, and it carries two months before it.
test("Trends reads the months the seed has, and reads them off the local copy", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto("/stats?reference=2026-08");
  await page.getByRole("link", { name: /Trends over time/ }).click();
  await expect(page).toHaveURL(/\/stats\/trends\?reference=2026-08$/);
  await expect(page.getByRole("heading", { level: 1, name: "Trends" })).toBeVisible();

  // Three months where the range asks for six: the partial case, and the axis starts at the data.
  await expect(page.getByText(/Only 3 months of this range/)).toBeVisible();
  const pairs = page.getByRole("group", { name: "Income against spending, month by month" });
  await expect(pairs).toBeVisible();
  await expect(pairs.getByRole("button")).toHaveCount(3);
  await expect(pairs.getByRole("button").first()).toHaveAccessibleName(/^June 2026 · /);
  await expect(page.getByText("3 complete months")).toBeVisible();
  await expect(page.getByText("of what came in")).toBeVisible();

  // The seed's reference month has ended, so nothing here is "so far" and there is no "this point".
  await expect(
    page.getByRole("img", {
      name: "Spending in August 2026 against the same days of July 2026",
    }),
  ).toBeVisible();
  await expect(page.getByText(/^You spent /)).toBeVisible();
  await expect(page.getByText("August 2026 against July 2026")).toBeVisible();

  // The line reads a day at a time, and the readout is the reading a finger gets.
  const comparison = page.getByRole("img", {
    name: "Spending in August 2026 against the same days of July 2026",
  });
  const readout = comparison.locator("xpath=../following-sibling::p");
  const surface = comparison.locator("xpath=..").locator("span.touch-pan-y");
  const box = await surface.boundingBox();
  if (!box) throw new Error("the comparison chart has no box to point at");
  // August has 31 days and position 0 is the origin of the curves, so day n is n of 31 across.
  const atDay = (day: number) => ({ x: (box.width * day) / 31, y: box.height / 2 });
  await expect(readout).toHaveText(/^Day \d+ · Aug \$[\d,]+ · Jul \$[\d,]+/);

  await surface.hover({ position: atDay(5) });
  await expect(readout).toHaveText(/^Day 5 · Aug \$[\d,]+ · Jul \$[\d,]+/);
  await expect(comparison.locator("path.stroke-border-strong")).toHaveCount(1);
  await surface.hover({ position: atDay(12) });
  await expect(readout).toHaveText(/^Day 12 · Aug \$[\d,]+ · Jul \$[\d,]+/);

  // T-81: a finger is the only pointer a phone has, and it must read the day it lands on.
  if (test.info().project.name === "mobile") {
    await surface.tap({ position: atDay(20) });
    await expect(readout).toHaveText(/^Day 20 · Aug \$[\d,]+ · Jul \$[\d,]+/);
  }

  const mix = page.getByRole("group", { name: "Spending per month, split by category" });
  await expect(mix).toBeVisible();
  await expect(mix.getByRole("button")).toHaveCount(3);
  await expectNoAxeViolations(page);

  // Rule 24: the session and the sync feed are the shell's; this screen asks for nothing on a reload.
  const shell = new Set(["/api/auth/me", "/api/sync/changes"]);
  const reads: string[] = [];
  page.on("request", (sent) => {
    const { pathname } = new URL(sent.url());
    if (pathname.startsWith("/api/") && !shell.has(pathname)) reads.push(pathname);
  });
  await page.reload();
  await expect(pairs).toBeVisible();
  expect(reads).toEqual([]);

  // A pair is a control: it opens Stats on the month it names — where the pointer hovers (T-80).
  const canHover = await page.evaluate(() => !window.matchMedia("(hover: none)").matches);
  expect(canHover).toBe(test.info().project.name === "desktop");
  const june = pairs.getByRole("button").first();
  await june.click();
  if (canHover) {
    await expect(page).toHaveURL(/\/stats\?reference=2026-06$/);
  } else {
    await expect(page).toHaveURL(/\/stats\/trends\?reference=2026-08$/);
    await expect(june).toBeFocused();
    await expect(pairs.locator("xpath=following-sibling::p[1]")).toHaveText(/June 2026/);
  }
});

test("the way into Trends is in the header on every view, and the columns only split where they fit", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  const header = page.getByRole("link", { name: "Trends", exact: true });
  for (const view of ["category", "day", "account", "tag"]) {
    await page.goto(`/stats?reference=2026-08&groupBy=${view}`);
    await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible();
    await expect(header).toHaveAttribute("href", /\/stats\/trends\?reference=2026-08$/);
    await expect(page.getByRole("region", { name: "More about this month" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Other months" })).toBeVisible();
  }

  // An empty period keeps both ways in; a failed read keeps only the header's.
  await page.goto("/stats?reference=2019-01");
  await expect(page.getByText("Nothing recorded in this period")).toBeVisible();
  await expect(header).toBeVisible();
  await expect(page.getByRole("link", { name: /Trends over time/ })).toBeVisible();
  await expectNoAxeViolations(page);

  if (test.info().project.name !== "desktop") {
    // The header label is longer in Spanish, and the page title may not pay for it.
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/es/stats?reference=2026-08");
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveText("Estadísticas");
    const clipped = await title.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(clipped, "the page title is cut off at 320px in Spanish").toBe(false);
    return;
  }
  // T-82: the split waits for 1200px. Below it the answer column would be narrower than a phone,
  // so every width has to fit what it draws — nothing may overflow its card.
  await page.goto("/stats?reference=2026-08&groupBy=day");
  const card = page
    .getByText("Per day")
    .locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
  for (const width of [900, 1000, 1100, 1199, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("region", { name: "Other months" })).toBeVisible();
    const fits = await card.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits, `the day chart overflows its card at ${width}px`).toBe(true);
    const rail = await page
      .getByRole("region", { name: "Other months" })
      .evaluate((el) => el.getBoundingClientRect().left);
    const answer = await page
      .getByText("Total spent")
      .evaluate((el) => el.getBoundingClientRect().left);
    // Two columns put the rail beside the answer; one column puts it under, at the same left edge.
    expect(rail > answer, `columns at ${width}px`).toBe(width >= 1200);
  }
});
