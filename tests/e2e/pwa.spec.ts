import { expect, test, uniqueEmail } from "../fixtures";
import { SW_PATH } from "../sw-path";

test("the app is installable: manifest, icons and the service worker are served", async ({
  request,
}) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const body = (await manifest.json()) as {
    id: string;
    name: string;
    display: string;
    icons: { src: string; purpose: string }[];
    shortcuts: { url: string }[];
  };
  expect(body.id).toBe("/");
  expect(body.name).toBe("Ledger Flow");
  expect(body.display).toBe("standalone");
  expect(body.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  expect(body.shortcuts[0]?.url).toBe("/transactions/new");

  for (const path of ["/icon-192.png", "/icon-512.png?maskable=1", "/apple-icon", "/icon"]) {
    const icon = await request.get(path);
    expect(icon.status(), path).toBe(200);
    expect(icon.headers()["content-type"], path).toContain("image/png");
  }

  const html = await (await request.get("/")).text();
  expect(html).toContain('rel="manifest"');
  expect(html).toContain('rel="apple-touch-icon"');

  const worker = await request.get(SW_PATH);
  expect(worker.status()).toBe(200);
  expect(await worker.text()).toContain("precache");
});

// The browser fires `beforeinstallprompt` on the landing screen, long before Settings mounts.
test("an install offer made before Settings opens is still there when it does", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("install");
  const registered = await request.post("/api/auth/register", {
    headers: { origin: process.env.E2E_APP_URL ?? "http://localhost:3002" },
    data: { name: "Install E2E", email, password: "LedgerFlow!2026", locale: "en" },
  });
  expect(registered.ok(), await registered.text()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);

  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  // Chromium only fires the real event under its own heuristics, so the shape is faked here.
  const notPrevented = await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    event.prompt = () => Promise.resolve();
    event.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(event);
    // Not cancelled on purpose: the browser's own invitation has to survive (owner, 2026-09-08).
    return !event.defaultPrevented;
  });
  expect(notPrevented).toBe(true);

  await page.getByRole("link", { name: "Settings" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.getByText("Install app", { exact: true })).toBeVisible();
});

// T-197: from Samsung Internet, Android blocks the installed app as dangerous; from Chrome it does not.
test.describe("in Samsung Internet", () => {
  const offer = () => {
    const counter = window as unknown as { prompts?: number };
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    event.prompt = () => {
      counter.prompts = (counter.prompts ?? 0) + 1;
      return Promise.resolve();
    };
    event.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(event);
  };

  test.use({
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Safari/537.36",
  });

  test("the install goes through Chrome, and Samsung's own prompt stays one tap away", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("samsung");
    const registered = await request.post("/api/auth/register", {
      headers: { origin: process.env.E2E_APP_URL ?? "http://localhost:3002" },
      data: { name: "Samsung E2E", email, password: "LedgerFlow!2026", locale: "en" },
    });
    expect(registered.ok(), await registered.text()).toBe(true);
    await page.context().addCookies((await request.storageState()).cookies);

    const chrome = page.getByRole("link", { name: "Install with Chrome" });
    await page.goto("/home");
    // The card waits for the device's first full copy, which Home reads once as it mounts.
    await expect(async () => {
      await page.reload();
      await expect(chrome).toBeVisible({ timeout: 2_000 });
    }).toPass();
    await page.evaluate(offer);

    const here = new URL(page.url());
    const scheme = here.protocol.replace(":", "");
    expect(await chrome.getAttribute("href")).toBe(
      `intent://${here.host}${here.pathname}#Intent;scheme=${scheme};package=com.android.chrome;` +
        `S.browser_fallback_url=${encodeURIComponent(`${scheme}://${here.host}${here.pathname}`)};end`,
    );
    await expect(page.getByRole("button", { name: "Install", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Install it here" }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { prompts?: number }).prompts))
      .toBe(1);
    await page.evaluate(offer);

    await page.getByRole("link", { name: "Settings" }).first().click();
    await page.getByText("Install app", { exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Install this app" });
    await expect(sheet.getByRole("link", { name: "Install with Chrome" })).toBeVisible();
    await sheet.getByRole("button", { name: "Install it here" }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { prompts?: number }).prompts))
      .toBe(2);
  });
});

// Fixing the scale in the served HTML fails WCAG 1.4.4, and iOS ignores it in Safari anyway.
test("the served document keeps its zoom and hands the block to the installed app", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  const served = /<meta name="viewport" content="([^"]*)"/.exec(html)?.[1] ?? "";
  expect(served).toContain("width=device-width");
  expect(served).not.toContain("user-scalable");
  expect(served).not.toContain("maximum-scale");
  expect(html).toContain('src="/viewport-init.js"');

  const script = await request.get("/viewport-init.js");
  expect(script.status()).toBe(200);
  expect(script.headers()["content-type"]).toContain("javascript");
  const source = await script.text();
  expect(source).toContain("(display-mode: standalone)");
  expect(source).toContain("user-scalable=no");
});

// The standalone branch cannot run here: `display-mode` is not an emulated media feature.
test("the head script leaves a browser page scalable once it has run", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("script[src='/viewport-init.js']")).toHaveCount(1);

  await expect
    .poll(() => page.locator("meta[name=viewport]").getAttribute("content"))
    .not.toContain("user-scalable");
});
