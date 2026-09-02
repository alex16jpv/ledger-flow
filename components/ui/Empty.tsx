import type { ReactNode } from "react";

import { cn } from "./cn";
import { Tile } from "./Tile";

export interface EmptyProps {
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
}

export function Empty({ icon, title, body, action, tone = "neutral", className }: EmptyProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-4 py-8 text-center text-text-2",
        className,
      )}
    >
      <Tile
        size="lg"
        variant={tone === "danger" ? "soft" : "outline"}
        color={tone === "danger" ? "RED" : undefined}
        className="mb-2"
      >
        {icon}
      </Tile>
      <h3 className="text-md font-semibold text-text">{title}</h3>
      {body && <p className="max-w-[36ch] text-sm">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
