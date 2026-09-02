import type { MetadataRoute } from "next";

// Colors are the Brisa light tokens as hex: the manifest cannot read CSS variables.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ledger Flow",
    short_name: "Ledger Flow",
    description: "Catch your small daily spending in three seconds and see where the month goes.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2f7fb",
    theme_color: "#0c6b62",
    lang: "en",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png?maskable=1", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Add expense",
        short_name: "Add",
        url: "/transactions/new",
        description: "Log an expense",
      },
    ],
  };
}
