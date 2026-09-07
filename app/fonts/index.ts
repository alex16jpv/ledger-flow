import localFont from "next/font/local";

export const geistSans = localFont({
  src: "./Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  preload: true,
});

export const geistMono = localFont({
  src: "./GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
});
