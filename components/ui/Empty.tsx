import type { ReactNode } from "react";

import { cn } from "./cn";
import { Tile } from "./Tile";

export interface EmptyProps {
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "danger";
  // Where this Empty is the whole page — the 404, an error boundary — nothing else carries the
  // document's first heading.
  titleAs?: "h1" | "h2";
  titleSize?: "md" | "page";
  className?: string;
}

export function Empty({
  icon,
  title,
  body,
  action,
  tone = "neutral",
  titleAs: Title = "h2",
  titleSize = "md",
  className,
}: EmptyProps) {
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
      <Title
        className={cn(
          "font-semibold text-text",
          titleSize === "page" ? "text-2xl tracking-[-0.02em]" : "text-md",
        )}
      >
        {title}
      </Title>
      {body && <p className="max-w-[36ch] text-sm">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
