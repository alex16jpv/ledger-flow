import { notFound } from "next/navigation";

import { DevFrame } from "@/components/dev/DevFrame";
import { isEnabled } from "@/lib/flags";

interface FramePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Development-only viewer: Windows browsers refuse windows narrower than ~480 px, so mobile screenshots load the app inside a fixed-width frame.
export default async function DevFramePage({ searchParams }: FramePageProps) {
  if (!isEnabled("componentCatalog")) notFound();
  const params = await searchParams;
  const url = first(params.url) ?? "/home";
  const src = url.startsWith("/") && !url.startsWith("//") ? url : "/home";
  return (
    <main className="grid min-h-dvh place-items-start bg-surface-3 p-4">
      <DevFrame
        src={src}
        width={Number(first(params.w) ?? 390)}
        height={Number(first(params.h) ?? 844)}
        mode={first(params.mode)}
        palette={first(params.palette)}
      />
    </main>
  );
}
