import { useTranslations } from "next-intl";

import { NetworkError } from "@/lib/api/errors";
import { requestIdOf } from "@/lib/observability/reporter";

// Every failed screen shows the request reference so support can follow it through BFF and backend logs.
export function LoadErrorBody({ error }: { error: unknown }) {
  const t = useTranslations();
  const requestId = requestIdOf(error);
  // Rule 18: a lost connection is not a server that did not answer, and the line may not say it was.
  const body =
    error instanceof NetworkError
      ? t(error.timedOut ? "errors.TIMEOUT" : "errors.NETWORK")
      : t("states.error.body");
  return (
    <>
      {body}
      {requestId && (
        <span className="mt-1 block font-mono text-xs text-text-3">
          {t("states.error.reference", { requestId })}
        </span>
      )}
    </>
  );
}
