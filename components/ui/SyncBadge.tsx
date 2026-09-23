"use client";

import { CloudOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "./Badge";

export type RowSync = "pending" | "attention";

export function SyncBadge({ sync }: { sync: RowSync }) {
  const t = useTranslations("states");
  return (
    <Badge tone={sync === "attention" ? "danger" : "warning"}>
      <CloudOff aria-hidden="true" />
      {t(sync === "attention" ? "needsAttention" : "pendingSync")}
    </Badge>
  );
}
