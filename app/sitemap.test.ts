import { publicUrl } from "@/lib/seo";

import sitemap from "./sitemap";

describe("sitemap.xml", () => {
  const entries = sitemap();

  it("lists every indexed page once per language, never the sign-in", () => {
    expect(entries.map(({ url }) => url)).toEqual([
      publicUrl("/", "en"),
      publicUrl("/", "es"),
      publicUrl("/privacy", "en"),
      publicUrl("/privacy", "es"),
      publicUrl("/terms", "en"),
      publicUrl("/terms", "es"),
      publicUrl("/register", "en"),
      publicUrl("/register", "es"),
    ]);
  });

  it("gives each entry its alternates with x-default and no invented date", () => {
    for (const entry of entries) {
      expect(Object.keys(entry.alternates?.languages ?? {}).sort()).toEqual([
        "en",
        "es",
        "x-default",
      ]);
      expect(entry.lastModified).toBeUndefined();
    }
  });
});
