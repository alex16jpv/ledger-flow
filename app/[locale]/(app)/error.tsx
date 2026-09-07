"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { iconProps } from "@/lib/icons/sizes";
import { reportError, requestIdOf } from "@/lib/observability/reporter";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("states.error");
  const tc = useTranslations("common");
  // API failures were already reported by the client with their requestId; only render errors are new here.
  useEffect(() => {
    if (!requestIdOf(error)) reportError(error, "boundary");
  }, [error]);
  return (
    <Card className="mt-6">
      <Empty
        tone="danger"
        icon={<CircleAlert {...iconProps("lg")} />}
        title={t("title")}
        body={<LoadErrorBody error={error} />}
        action={
          <Button variant="secondary" onClick={reset}>
            {tc("retry")}
          </Button>
        }
      />
    </Card>
  );
}
