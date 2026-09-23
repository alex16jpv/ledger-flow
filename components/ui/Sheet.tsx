"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { iconProps } from "@/lib/icons/sizes";

import { Alert } from "./Alert";
import { Button, type ButtonProps } from "./Button";
import { cn } from "./cn";

const UnsavedContext = createContext<((id: string, unsaved: boolean) => void) | null>(null);

const DismissContext = createContext<(() => void) | null>(null);

const FullScreenContext = createContext(false);

const ActionSlotContext = createContext<HTMLElement | null>(null);

const PHONE = "(max-width: 599.98px)";

function phoneQuery(): MediaQueryList | null {
  return typeof window.matchMedia === "function" ? window.matchMedia(PHONE) : null;
}

function subscribePhone(listener: () => void): () => void {
  const query = phoneQuery();
  query?.addEventListener("change", listener);
  return () => {
    query?.removeEventListener("change", listener);
  };
}

function usePhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => phoneQuery()?.matches ?? false,
    () => false,
  );
}

function subscribeViewport(listener: () => void): () => void {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", listener);
  viewport?.addEventListener("scroll", listener);
  return () => {
    viewport?.removeEventListener("resize", listener);
    viewport?.removeEventListener("scroll", listener);
  };
}

function subscribeNothing(): () => void {
  return () => undefined;
}

// A pinch zoom shrinks the visual viewport too, and the sheet must not shrink with it.
function viewportArea(): string {
  const viewport = window.visualViewport;
  if (!viewport || Math.abs(viewport.scale - 1) > 0.01) return "";
  return `${viewport.offsetTop} ${viewport.height}`;
}

function noArea(): string {
  return "";
}

function useVisibleArea(active: boolean): CSSProperties | undefined {
  const area = useSyncExternalStore(
    active ? subscribeViewport : subscribeNothing,
    active ? viewportArea : noArea,
    noArea,
  );
  if (area === "") return undefined;
  const [top, height] = area.split(" ").map(Number);
  return { top, height };
}

export function SheetAction({ className, block, ...props }: Omit<ButtonProps, "size">) {
  const slot = useContext(ActionSlotContext);
  if (slot) return createPortal(<Button {...props} size="md" />, slot);
  return <Button {...props} size="lg" block={block} className={className} />;
}

export function SheetCancel({
  children,
  variant = "ghost",
  className,
}: {
  children?: ReactNode;
  variant?: "ghost" | "secondary";
  className?: string;
}) {
  const t = useTranslations("common");
  const dismiss = useContext(DismissContext);
  const fullScreen = useContext(FullScreenContext);
  if (!dismiss) throw new Error("SheetCancel must be rendered inside a Sheet");
  if (fullScreen) return null;
  return (
    <Button variant={variant} size="lg" block={!className} className={className} onClick={dismiss}>
      {children ?? t("cancel")}
    </Button>
  );
}

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

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  // Below `sm`: a form or a list fills the screen, a question or a single field is a centred dialog.
  layout: "full" | "dialog";
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
  unsaved?: boolean;
  // The calendar and the wheel of 7.28 are 360 px wide from `sm` up; everything else is 520.
  width?: "md" | "sm";
  className?: string;
}

