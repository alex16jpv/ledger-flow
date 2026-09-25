import { reportError } from "@/lib/observability/reporter";

export type UpdateNotice = "none" | "shown" | "dismissed";

let notice: UpdateNotice = "none";
const listeners = new Set<() => void>();

function set(next: UpdateNotice): void {
  if (next === notice) return;
  notice = next;
  for (const listener of listeners) listener();
}

export function reportUpdateWaiting(): void {
  set("shown");
}

export function dismissUpdate(): void {
  if (notice === "shown") set("dismissed");
}

export function resurfaceUpdate(): void {
  if (notice === "dismissed") set("shown");
}

export function applyUpdate(): void {
  import("./registration")
    .then((registration) => registration.activateWaitingWorker())
    .catch((error: unknown) => {
      reportError(error, "worker");
      window.location.reload();
    });
}

export const updateStore = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): UpdateNotice => notice,
  getServerSnapshot: (): UpdateNotice => "none",
  reset: (): void => {
    set("none");
  },
};
