import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

import { ApiError } from "@/lib/api/errors";
import type { SessionMarker } from "@/lib/auth/cookies";
import { countPendingOperations } from "@/lib/local/db";
import { accountRecord, profileRecord } from "@/lib/local/schema";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { isLocalOnly, setLocalOnly } from "@/lib/network/local-only";
import { setErrorReporter } from "@/lib/observability/reporter";
import { tabChannel } from "@/lib/session/channel";
import { account, openTestVault, profile, wipeVaults } from "@/lib/testing/vault";

const marker = vi.hoisted(() => ({ value: null as SessionMarker | null }));
vi.mock("@/lib/auth/marker", () => ({ readSessionMarker: () => marker.value }));

const { useDeviceEmail, useLogin, useRegister } = await import("./hooks");

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
  setLocalOnly(false);
  connectivityStore.reset();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  setLocalOnly(false);
  marker.value = null;
  await wipeVaults();
});

describe("auth", () => {
  it("ends this-device-only mode when the sign-in succeeds", async () => {
    setLocalOnly(true);
    reportOnline(true);
    expect(connectivityStore.getSnapshot()).toBe("offline");
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "Ada" } }));

    const { result } = renderHook(() => useLogin(), { wrapper });
    await result.current.mutateAsync({ email: "a@b.test", password: "LedgerFlow!2026" });

    await waitFor(() => {
      expect(isLocalOnly()).toBe(false);
    });
    expect(connectivityStore.getSnapshot()).not.toBe("offline");
  });

  it("leaves the mode alone when the sign-in fails", async () => {
    setLocalOnly(true);
    reportOnline(true);
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));

    const { result } = renderHook(() => useLogin(), { wrapper });
    await expect(
      result.current.mutateAsync({ email: "a@b.test", password: "wrong" }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(isLocalOnly()).toBe(true);
    expect(connectivityStore.getSnapshot()).toBe("offline");
  });

  it("ends this-device-only mode when a registration succeeds", async () => {
    setLocalOnly(true);
    fetchMock.mockResolvedValue(json({ user: { id: "u2", name: "Grace" } }));

    const { result } = renderHook(() => useRegister(), { wrapper });
    await result.current.mutateAsync({
      name: "Grace",
      email: "g@b.test",
      password: "LedgerFlow!2026",
      currency: "COP",
      timezone: "America/Bogota",
      locale: "en",
    });

    await waitFor(() => {
      expect(isLocalOnly()).toBe(false);
    });
  });

  it("clears the previous user's copy when another user signs in, and keeps their queue", async () => {
    const previous = await openTestVault("u0");
    await previous.db.put("accounts", accountRecord(account({ id: "a1" })));
    await previous.db.put("outbox", {
      seq: 1,
      opId: "op-1",
      opVersion: 1,
      entity: "transaction",
      entityId: "t1",
      action: "create",
      occurredAt: "2026-09-26T10:00:00.000Z",
      payload: { amount: 12.5 },
      dependsOn: [],
      status: "pending",
      attempts: 0,
      lastError: null,
    });
    previous.close();
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "Ada" } }));

    const { result } = renderHook(() => useLogin(), { wrapper });
    await result.current.mutateAsync({ email: "a@b.test", password: "LedgerFlow!2026" });

    const vault = await openTestVault("u0");
    expect(await vault.db.count("accounts")).toBe(0);
    vault.close();
    expect(await countPendingOperations("u0")).toBe(1);
  });

  it("tells the other tabs once the previous copy is gone, not before", async () => {
    const listed = Promise.withResolvers<IDBDatabaseInfo[]>();
    const databases = vi.spyOn(indexedDB, "databases").mockReturnValueOnce(listed.promise);
    const post = vi.spyOn(tabChannel, "post");
    fetchMock.mockResolvedValue(json({ user: { id: "u2", name: "Grace" } }));

    const { result } = renderHook(() => useRegister(), { wrapper });
    const registration = result.current.mutateAsync({
      name: "Grace",
      email: "g@b.test",
      password: "LedgerFlow!2026",
      currency: "COP",
      timezone: "America/Bogota",
      locale: "en",
    });
    await waitFor(() => {
      expect(databases).toHaveBeenCalled();
    });
    expect(post).not.toHaveBeenCalled();

    listed.resolve([]);
    await registration;

    expect(post).toHaveBeenCalledWith({ type: "session:signedIn" });
    databases.mockRestore();
    post.mockRestore();
  });

  it("still signs in, reports it and tells the other tabs when the copy cannot be cleared", async () => {
    const failure = new DOMException("blocked", "UnknownError");
    const databases = vi.spyOn(indexedDB, "databases").mockRejectedValueOnce(failure);
    const reporter = vi.fn();
    setErrorReporter(reporter);
    const post = vi.spyOn(tabChannel, "post");
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "Ada" } }));

    const { result } = renderHook(() => useLogin(), { wrapper });
    await expect(
      result.current.mutateAsync({ email: "a@b.test", password: "LedgerFlow!2026" }),
    ).resolves.toEqual({ user: { id: "u1", name: "Ada" } });

    expect(reporter).toHaveBeenCalledWith(failure, { scope: "vault", requestId: null });
    expect(post).toHaveBeenCalledWith({ type: "session:signedIn" });
    setErrorReporter(null);
    databases.mockRestore();
    post.mockRestore();
  });

  it("tells no tab anything when the sign-in fails", async () => {
    const post = vi.spyOn(tabChannel, "post");
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));

    const { result } = renderHook(() => useLogin(), { wrapper });
    await expect(
      result.current.mutateAsync({ email: "a@b.test", password: "wrong" }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(post).not.toHaveBeenCalled();
    post.mockRestore();
  });

  it("reads the email of the user this device holds", async () => {
    const user = profile({ id: "u9", email: "ada@ledgerflow.test" });
    const vault = await openTestVault(user.id);
    await vault.db.put("profile", profileRecord(user));
    vault.close();
    marker.value = { userId: user.id, issuedAt: 1_757_000_000_000 };

    const { result } = renderHook(() => useDeviceEmail());

    await waitFor(() => {
      expect(result.current).toBe("ada@ledgerflow.test");
    });
  });

  it("has no email to offer on a device with no vault", async () => {
    const { result } = renderHook(() => useDeviceEmail());
    await waitFor(() => {
      expect(result.current).toBeNull();
    });
  });
});
