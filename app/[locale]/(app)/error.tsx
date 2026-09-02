"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { iconProps } from "@/lib/icons/sizes";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("states.error");
  const tc = useTranslations("common");
  const requestId =
    error instanceof ApiError || error instanceof NetworkError ? error.requestId : null;
  return (
    <Card className="mt-6">
      <Empty
        tone="danger"
        icon={<CircleAlert {...iconProps("lg")} />}
        title={t("title")}
        body={
          <>
            {t("body")}
            {requestId && (
              <span className="mt-1 block font-mono text-xs text-text-3">
                {t("reference", { requestId })}
              </span>
            )}
          </>
        }
        action={
          <Button variant="secondary" onClick={reset}>
            {tc("retry")}
          </Button>
        }
      />
    </Card>
  );
}
