import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block rounded-sm bg-[linear-gradient(90deg,var(--surface-2),var(--surface-3),var(--surface-2))] bg-[length:200%_100%] motion-safe:animate-[shimmer_1.4s_linear_infinite]",
        className,
      )}
      {...rest}
    />
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-[60px] items-center gap-3 px-4 py-3", className)}>
      <Skeleton className="size-10 rounded-[12px]" />
      <span className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-2.5 w-[35%]" />
      </span>
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
