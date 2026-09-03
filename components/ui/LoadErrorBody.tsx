import { useTranslations } from "next-intl";

import { requestIdOf } from "@/lib/observability/reporter";

// Every failed screen shows the request reference so support can follow it through BFF and backend logs.
export function LoadErrorBody({ error }: { error: unknown }) {
  const t = useTranslations("states.error");
  const requestId = requestIdOf(error);
  return (
    <>
      {t("body")}
      {requestId && (
        <span className="mt-1 block font-mono text-xs text-text-3">
          {t("reference", { requestId })}
        </span>
      )}
    </>
  );
}
