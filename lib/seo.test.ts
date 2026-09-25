import {
  INDEXED_PATHS,
  landingGraph,
  ogImageUrl,
  publicLanguages,
  publicMetadata,
  publicUrl,
} from "./seo";

const page = { title: "Privacidad", description: "Qué guardamos.", imageAlt: "Ledger Flow" };

describe("public SEO helpers", () => {
  it("builds locale-prefixed absolute urls from the app url", () => {
    expect(publicUrl("/", "en")).toMatch(/^https?:\/\/[^/]+\/$/);
    expect(publicUrl("/", "es")).toMatch(/\/es$/);
    expect(publicUrl("/privacy", "es")).toMatch(/\/es\/privacy$/);
  });

  it("sets canonical, hreflang for both locales plus x-default and Open Graph", () => {
    const meta = publicMetadata("/privacy", "es", page);
    expect(meta.alternates?.canonical).toMatch(/\/es\/privacy$/);
    const languages = meta.alternates?.languages as Record<string, string>;
    expect(Object.keys(languages).sort()).toEqual(["en", "es", "x-default"]);
    expect(languages["x-default"]).toMatch(/\/privacy$/);
    expect(meta.openGraph).toMatchObject({ locale: "es_CO", siteName: "Ledger Flow" });
    expect(meta.robots).toBeUndefined();
  });

  it("gives every page the image of its locale on the prefixed route, and the brand in the social title", () => {
    const meta = publicMetadata("/privacy", "en", page);
    const image = { url: ogImageUrl("en"), width: 1200, height: 630, alt: "Ledger Flow" };
    expect(ogImageUrl("en")).toMatch(/\/en\/opengraph-image$/);
    expect(meta.openGraph).toMatchObject({ title: "Privacidad · Ledger Flow", images: [image] });
    expect(meta.twitter).toMatchObject({ title: "Privacidad · Ledger Flow", images: [image] });
    expect(publicMetadata("/", "en", { ...page, absoluteTitle: true }).openGraph?.title).toBe(
      "Privacidad",
    );
  });

  it("keeps the sign-in page out of the index, its links followed and no alternates claimed", () => {
    const meta = publicMetadata("/login", "en", page);
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates).toEqual({ canonical: publicUrl("/login", "en") });
    expect(INDEXED_PATHS).toEqual(["/", "/privacy", "/terms", "/register"]);
  });

  it("shares one map of alternates between the head and the sitemap", () => {
    expect(publicLanguages("/terms")).toEqual({
      en: publicUrl("/terms", "en"),
      es: publicUrl("/terms", "es"),
      "x-default": publicUrl("/terms", "en"),
    });
  });

  it("describes the landing as one free web app, and its FAQ with the visible questions", () => {
    const graph = landingGraph({
      locale: "es",
      description: "Controla tus gastos.",
      features: ["Gastos compartidos"],
      questions: [{ question: "¿Es gratis?", answer: "Sí." }],
    });
    const nodes = graph["@graph"];
    expect(nodes.map((node) => node["@type"])).toEqual([
      "Organization",
      "WebSite",
      "WebApplication",
      "FAQPage",
    ]);
    const [organization, website, app, faq] = nodes;
    expect(website).toMatchObject({ name: "Ledger Flow", inLanguage: ["en", "es"] });
    expect(organization).toMatchObject({ logo: expect.stringMatching(/\/icon-512\.png$/) });
    expect(app).toMatchObject({
      url: publicUrl("/", "es"),
      image: ogImageUrl("es"),
      isAccessibleForFree: true,
      featureList: ["Gastos compartidos"],
      offers: { price: "0" },
    });
    expect(faq).toMatchObject({
      "@id": `${publicUrl("/", "es")}#faq`,
      mainEntity: [{ "@type": "Question", name: "¿Es gratis?", acceptedAnswer: { text: "Sí." } }],
    });
  });
});
