import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ledger Flow",
  description:
    "A tool to help you manage your finances and keep track of your expenses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
