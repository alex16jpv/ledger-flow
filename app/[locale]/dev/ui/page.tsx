import { notFound } from "next/navigation";
import { Suspense } from "react";

import { UiCatalog } from "@/components/dev/UiCatalog";
import { isEnabled } from "@/lib/flags";

export default function UiCatalogPage() {
  if (!isEnabled("componentCatalog")) notFound();
  return (
    <Suspense>
      <UiCatalog />
    </Suspense>
  );
}
