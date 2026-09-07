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
