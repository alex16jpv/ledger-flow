"use client";

import { CloudOff } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { iconProps } from "@/lib/icons/sizes";

import { cn } from "./cn";
import { Tooltip } from "./Tooltip";

export interface ProjectedProps {
  when: boolean;
  // A number sits on the text baseline; a bar or a progress track centres against the mark.
  align?: "baseline" | "center";
  children: ReactNode;
  className?: string;
}

// Invariant 2: a figure carrying writes the server has not seen is never painted as the server's.
export function Projected({ when, align = "baseline", children, className }: ProjectedProps) {
  const t = useTranslations("states");
  if (!when) return children;
  return (
    <span
      className={cn(
        "inline-flex gap-1",
        align === "center" ? "items-center" : "items-baseline",
        className,
      )}
    >
      {children}
      <Tooltip label={t("projected")} className="shrink-0">
        <CloudOff
          {...iconProps("sm")}
          aria-hidden={false}
          role="img"
          tabIndex={0}
          aria-label={t("projected")}
          className={cn("shrink-0 text-warning", align === "baseline" && "translate-y-[2px]")}
        />
      </Tooltip>
    </span>
  );
}
