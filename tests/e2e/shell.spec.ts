import { expect, test, uniqueEmail } from "../fixtures";
import { expectNoAxeViolations } from "./axe";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";

async function signUp(
  request: Parameters<Parameters<typeof test>[2]>[0]["request"],
  name = "John Doe",
) {
  const email = uniqueEmail("shell");
  const response = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name, email, password: "LedgerFlow!2026", locale: "en" },
  });
  expect(response.status()).toBe(201);
}

test("the app shell shows navigation, greeting and passes axe", async ({ page, request }) => {
  await signUp(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, John");
  await expect(page.getByRole("navigation", { name: "Navigation" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" }).first()).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expectNoAxeViolations(page);
});

// T-72: below 900px Stats and Categories had no way in at all; More is the only door there is.
test("the phone reaches Stats, Categories and Accounts through More", async ({
  page,
  request,
  isMobile,
}) => {
  test.skip(!isMobile, "the tab bar only exists below 900px");
  await signUp(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/home");

  const more = page.getByRole("button", { name: "More", exact: true });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  const sheet = page.getByRole("dialog", { name: "More" });
  await expect(sheet).toBeVisible();
  await expectNoAxeViolations(page);
  for (const name of ["Accounts", "Stats", "Categories", "Settings"]) {
    await expect(sheet.getByRole("link", { name })).toBeVisible();
  }

  await sheet.getByRole("link", { name: "Stats" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible();
  await expect(sheet).toBeHidden();
});

// T-148: Android draws the installed app under its navigation bar and reports the bar as the bottom safe area.
test("the tab bar clears the system navigation bar", async ({ page, request, isMobile }) => {
  test.skip(!isMobile, "the tab bar only exists below 900px");
  const systemBar = 48;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { bottom: systemBar } });
  await signUp(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/home");

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("the mobile project always sets a viewport");
  const nav = page.getByRole("navigation", { name: "Navigation" }).last();
  const navBox = await nav.boundingBox();
  expect(navBox && Math.round(navBox.y + navBox.height)).toBe(viewport.height);

  const tabs = [
    page.getByRole("link", { name: "Home" }).last(),
    page.getByRole("link", { name: "Transactions" }).last(),
    page.getByRole("button", { name: "Add", exact: true }).last(),
    page.getByRole("link", { name: "Budgets" }).last(),
    page.getByRole("button", { name: "More", exact: true }),
  ];
  for (const tab of tabs) {
    const box = await tab.boundingBox();
    expect(box).not.toBeNull();
    if (box) expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - systemBar);
  }

  await page.getByRole("link", { name: "Transactions" }).last().click();
  await expect(page).toHaveURL(/\/transactions$/);
});

// T-150: which of the two forms a phone sheet takes is geometry, and jsdom has none.
test("on a phone a form fills the screen with its action on top, and a short sheet is centred", async ({
  page,
  request,
  isMobile,
}) => {
  test.skip(!isMobile, "both forms are the centred modal from 600px up");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 24, bottom: 48 } });
  await signUp(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/home");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("the mobile project always sets a viewport");

  await page.getByRole("button", { name: "Add", exact: true }).click();
  const quick = page.getByRole("dialog", { name: "Add" });
  const title = quick.getByRole("heading", { name: "Add" });
  const panel = title.locator("xpath=../..");
  expect(await panel.boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
  });
  expect(await panel.evaluate((node) => getComputedStyle(node).paddingTop)).toBe("24px");
  const bar = await title.locator("..").boundingBox();
  const save = await quick.getByRole("button", { name: "Save" }).boundingBox();
  expect(bar && save && save.y >= bar.y && save.y + save.height <= bar.y + bar.height).toBe(true);
  await expect(quick.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  await expectNoAxeViolations(page);
  await quick.getByRole("button", { name: "Close" }).click();
  await expect(quick).toBeHidden();

  await page.goto("/budgets");
  await page.getByRole("button", { name: "Create a monthly budget" }).click();
  const ceiling = page.getByRole("dialog", { name: "A ceiling for the month" });
  const card = await ceiling
    .getByRole("heading", { name: "A ceiling for the month" })
    .locator("xpath=../..")
    .boundingBox();
  expect(card).not.toBeNull();
  if (!card) return;
  expect(Math.round(card.x)).toBe(16);
  expect(Math.round(card.x + card.width)).toBe(viewport.width - 16);
  expect(Math.abs(card.y + card.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
});

test("the sign-in frame ends above the system navigation bar", async ({ page, isMobile }) => {
  test.skip(!isMobile, "only a phone draws under a system bar");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { bottom: 48 } });
  await page.goto("/login");
  const padding = await page
    .locator("main")
    .evaluate((main) => getComputedStyle(main).paddingBottom);
  expect(padding).toBe("48px");
});

test("unknown routes answer a real 404", async ({ page, request }) => {
  await signUp(request);
  await page.context().addCookies((await request.storageState()).cookies);
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});

test("the app segment is noindex", async ({ page, request }) => {
  await signUp(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/home");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
