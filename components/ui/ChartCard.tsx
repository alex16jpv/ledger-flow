"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { iconProps } from "@/lib/icons/sizes";
import { type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";

import { Button } from "./Button";
import { Card } from "./Card";
import { cn } from "./cn";
import { Empty } from "./Empty";
import { LoadErrorBody } from "./LoadErrorBody";
import { Skeleton } from "./Skeleton";

export interface ChartCardProps {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, right, children, className }: ChartCardProps) {
  return (
    <Card className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium tracking-caps text-text-3 uppercase">{title}</span>
        {right}
      </div>
      {children}
    </Card>
  );
}

export function ChartSkeleton({ height, lines = 1 }: { height: number; lines?: number }) {
  const t = useTranslations("common");
  return (
    <Card className="flex flex-col gap-2" role="status" aria-busy="true" aria-label={t("loading")}>
      <Skeleton className="h-2.5 w-28" />
      <Skeleton className="mt-[22px]" style={{ height }} />
      <Skeleton className="h-3 w-3/5" />
      {lines > 1 && <Skeleton className="h-3 w-2/5" />}
    </Card>
  );
}

export function ChartError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  const t = useTranslations("common");
  return (
    <Empty
      tone="danger"
      icon={<CircleAlert {...iconProps("lg")} />}
      title={title}
      body={<LoadErrorBody error={error} />}
      action={<Button onClick={onRetry}>{t("retry")}</Button>}
    />
  );
}

export function LegendKey({
  paint,
  color,
  label,
}: {
  paint: string;
  color?: ColorToken | null;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <i aria-hidden="true" className={paint} style={featureColorStyle(color)} />
      {label}
    </span>
  );
}

export function ChartLegend({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-text-2">{children}</div>;
}
