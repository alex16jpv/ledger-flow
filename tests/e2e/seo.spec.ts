import { expect, test } from "@playwright/test";

test("robots, sitemap, canonical, hreflang, JSON-LD and the OG image are served", async ({
  request,
}) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /api/");
  expect(robots).toContain("Allow: /privacy");
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/es/privacy");
  expect(sitemap).toContain("/terms");
  expect(sitemap).not.toContain("/home");

  const html = await (await request.get("/")).text();
  expect(html).toMatch(/<link rel="canonical" href="[^"]+"/);
  expect(html).toMatch(/hreflang="es" href="[^"]+\/es"/i);
  expect(html).toMatch(/hreflang="x-default"/i);
  expect(html).toContain("application/ld+json");
  expect(html).toContain('"SoftwareApplication"');
  expect(html).toMatch(/property="og:title" content="Ledger Flow/);

  const es = await (await request.get("/es/privacy")).text();
  expect(es).toMatch(/<link rel="canonical" href="[^"]+\/es\/privacy"/);
  expect(es).toContain('<html lang="es"');

  const og = await request.get("/opengraph-image");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");
});

test("authenticated routes carry X-Robots-Tag noindex", async ({ request }) => {
  const home = await request.get("/home", { maxRedirects: 0 });
  expect(home.headers()["x-robots-tag"]).toContain("noindex");
  const landing = await request.get("/", { maxRedirects: 0 });
  expect(landing.headers()["x-robots-tag"]).toBeUndefined();
});
