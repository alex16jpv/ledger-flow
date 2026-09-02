import { CircleAlert, CloudCheck, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { iconProps } from "@/lib/icons/sizes";

import { cn } from "./cn";

export type BannerVariant = "offline" | "online" | "error";

const VARIANT: Record<BannerVariant, string> = {
  offline:
    "bg-warning-soft text-warning border-b-[color-mix(in_oklab,var(--warning)_25%,transparent)]",
  online: "bg-success-soft text-success",
  error: "bg-danger-soft text-danger",
};

const ICON: Record<BannerVariant, typeof WifiOff> = {
  offline: WifiOff,
  online: CloudCheck,
  error: CircleAlert,
};

export interface BannerProps {
  variant: BannerVariant;
  title: ReactNode;
  body?: ReactNode;
  action?: { label: ReactNode; onClick: () => void };
  className?: string;
}

export function Banner({ variant, title, body, action, className }: BannerProps) {
  const Icon = ICON[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? undefined : "polite"}
      className={cn(
        "sticky top-0 z-30 flex items-center gap-3 border-b border-transparent px-4 py-2.5 text-sm font-medium transition-[background,color] duration-(--dur-3) ease-(--ease) md:px-8",
        VARIANT[variant],
        className,
      )}
    >
      <Icon {...iconProps("md")} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{title}</b>
        {body && <span className="block font-normal opacity-85">{body}</span>}
      </span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="font-semibold underline underline-offset-[3px]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
