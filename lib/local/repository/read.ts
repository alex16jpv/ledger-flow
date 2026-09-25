import type { IDBPDatabase } from "idb";

import { ApiError } from "@/lib/api/errors";
import { sessionIsFor } from "@/lib/auth/marker";
import { connectivityStore } from "@/lib/network/connectivity";
import type { Pagination } from "@/types/api";

import type { VaultHandle } from "../db";
import type { VaultSchema } from "../schema";
import { markSuggestionsStale } from "../suggest/stale";
import { mirrorTimeZone } from "./window";

type ReadSource = "server" | "mirror";

// O-F2b (decision 12.2): setting this back to `server` is the whole way back to O-F2a.
const READ_SOURCE: ReadSource = "mirror";

// undefined is the mirror cannot answer; there is nothing is `mirrorNotFound`, which throws.
export type MirrorReader<T> = (db: IDBPDatabase<VaultSchema>) => Promise<T | undefined>;

// F-46: a deleted transaction keeps its tombstone, so no request is needed to answer 404.
export function mirrorNotFound(entity: string, id: string): ApiError {
  return new ApiError({
    status: 404,
    code: "NOT_FOUND",
    message: `${entity} ${id} not found`,
    requestId: "mirror",
  });
}

let current: VaultHandle | null = null;
let opening: Promise<VaultHandle | null> | null = null;
let opened: ((handle: VaultHandle | null) => void) | null = null;

// F-31: the frame raises this gate while it renders; `startMirror` lowers it with the handle.
export function expectVault(): void {
  opening ??= new Promise<VaultHandle | null>((resolve) => {
    opened = resolve;
  });
}

export function setCurrentVault(handle: VaultHandle | null): void {
  const changed = handle !== current;
  current = handle;
  opened?.(handle);
  opened = null;
  if (changed) markSuggestionsStale();
}

export function currentVault(): VaultHandle | null {
  return current;
}

// T-152: an answer given under another user's session never lands in this copy.
export function ownVault(): VaultHandle | null {
  return current && sessionIsFor(current.userId) ? current : null;
}

// R-3 §B3: a write must wait too, or the first save of a load would skip the outbox.
export async function vaultReady(): Promise<VaultHandle | null> {
  if (opening) await opening;
  return current;
}

// Test seam: the gate is raised once per page load, so nothing lowers it back for the next test.
export function resetVaultGate(): void {
  opening = null;
  opened = null;
}

// `syncedAt` is written only by a drained pull; a fraction of the data looks like an empty account.
export async function mirrorReady(vault: VaultHandle): Promise<boolean> {
  const record = await vault.db.get("meta", "syncedAt");
  return typeof record?.value === "string";
}

// H-14: what "Offline ready" may promise — a copy with the zone every windowed read asks it for.
export async function vaultCanAnswer(vault: VaultHandle): Promise<boolean> {
  const [synced, timeZone] = await Promise.all([mirrorReady(vault), mirrorTimeZone(vault.db)]);
  return synced && timeZone !== undefined;
}

export async function read<T>(
  fromServer: () => Promise<T>,
  fromMirror: MirrorReader<T>,
): Promise<T> {
  const vault = await vaultReady();
  if (!vault) return fromServer();
  if (READ_SOURCE === "server" && connectivityStore.getSnapshot() !== "offline") {
    return fromServer();
  }
  if (!(await mirrorReady(vault))) return fromServer();
  return (await fromMirror(vault.db)) ?? fromServer();
}

// The server pages these by `_id` ascending, which is IndexedDB's own key order.
export function mirrorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
  // What the whole list holds, which is not `rows.length` once a cursor has cut its head off.
  total = rows.length,
): { data: T[]; pagination: Pagination } {
  const data = rows.slice(0, limit);
  const hasMore = data.length < rows.length;
  return {
    data,
    pagination: {
      limit,
      offset: 0,
      total,
      hasMore,
      nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
    },
  };
}
