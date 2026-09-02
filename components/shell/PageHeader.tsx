"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { iconProps } from "@/lib/icons/sizes";

interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  className?: string;
}

export function PageHeader({ title, eyebrow, actions, onBack, className }: PageHeaderProps) {
  const t = useTranslations("common");
  if (onBack) {
    return (
      <header
        className={cn("flex min-h-14 items-center gap-3 pt-4 md:min-h-[72px] md:pt-6", className)}
      >
        <Button variant="ghost" iconOnly round onClick={onBack} aria-label={t("back")}>
          <ArrowLeft {...iconProps("md")} />
        </Button>
        <h1 className="flex-1 text-center text-lg font-semibold">{title}</h1>
        <div className="flex min-w-10 items-center justify-end gap-2">{actions}</div>
      </header>
    );
  }
  return (
    <header
      className={cn(
        "flex min-h-14 items-center justify-between gap-3 pt-4 md:min-h-[72px] md:pt-6",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        {eyebrow && (
          <span className="text-xs font-medium tracking-caps text-text-3 uppercase">{eyebrow}</span>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
