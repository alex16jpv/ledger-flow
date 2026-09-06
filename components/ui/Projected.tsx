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

// Invariant 2 of the offline plan: a figure that already carries writes the server has not seen is
// a projection, and is never painted as one the server sent. Amber is what "incomplete" looks like
// everywhere else in the app (DESIGN §8.12), and the mark is next to the figure, not inside it.
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
