import { publicMetadata, publicUrl } from "./seo";

describe("public SEO helpers", () => {
  it("builds locale-prefixed absolute urls from the app url", () => {
    expect(publicUrl("/", "en")).toMatch(/^https?:\/\/[^/]+\/$/);
    expect(publicUrl("/", "es")).toMatch(/\/es$/);
    expect(publicUrl("/privacy", "es")).toMatch(/\/es\/privacy$/);
  });

  it("sets canonical, hreflang for both locales plus x-default and Open Graph", () => {
    const meta = publicMetadata("/privacy", "es", {
      title: "Privacidad",
      description: "Qué guardamos.",
    });
    expect(meta.alternates?.canonical).toMatch(/\/es\/privacy$/);
    const languages = meta.alternates?.languages as Record<string, string>;
    expect(Object.keys(languages).sort()).toEqual(["en", "es", "x-default"]);
    expect(languages["x-default"]).toMatch(/\/privacy$/);
    expect(meta.openGraph).toMatchObject({ locale: "es_CO", siteName: "Ledger Flow" });
  });
});