export function Sheet({
  open,
  onClose,
  title,
  layout,
  children,
  footer,
  dismissible = true,
  unsaved = false,
  width = "md",
  className,
}: SheetProps) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const scrimGesture = useRef(false);
  const questionGesture = useRef(false);
  const phone = usePhone();
  const fullScreen = phone && layout === "full";
  const area = useVisibleArea(open);
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const [bodyNeedsFocus, setBodyNeedsFocus] = useState(false);
  const [reported, setReported] = useState<readonly string[]>([]);
  const [asking, setAsking] = useState(false);
  const keep = useRef<HTMLButtonElement>(null);
  const askedBefore = useRef(false);
  const footerBox = useRef<HTMLDivElement>(null);
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
    if (asking) {
      askedBefore.current = true;
      keep.current?.focus();
      return;
    }
    if (!askedBefore.current) return;
    askedBefore.current = false;
    const back = returnTo.current;
    returnTo.current = null;
    // The exit that asked may have unmounted while the question stood.
    (back?.isConnected
      ? back
      : (footerBox.current?.querySelector<HTMLElement>(FOCUSABLE) ??
        ref.current?.querySelector<HTMLElement>(FOCUSABLE))
    )?.focus();
  }, [asking]);

  // axe `scrollable-region-focusable`: a tab stop only when nothing inside the body can take one.
  useEffect(() => {
    setBodyNeedsFocus(open && body.current?.querySelector(FOCUSABLE) == null);
  }, [open, children]);

  function keepEditing() {
    setAsking(false);
  }

  function requestClose() {
    // `question`, not `asking`: what was worth asking about can go away while the question is up.
    if (question) {
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
    returnTo.current = null;
    setAsking(false);
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
    if (dismissible && onScrim) requestClose();
  }

  function leave() {
    returnTo.current = null;
    setAsking(false);
    onClose();
  }

  const close = (
    <Button variant="ghost" size="sm" iconOnly round onClick={requestClose} aria-label={t("close")}>
      <X {...iconProps("sm")} />
    </Button>
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClose={handleClose}
      style={area}
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
        className={cn(
          "flex h-full w-full items-center justify-center",
          layout === "dialog" && "p-4 sm:p-0",
        )}
      >
        <div
          inert={question}
          className={cn(
            "flex w-full flex-col bg-surface text-text shadow-3",
            fullScreen
              ? "h-full pt-(--safe-top)"
              : "max-h-full gap-4 rounded-2xl p-5 sm:max-h-[92%] sm:rounded-xl sm:px-4 sm:pt-2 sm:pb-5",
            width === "sm" ? "sm:w-[min(360px,92%)]" : "sm:w-[min(520px,92%)]",
          )}
        >
          {fullScreen ? (
            <div className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border px-3">
              {close}
              <h2 id={titleId} className="min-w-0 text-md font-semibold break-words">
                {title}
              </h2>
              <div ref={setActionSlot} className="flex" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h2 id={titleId} className="text-md font-semibold">
                {title}
              </h2>
              {close}
            </div>
          )}
          <DismissContext.Provider value={requestClose}>
            <FullScreenContext.Provider value={fullScreen}>
              <ActionSlotContext.Provider value={fullScreen ? actionSlot : null}>
                <div
                  ref={body}
                  tabIndex={bodyNeedsFocus ? 0 : undefined}
                  className={cn(
                    "min-h-0 flex-1 overflow-y-auto",
                    fullScreen &&
                      "flex flex-col px-4 pt-4 pb-[calc(var(--sp-4)+var(--safe-bottom))]",
                  )}
                >
                  <UnsavedContext.Provider value={report}>{children}</UnsavedContext.Provider>
                  {fullScreen && footer && (
                    <div ref={footerBox} className="mt-4 flex flex-col gap-2 empty:hidden">
                      {footer}
                    </div>
                  )}
                </div>
                {!fullScreen && footer && (
                  <div ref={footerBox} className="flex flex-col gap-2">
                    {footer}
                  </div>
                )}
              </ActionSlotContext.Provider>
            </FullScreenContext.Provider>
          </DismissContext.Provider>
        </div>
      </div>
      {question && (
        <div
          onPointerDown={(event) => {
            questionGesture.current = event.target === event.currentTarget;
          }}
          onPointerUp={(event) => {
            questionGesture.current =
              questionGesture.current && event.target === event.currentTarget;
          }}
          onClick={() => {
            const outside = questionGesture.current;
            questionGesture.current = false;
            if (outside) keepEditing();
          }}
          className="absolute inset-0 flex items-center justify-center bg-overlay p-4"
        >
          <div
            role="alertdialog"
            aria-labelledby={questionId}
            className="flex w-full max-w-[400px] flex-col gap-3 rounded-2xl bg-surface p-5 text-text shadow-3 sm:rounded-xl"
          >
            <Alert id={questionId} tone="warning" title={t("unsaved.title")}>
              {t("unsaved.body")}
            </Alert>
            <div className="flex gap-3">
              <Button ref={keep} size="lg" className="flex-[1.2]" onClick={keepEditing}>
                {t("unsaved.keep")}
              </Button>
              <Button variant="dangerGhost" size="lg" className="flex-1" onClick={leave}>
                {t("unsaved.leave")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
