import { expect, test } from "@playwright/test";

import { SW_PATH } from "../sw-path";

test("the app is installable: manifest, icons and the service worker are served", async ({
  request,
}) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const body = (await manifest.json()) as {
    name: string;
    display: string;
    icons: { src: string; purpose: string }[];
    shortcuts: { url: string }[];
  };
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

// The owner hit this in production: the browser fires `beforeinstallprompt` on the screen the user
// landed on, and Settings mounts long after, so the Install row never appeared. The event is
// captured in the head now, so arriving at Settings later still finds it.
test("an install offer made before Settings opens is still there when it does", async ({
  page,
  request,
}) => {
  const email = `e2e-install-${Date.now()}-${Math.random().toString(16).slice(2)}@ledgerflow.test`;
  await request.post("/api/auth/register", {
    headers: { origin: process.env.E2E_APP_URL ?? "http://localhost:3002" },
    data: { name: "Install E2E", email, password: "LedgerFlow!2026", locale: "en" },
  });
  await page.context().addCookies((await request.storageState()).cookies);

  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  // Chromium only fires the real event under its own heuristics, so the event is the browser's
  // shape and the capture path is the app's.
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
