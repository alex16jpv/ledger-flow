import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  label: string;
}

export function Tag({ label, className, ...rest }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-sm bg-surface-2 px-2 text-xs font-medium text-text-2",
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="mr-px text-text-3">
        #
      </span>
      {label}
    </span>
  );
}
