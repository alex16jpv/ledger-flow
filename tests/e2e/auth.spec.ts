import { expect, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";

test("protected routes redirect guests to the localized login with a next parameter", async ({
  request,
}) => {
  const en = await request.get("/settings", { maxRedirects: 0 });
  expect(en.status()).toBe(307);
  expect(new URL(en.headers().location ?? "", APP).href).toBe(`${APP}/login?next=%2Fsettings`);
  const es = await request.get("/es/settings", { maxRedirects: 0 });
  expect(new URL(es.headers().location ?? "", APP).href).toBe(`${APP}/es/login?next=%2Fsettings`);
});

test("the BFF refuses cross-origin session calls", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    headers: { origin: "https://evil.example", "content-type": "application/json" },
    data: { email: "a@b.co", password: "12345678" },
  });
  expect(response.status()).toBe(403);
});

test("register sets httpOnly session cookies, refresh rotates them and logout clears everything", async ({
  request,
}) => {
  const email = `e2e-${Date.now()}@ledgerflow.test`;
  const register = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "E2E", email, password: "LedgerFlow!2026", locale: "en" },
  });
  expect(register.status()).toBe(201);
  const body = (await register.json()) as { user: { email: string }; accessToken?: string };
  expect(body.user.email).toBe(email);
  expect(body.accessToken).toBeUndefined();

  const cookies = register
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);
  expect(cookies.some((c) => c.startsWith("__Host-access=") && /HttpOnly/i.test(c))).toBe(true);
  expect(
    cookies.some((c) => c.startsWith("__Secure-refresh=") && /Path=\/api\/auth/i.test(c)),
  ).toBe(true);
  expect(cookies.some((c) => c.startsWith("__Host-session=") && /SameSite=lax/i.test(c))).toBe(
    true,
  );

  const me = await request.get("/api/auth/me");
  expect(me.ok()).toBe(true);

  const refresh = await request.post("/api/auth/refresh", { headers: { origin: APP } });
  expect(refresh.ok()).toBe(true);

  const home = await request.get("/settings", { maxRedirects: 0 });
  expect(home.status()).not.toBe(307);

  const logout = await request.post("/api/auth/logout", { headers: { origin: APP } });
  expect(logout.headers()["clear-site-data"]).toContain("storage");
  const afterLogout = await request.get("/api/auth/me");
  expect(afterLogout.status()).toBe(401);
});

test("the refresh cookie never travels to pages", async ({ page, request }) => {
  const email = `e2e-${Date.now()}-b@ledgerflow.test`;
  await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "E2E", email, password: "LedgerFlow!2026" },
  });
  const state = await request.storageState();
  await page.context().addCookies(state.cookies);
  const [pageRequest] = await Promise.all([
    page.waitForRequest((r) => r.url() === `${APP}/`),
    page.goto("/"),
  ]);
  const cookieHeader = (await pageRequest.allHeaders()).cookie ?? "";
  expect(cookieHeader).toContain("__Host-session=");
  expect(cookieHeader).not.toContain("__Secure-refresh=");
});
