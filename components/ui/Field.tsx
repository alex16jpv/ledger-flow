"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useContext,
  useId,
} from "react";

import { iconProps } from "@/lib/icons/sizes";

import { cn } from "./cn";

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldProps {
  label: ReactNode;
  optional?: boolean;
  help?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, optional = false, help, error, className, children }: FieldProps) {
  const t = useTranslations("common");
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy =
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
        <label htmlFor={id} className="flex justify-between text-sm font-medium text-text-2">
          <span>{label}</span>
          {optional && <span className="font-normal text-text-3">{t("optional")}</span>}
        </label>
        {children}
        {help && (
          <span id={helpId} className="text-sm text-text-3">
            {help}
          </span>
        )}
        {error && (
          <span id={errorId} role="alert" className="flex items-center gap-1 text-sm text-danger">
            <CircleAlert {...iconProps("sm")} />
            {error}
          </span>
        )}
      </div>
    </FieldContext.Provider>
  );
}

function useFieldContext() {
  return useContext(FieldContext);
}

const INPUT =
  "flex h-(--control-lg) w-full items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-md text-text transition-[border-color,box-shadow] duration-(--dur-1) ease-(--ease) placeholder:text-text-3 focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:outline-none disabled:bg-surface-2 disabled:text-text-disabled aria-invalid:border-danger-solid";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leading, className, ...rest },
  ref,
) {
  const field = useFieldContext();
  const control = (
    <input
      ref={ref}
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid ? true : undefined}
      className={cn(leading ? "min-w-0 flex-1 bg-transparent outline-none" : INPUT, className)}
      {...rest}
    />
  );
  if (!leading) return control;
  return (
    <div className={cn(INPUT, field?.invalid && "border-danger-solid")}>
      <span className="text-text-3">{leading}</span>
      {control}
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  const field = useFieldContext();
  return (
    <textarea
      ref={ref}
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid ? true : undefined}
      className={cn(INPUT, "h-auto min-h-[88px] items-start py-3", className)}
      {...rest}
    />
  );
});

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  className,
}: SwitchProps) {
  const field = useFieldContext();
  return (
    <button
      type="button"
      role="switch"
      id={field?.id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        onCheckedChange(!checked);
      }}
      className={cn(
        "relative h-[26px] w-11 shrink-0 rounded-full transition-[background] duration-(--dur-2) ease-(--ease) disabled:opacity-50",
        checked ? "bg-brand" : "bg-border-strong",
        "after:absolute after:top-[3px] after:left-[3px] after:size-5 after:rounded-full after:bg-on-brand after:shadow-1 after:transition-transform after:duration-(--dur-2) after:ease-(--ease)",
        checked && "after:translate-x-[18px]",
        className,
      )}
    />
  );
}

export function FieldGroup({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("grid grid-cols-2 gap-3", className)}>{children}</div>;
}
