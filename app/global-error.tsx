"use client";

import "./globals.css";

import { useEffect } from "react";

import { reportError } from "@/lib/observability/reporter";
import { DEFAULT_PALETTE } from "@/lib/theme";

// Rendered only when the root layout itself failed, so no providers or messages are available here.
const COPY = {
  en: {
    title: "Something went wrong",
    body: "The page could not load. Your data is safe.",
    retry: "Try again",
  },
  es: {
    title: "Algo salió mal",
    body: "La página no pudo cargar. Tus datos están a salvo.",
    retry: "Reintentar",
  },
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, "boundary");
  }, [error]);
  const lang =
    typeof document !== "undefined" && document.documentElement.lang === "es" ? "es" : "en";
  const copy = COPY[lang];
  return (
    <html lang={lang} data-palette={DEFAULT_PALETTE}>
      <body className="bg-bg text-text">
        <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col items-center justify-center gap-3 px-4 text-center">
          <h1 className="text-xl font-semibold">{copy.title}</h1>
          <p className="text-text-2">{copy.body}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 rounded-full bg-brand px-5 py-2 font-medium text-on-brand"
          >
            {copy.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
