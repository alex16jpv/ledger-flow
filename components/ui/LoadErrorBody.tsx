import { useTranslations } from "next-intl";

import { presentError } from "@/lib/api/errors";
import { requestIdOf } from "@/lib/observability/reporter";

// Every failed screen shows the request reference so support can follow it through BFF and backend logs.
export function LoadErrorBody({ error }: { error: unknown }) {
  const t = useTranslations();
  const requestId = requestIdOf(error);
  return (
    <>
      {t(presentError(error).messageKey)}
      {requestId && (
        <span className="mt-1 block font-mono text-xs text-text-3">
          {t("states.error.reference", { requestId })}
        </span>
      )}
    </>
  );
}
