import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { iconProps } from "@/lib/icons/sizes";

import { cn } from "./cn";

export type AlertTone = "warning" | "danger" | "info" | "neutral" | "success";

const TONE: Record<AlertTone, string> = {
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-2 text-text-2",
  success: "bg-success-soft text-success",
};

const ICON: Record<AlertTone, typeof Info> = {
  warning: TriangleAlert,
  danger: CircleAlert,
  info: Info,
  neutral: Info,
  success: CircleCheck,
};

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: AlertTone;
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}

export function Alert({
  tone = "neutral",
  title,
  action,
  className,
  children,
  ...rest
}: AlertProps) {
  const Icon = ICON[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn("flex items-start gap-3 rounded-md px-4 py-3 text-sm", TONE[tone], className)}
      {...rest}
    >
      <Icon {...iconProps("md")} className="mt-px shrink-0" />
      <span className="min-w-0 flex-1">
        {title && <b className="font-semibold">{title}</b>}
        {title && children ? " " : null}
        {children}
      </span>
      {action}
    </div>
  );
}
