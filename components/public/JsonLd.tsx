import { headers } from "next/headers";

import { landingGraph, type LandingGraphInput } from "@/lib/seo";

export type JsonLdProps = LandingGraphInput;

export async function JsonLd({ locale, description, features, questions }: JsonLdProps) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const graph = landingGraph({ locale, description, features, questions });
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // JSON.stringify output is data we built ourselves; the nonce satisfies the CSP.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }}
    />
  );
}
