"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { iconProps } from "@/lib/icons/sizes";

export default function PublicError({ reset }: { reset: () => void }) {
  const t = useTranslations("public.error");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] items-center px-4">
      <Empty
        tone="danger"
        icon={<CircleAlert {...iconProps("lg")} />}
        title={t("title")}
        body={t("body")}
        action={<Button onClick={reset}>{t("retry")}</Button>}
        className="w-full"
      />
    </main>
  );
}
