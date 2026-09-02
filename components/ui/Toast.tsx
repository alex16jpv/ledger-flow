"use client";

import { Check } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { iconProps } from "@/lib/icons/sizes";

import { cn } from "./cn";

export interface ToastOptions {
  message: ReactNode;
  action?: { label: ReactNode; onClick: () => void };
  tone?: "default" | "danger";
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  const show = useCallback((options: ToastOptions) => {
    counter.current += 1;
    setToast({ ...options, id: counter.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(dismiss, toast.durationMs ?? 5000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast, dismiss]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--sp-4))] z-(--z-toast) flex justify-center px-4 md:bottom-6"
      >
        {toast && (
          <Toast
            key={toast.id}
            tone={toast.tone}
            action={
              toast.action && {
                label: toast.action.label,
                onClick: () => {
                  toast.action?.onClick();
                  dismiss();
                },
              }
            }
          >
            {toast.message}
          </Toast>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast requires a ToastProvider");
  return context;
}

export interface ToastProps {
  children: ReactNode;
  action?: { label: ReactNode; onClick: () => void };
  tone?: "default" | "danger";
  className?: string;
}

export function Toast({ children, action, tone = "default", className }: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium whitespace-nowrap shadow-3",
        tone === "danger" ? "bg-danger-solid text-on-brand" : "bg-ink text-on-ink",
        className,
      )}
    >
      <Check {...iconProps("md")} />
      {children}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="underline decoration-current underline-offset-[3px] opacity-85 hover:opacity-100"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
