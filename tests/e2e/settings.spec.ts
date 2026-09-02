import { expect, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";

async function signedInPage(
  page: Parameters<Parameters<typeof test>[2]>[0]["page"],
  request: Parameters<Parameters<typeof test>[2]>[0]["request"],
) {
  const email = `e2e-settings-${Date.now()}-${Math.random().toString(16).slice(2)}@ledgerflow.test`;
  await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Settings E2E", email, password: "LedgerFlow!2026", locale: "en" },
  });
  await page.context().addCookies((await request.storageState()).cookies);
}

test("theme changes apply without reload and survive one", async ({ page, request }) => {
  await signedInPage(page, request);
  await page.goto("/settings/appearance");
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await page.getByRole("button", { name: /Brisa/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "brisa");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-palette", "brisa");
});

test("switching the language moves to /es, persists on reload and is stored on the user", async ({
  page,
  request,
}) => {
  await signedInPage(page, request);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto("/settings");
  await page.getByRole("button", { name: /^Language/ }).click();
  await expect(page.getByRole("option", { name: /Español/ })).toBeEnabled();
  await page.getByRole("option", { name: /Español/ }).click();
  await expect(page).toHaveURL(`${APP}/es/settings`, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ajustes");
  await page.goto("/");
  await expect(page).toHaveURL(/\/es(\/|$)/);
  const me = (await (await request.get("/api/auth/me")).json()) as { user: { locale: string } };
  expect(me.user.locale).toBe("es");
  expect(consoleErrors).toEqual([]);
});

test("sign out clears the session and returns to login", async ({ page, request }) => {
  await signedInPage(page, request);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  const home = await page.goto("/home");
  expect(home?.url()).toContain("/login");
});

// W-30: profile, currency, time zone, sessions and account deletion on a throwaway user.
test("a new user edits the profile, changes currency and time zone, reviews sessions and deletes the account", async ({
  page,
  request,
}) => {
  const email = `e2e-settings-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ledgerflow.test`;
  const password = "LedgerFlow!2026";
  const registered = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Settings E2E", email, password },
  });
  expect(registered.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);

  await page.goto("/settings");
  await expect(page.getByText("Your data", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy policy" })).toHaveAttribute(
    "href",
    /\/privacy$/,
  );
  await page.getByRole("button", { name: /^Currency/ }).click();
  const currency = page.getByRole("dialog", { name: "Currency" });
  await currency.getByRole("button", { name: /[A-Z]{3} · / }).click();
  await page.getByRole("searchbox", { name: "Search" }).fill("USD");
  await page.getByRole("option", { name: /USD/ }).click();
  await currency.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Currency updated")).toBeVisible();
  await expect(page.getByText("USD", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: /^Time zone/ }).click();
  const zone = page.getByRole("dialog", { name: "Time zone" });
  await zone.getByRole("button", { name: /America|Europe|Asia|UTC/ }).click();
  await page.getByRole("searchbox", { name: "Search" }).fill("Madrid");
  await page.getByRole("option", { name: /Madrid/ }).click();
  await zone.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Time zone updated")).toBeVisible();
  await expect(page.getByText("Madrid").first()).toBeVisible();

  await page.getByRole("link", { name: /Password & email/ }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await page.getByRole("textbox", { name: "Name" }).fill("Settings Renamed");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile updated", { exact: true })).toBeVisible();
  await page.getByLabel(/^New password/).fill("Another!2026");
  await page.getByLabel("Current password").fill(password);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Your other devices were signed out/)).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("Settings Renamed").locator("visible=true").first()).toBeVisible();

  await page.getByRole("link", { name: /Active sessions/ }).click();
  await expect(page).toHaveURL(/\/settings\/sessions$/);
  await expect(page.getByRole("button", { name: /^Sign out .+/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();

  await page.getByRole("button", { name: "Delete my account" }).click();
  const remove = page.getByRole("dialog", { name: "Delete my account" });
  await expect(remove.getByRole("button", { name: "Delete account" })).toBeDisabled();
  await remove.getByRole("textbox").fill("DELETE");
  await remove.getByRole("button", { name: "Delete account" }).click();
  await expect(page).toHaveURL(/\/login\?deleted=1$/);
  await expect(page.getByText(/Your account was deleted/)).toBeVisible();
});
