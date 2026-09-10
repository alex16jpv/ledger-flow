import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

import { ApiError } from "@/lib/api/errors";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { isLocalOnly, setLocalOnly } from "@/lib/network/local-only";

import { useLogin, useRegister } from "./hooks";

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

afterEach(() => {
  vi.unstubAllGlobals();
  setLocalOnly(false);
});

describe("auth", () => {
  // P-36: the sheet of P-32 sends a device-only user to the login to end the mode, and the mode
  // outlived the sign-in: the stripe still said nothing was syncing on a session that just started.
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

  // A registration is a sign-in too: the third exit of P-32 wipes the device and lands here.
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
});
