import { headers } from "next/headers";

import { env } from "@/lib/env";

export interface JsonLdProps {
  locale: string;
  name: string;
  description: string;
}

// Structured data for the landing only: Organization + WebSite + SoftwareApplication (free, FinanceApplication).
export async function JsonLd({ locale, name, description }: JsonLdProps) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const base = env.NEXT_PUBLIC_APP_URL;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}#organization`,
        name,
        url: base,
        email: env.NEXT_PUBLIC_CONTACT_EMAIL,
      },
      {
        "@type": "WebSite",
        "@id": `${base}#website`,
        url: base,
        name,
        inLanguage: locale,
        publisher: { "@id": `${base}#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name,
        description,
        url: base,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        inLanguage: ["en", "es"],
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": `${base}#organization` },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // JSON.stringify output is data we built ourselves; the nonce satisfies the CSP.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }}
    />
  );
}
