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
});

test("sign out clears the session and returns to login", async ({ page, request }) => {
  await signedInPage(page, request);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  const home = await page.goto("/home");
  expect(home?.url()).toContain("/login");
});
