import { APP_PREFIXES } from "@/lib/auth/routes";

import robots from "./robots";

describe("robots.txt", () => {
  const [rule] = [robots().rules].flat();

  it("keeps every screen of the app out, in both languages", () => {
    for (const prefix of APP_PREFIXES) {
      expect(rule?.disallow).toContain(prefix);
      expect(rule?.disallow).toContain(`/es${prefix}`);
    }
    expect(rule?.disallow).toEqual(expect.arrayContaining(["/api/", "/dev/", "/es/dev/"]));
  });

  it("lets crawlers into the public pages, the sign-in included so its noindex is read", () => {
    expect(rule?.allow).toEqual(
      expect.arrayContaining(["/", "/es", "/privacy", "/es/terms", "/login", "/es/register"]),
    );
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
