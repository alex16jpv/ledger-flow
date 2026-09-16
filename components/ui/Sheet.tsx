"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type PointerEvent,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { iconProps } from "@/lib/icons/sizes";

import { Button } from "./Button";
import { cn } from "./cn";

const FOCUSABLE =
  'a[href],button,input,select,textarea,summary,[contenteditable],[tabindex]:not([tabindex="-1"])';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
  // The calendar and the wheel of 7.28 are 360 px wide from `sm` up; everything else is 520.
  width?: "md" | "sm";
  className?: string;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
  width = "md",
  className,
}: SheetProps) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const scrimGesture = useRef(false);
  const [bodyNeedsFocus, setBodyNeedsFocus] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // axe `scrollable-region-focusable`: a tab stop only when nothing inside the body can take one.
  useEffect(() => {
    setBodyNeedsFocus(open && body.current?.querySelector(FOCUSABLE) == null);
  }, [open, children]);

  // React re-dispatches the non-bubbling dialog events up the tree: ignore those of a nested sheet.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    if (dismissible) onClose();
  }

  function handleClose(event: SyntheticEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    if (open) onClose();
  }

  // A click lands on the common ancestor, so both ends of the gesture have to be on the scrim.
  function handleScrimDown(event: PointerEvent<HTMLElement>) {
    scrimGesture.current = event.target === event.currentTarget;
  }

  function handleScrimUp(event: PointerEvent<HTMLElement>) {
    scrimGesture.current = scrimGesture.current && event.target === event.currentTarget;
  }

  function handleScrimClick() {
    const onScrim = scrimGesture.current;
    scrimGesture.current = false;
    if (dismissible && onScrim) onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClose={handleClose}
      className={cn(
        "backdrop:bg-overlay m-0 max-h-none max-w-none bg-transparent p-0",
        "fixed inset-0 h-full w-full",
        className,
      )}
    >
      <div
        onPointerDown={handleScrimDown}
        onPointerUp={handleScrimUp}
        onClick={handleScrimClick}
        className="flex h-full w-full items-end justify-center sm:items-center"
      >
        <div
          className={cn(
            "flex max-h-[92%] w-full flex-col gap-4 rounded-t-2xl bg-surface px-4 pt-2 pb-[calc(var(--sp-4)+env(safe-area-inset-bottom))] text-text shadow-3",
            width === "sm" ? "sm:w-[min(360px,92%)]" : "sm:w-[min(520px,92%)]",
            "sm:rounded-xl sm:pb-5",
          )}
        >
          <span
            aria-hidden="true"
            className="mx-auto mt-1 h-1 w-9 rounded-full bg-border-strong sm:hidden"
          />
          <div className="flex items-center justify-between">
            <h2 id={titleId} className="text-md font-semibold">
              {title}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              round
              onClick={onClose}
              aria-label={t("close")}
            >
              <X {...iconProps("sm")} />
            </Button>
          </div>
          <div
            ref={body}
            tabIndex={bodyNeedsFocus ? 0 : undefined}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {children}
          </div>
          {footer && <div className="flex flex-col gap-2">{footer}</div>}
        </div>
      </div>
    </dialog>
  );
}
