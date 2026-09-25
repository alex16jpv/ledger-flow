import {
  CircleAlert,
  CloudAlert,
  CloudCheck,
  CloudDownload,
  LogIn,
  WifiOff,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import { iconProps } from "@/lib/icons/sizes";

import { cn } from "./cn";

export type BannerVariant = "offline" | "online" | "error" | "signedout" | "blocked" | "update";

const VARIANT: Record<BannerVariant, string> = {
  offline:
    "bg-warning-soft text-warning border-b-[color-mix(in_oklab,var(--warning)_25%,transparent)]",
  online: "bg-success-soft text-success",
  error: "bg-danger-soft text-danger",
  signedout:
    "bg-warning-soft text-warning border-b-[color-mix(in_oklab,var(--warning)_25%,transparent)]",
  blocked: "bg-danger-soft text-danger",
  update: "bg-info-soft text-info",
};

const ICON: Record<BannerVariant, typeof WifiOff> = {
  offline: WifiOff,
  online: CloudCheck,
  error: CircleAlert,
  signedout: LogIn,
  blocked: CloudAlert,
  update: CloudDownload,
};

export interface BannerAction {
  label: ReactNode;
  onClick: () => void;
}

export interface BannerProps {
  variant: BannerVariant;
  title: ReactNode;
  body?: ReactNode;
  action?: BannerAction | readonly BannerAction[];
  dismiss?: { label: string; onClick: () => void };
  className?: string;
}

export function Banner({ variant, title, body, action, dismiss, className }: BannerProps) {
  const Icon = ICON[variant];
  // What needs the user, not what is merely true: a refusal and a queue an update left behind.
  const alerting = variant === "error" || variant === "blocked";
  const actions: readonly BannerAction[] = !action ? [] : Array.isArray(action) ? action : [action];
  return (
    <div
      role={alerting ? "alert" : "status"}
      aria-live={alerting ? undefined : "polite"}
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
      {actions.map((entry, index) => (
        <button
          key={index}
          type="button"
          onClick={entry.onClick}
          className="font-semibold underline underline-offset-[3px]"
        >
          {entry.label}
        </button>
      ))}
      {dismiss && (
        <button
          type="button"
          onClick={dismiss.onClick}
          aria-label={dismiss.label}
          className="-my-2 -mr-2.5 inline-flex size-(--tap) shrink-0 items-center justify-center rounded-full opacity-85 hover:opacity-100"
        >
          <X {...iconProps("sm")} />
        </button>
      )}
    </div>
  );
}
