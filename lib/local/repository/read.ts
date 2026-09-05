import type { IDBPDatabase } from "idb";

import { connectivityStore } from "@/lib/network/connectivity";
import type { Pagination } from "@/types/api";

import type { VaultHandle } from "../db";
import type { VaultSchema } from "../schema";

type ReadSource = "server" | "mirror";

// O-F2b: the mirror is the primary path, network or not (decision 12.2), and the server answers only
// what the mirror cannot — no vault, no snapshot drained yet, or a question it does not know how to
// ask. Setting this back to "server" is the whole way back to the fallback of O-F2a.
const READ_SOURCE: ReadSource = "mirror";

// Returning undefined means "the mirror cannot answer this", not "there is nothing": the caller then
// asks the server, which either succeeds or fails with a real error instead of a fabricated one.
export type MirrorReader<T> = (db: IDBPDatabase<VaultSchema>) => Promise<T | undefined>;

let current: VaultHandle | null = null;
let opening: Promise<VaultHandle | null> | null = null;
let opened: ((handle: VaultHandle | null) => void) | null = null;

// The screens render and fire their queries before the frame's effects run, so a read that decided
// on `current` alone went to the server with a full mirror sitting there (F-31). The frame raises
// this gate while it renders; `startMirror` lowers it with the handle, or with null when none opens.
export function expectVault(): void {
  opening ??= new Promise<VaultHandle | null>((resolve) => {
    opened = resolve;
  });
}

export function setCurrentVault(handle: VaultHandle | null): void {
  current = handle;
  opened?.(handle);
  opened = null;
}

export function currentVault(): VaultHandle | null {
  return current;
}

// What a write has to wait for before deciding it has no vault (R-3 §B3): the screens fire their
// first save as early as they fire their first read, and going straight to the server there would
// skip the outbox on exactly the load where the queue is the only thing that survives.
export async function vaultReady(): Promise<VaultHandle | null> {
  if (opening) await opening;
  return current;
}

// Test seam: the gate is raised once per page load, so nothing lowers it back for the next test.
export function resetVaultGate(): void {
  opening = null;
  opened = null;
}

// A mirror that never finished a snapshot would answer with a fraction of the data and look like an
// empty account; syncedAt is written only by a drained pull.
async function mirrorReady(vault: VaultHandle): Promise<boolean> {
  const record = await vault.db.get("meta", "syncedAt");
  return typeof record?.value === "string";
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

// The shape GET /accounts and GET /categories return for a first page, so a screen cannot tell the
// two sources apart: the server pages these by _id ascending, which is IndexedDB's own key order.
export function mirrorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): { data: T[]; pagination: Pagination } {
  const data = rows.slice(0, limit);
  const hasMore = data.length < rows.length;
  return {
    data,
    pagination: {
      limit,
      offset: 0,
      total: rows.length,
      hasMore,
      nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
    },
  };
}
