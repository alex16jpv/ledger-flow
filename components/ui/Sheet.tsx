"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  type PointerEvent,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { iconProps } from "@/lib/icons/sizes";

import { Alert } from "./Alert";
import { Button } from "./Button";
import { cn } from "./cn";

const UnsavedContext = createContext<((id: string, unsaved: boolean) => void) | null>(null);

export function useUnsavedGuard(unsaved: boolean): void {
  const report = useContext(UnsavedContext);
  const id = useId();
  useEffect(() => {
    report?.(id, unsaved);
    return () => {
      report?.(id, false);
    };
  }, [id, report, unsaved]);
}

const FOCUSABLE =
  'a[href],button,input,select,textarea,summary,[contenteditable],[tabindex]:not([tabindex="-1"])';

// T-75: how far up the 44x4 bar has to travel before the gesture counts as a drag, not a tap.
export const EXPAND_DRAG_PX = 16;

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
  unsaved?: boolean;
  onExpand?: () => void;
  expandLabel?: string;
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
  unsaved = false,
  onExpand,
  expandLabel,
  width = "md",
  className,
}: SheetProps) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const scrimGesture = useRef(false);
  const dragFrom = useRef<number | null>(null);
  const dragged = useRef(false);
  const [bodyNeedsFocus, setBodyNeedsFocus] = useState(false);
  const [reported, setReported] = useState<readonly string[]>([]);
  const [asking, setAsking] = useState(false);
  const keep = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const questionId = useId();
  const report = useCallback((id: string, value: boolean) => {
    setReported((ids) =>
      value ? [...ids.filter((x) => x !== id), id] : ids.filter((x) => x !== id),
    );
  }, []);
  const somethingToLose = unsaved || reported.length > 0;
  const question = asking && somethingToLose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (asking) keep.current?.focus();
  }, [asking]);

  // axe `scrollable-region-focusable`: a tab stop only when nothing inside the body can take one.
  useEffect(() => {
    setBodyNeedsFocus(open && body.current?.querySelector(FOCUSABLE) == null);
  }, [open, children]);

  function keepEditing() {
    setAsking(false);
    const back = returnTo.current;
    returnTo.current = null;
    back?.focus();
  }

  function requestClose() {
    if (asking) {
      keepEditing();
      return;
    }
    if (somethingToLose) {
      returnTo.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setAsking(true);
      return;
    }
    onClose();
  }

  // React re-dispatches the non-bubbling dialog events up the tree: ignore those of a nested sheet.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    if (dismissible) requestClose();
  }

  function handleClose(event: SyntheticEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    setAsking(false);
    if (open) onClose();
  }

  function handleBarDown(event: PointerEvent<HTMLButtonElement>) {
    dragFrom.current = event.clientY;
    dragged.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleBarUp(event: PointerEvent<HTMLButtonElement>) {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from - event.clientY < EXPAND_DRAG_PX) return;
    dragged.current = true;
    onExpand?.();
  }

  // The drag already answered; the click the browser sends afterwards must not answer again.
  function handleBarClick() {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    onExpand?.();
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
    if (dismissible && onScrim) requestClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClose={handleClose}
      className={cn(
        "m-0 max-h-none max-w-none bg-transparent p-0 backdrop:bg-overlay backdrop:backdrop-blur-(--overlay-blur)",
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
          {onExpand ? (
            <button
              type="button"
              aria-label={expandLabel}
              onPointerDown={handleBarDown}
              onPointerUp={handleBarUp}
              onClick={handleBarClick}
              className="[&>span]:focus-visible:bg-focus-ring mx-auto -mt-1 flex w-16 touch-none justify-center py-2 focus-visible:outline-none sm:hidden"
            >
              <span className="h-1 w-11 rounded-full bg-border-strong" />
            </button>
          ) : (
            <span
              aria-hidden="true"
              className="mx-auto mt-1 h-1 w-9 rounded-full bg-border-strong sm:hidden"
            />
          )}
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
            inert={question}
            tabIndex={bodyNeedsFocus ? 0 : undefined}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <UnsavedContext.Provider value={report}>{children}</UnsavedContext.Provider>
          </div>
          {question ? (
            <div className="flex flex-col gap-3">
              <Alert id={questionId} tone="warning" role="alert" title={t("unsaved.title")}>
                {t("unsaved.body")}
              </Alert>
              <div className="flex gap-3">
                <Button
                  ref={keep}
                  size="lg"
                  className="flex-[1.2]"
                  aria-describedby={questionId}
                  onClick={keepEditing}
                >
                  {t("unsaved.keep")}
                </Button>
                <Button
                  variant="dangerGhost"
                  size="lg"
                  className="flex-1"
                  aria-describedby={questionId}
                  onClick={() => {
                    setAsking(false);
                    onClose();
                  }}
                >
                  {t("unsaved.leave")}
                </Button>
              </div>
            </div>
          ) : (
            footer && <div className="flex flex-col gap-2">{footer}</div>
          )}
        </div>
      </div>
    </dialog>
  );
}
