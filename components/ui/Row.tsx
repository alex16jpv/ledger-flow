import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  Ref,
} from "react";

import { cn } from "./cn";

const ROW =
  "flex w-full min-h-[60px] items-center gap-3 px-4 py-3 text-left transition-[background] duration-(--dur-1) ease-(--ease) [&+&]:border-t [&+&]:border-border";
const INTERACTIVE = "cursor-pointer hover:bg-surface-2";
const PENDING = "bg-[linear-gradient(90deg,var(--warning-soft),transparent_40%)]";

interface RowBaseProps {
  pending?: boolean;
  className?: string;
  children: ReactNode;
}

export type RowButtonProps = RowBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> };

export function RowButton({
  pending = false,
  className,
  children,
  type = "button",
  ref,
  ...rest
}: RowButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(ROW, INTERACTIVE, pending && PENDING, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export type RowLinkProps = RowBaseProps & AnchorHTMLAttributes<HTMLAnchorElement>;

export function RowLink({ pending = false, className, children, ...rest }: RowLinkProps) {
  return (
    <a className={cn(ROW, INTERACTIVE, pending && PENDING, className)} {...rest}>
      {children}
    </a>
  );
}

export type RowProps = RowBaseProps & HTMLAttributes<HTMLDivElement>;

export function Row({ pending = false, className, children, ...rest }: RowProps) {
  return (
    <div className={cn(ROW, pending && PENDING, className)} {...rest}>
      {children}
    </div>
  );
}

export function RowBody({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}>{children}</span>;
}

export function RowTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2 text-base font-medium [&>span:first-child]:truncate",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RowMeta({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 text-sm text-text-3", className)}>
      {items.filter(Boolean).map((item, index) => (
        <span key={index} className="flex min-w-0 items-center gap-1.5">
          {index > 0 && (
            <span
              aria-hidden="true"
              className="size-[3px] shrink-0 rounded-full bg-border-strong"
            />
          )}
          <span className="truncate">{item}</span>
        </span>
      ))}
    </span>
  );
}

export function RowRight({
  sub,
  className,
  children,
}: {
  sub?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("flex shrink-0 flex-col items-end gap-0.5", className)}>
      {children}
      {sub && <span className="text-xs text-text-3">{sub}</span>}
    </span>
  );
}

export function DayHeader({
  label,
  total,
  className,
}: {
  label: ReactNode;
  total?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between px-4 pt-4 pb-1 text-sm font-medium text-text-3",
        className,
      )}
    >
      <span>{label}</span>
      {total && <span className="text-sm font-normal tabular-nums">{total}</span>}
    </div>
  );
}

export function List({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col", className)} {...rest}>
      {children}
    </div>
  );
}
