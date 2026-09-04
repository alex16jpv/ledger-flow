import type { IDBPDatabase } from "idb";

import { connectivityStore } from "@/lib/network/connectivity";
import type { Pagination } from "@/types/api";

import type { VaultHandle } from "../db";
import type { VaultSchema } from "../schema";

type ReadSource = "server" | "mirror";

// O-F2b flips this to "mirror" once the whole suite passes with the mirror in front. Until then the
// mirror only answers when the app has no network, so the online path is byte for byte what it was.
const READ_SOURCE: ReadSource = "server";

// Returning undefined means "the mirror cannot answer this", not "there is nothing": the caller then
// asks the server, which either succeeds or fails with a real error instead of a fabricated one.
export type MirrorReader<T> = (db: IDBPDatabase<VaultSchema>) => Promise<T | undefined>;

let current: VaultHandle | null = null;

export function setCurrentVault(handle: VaultHandle | null): void {
  current = handle;
}

export function currentVault(): VaultHandle | null {
  return current;
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
  const vault = current;
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
