import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { QueryProvider } from "@/lib/query/QueryProvider";
import type { User } from "@/types/api";

const stored = { current: null as User | null, failure: null as Error | null };
vi.mock("./repository/profile", () => ({
  readMirrorProfile: () =>
    stored.failure ? Promise.reject(stored.failure) : Promise.resolve(stored.current),
}));
const reportError = vi.fn();
vi.mock("@/lib/observability/reporter", () => ({ reportError }));

const { useMirrorProfile } = await import("./useMirrorProfile");

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryProvider>{children}</QueryProvider>
);

describe("useMirrorProfile", () => {
  it("is not pending while nothing asks for it", () => {
    const { result } = renderHook(() => useMirrorProfile(false), { wrapper });
    expect(result.current).toEqual({ user: null, pending: false });
  });

  it("is pending until the copy answers, with a profile or without one", async () => {
    stored.current = { id: "u1", timezone: "Europe/Madrid", currency: "EUR" } as User;
    const { result } = renderHook(() => useMirrorProfile(true), { wrapper });
    expect(result.current.pending).toBe(true);
    await waitFor(() => {
      expect(result.current).toEqual({ user: stored.current, pending: false });
    });
  });

  it("stops waiting and reports it when the copy cannot be read", async () => {
    stored.failure = new Error("IndexedDB is gone");
    const { result } = renderHook(() => useMirrorProfile(true), { wrapper });
    await waitFor(() => {
      expect(result.current).toEqual({ user: null, pending: false });
    });
    expect(reportError).toHaveBeenCalledWith(stored.failure, "vault");
    stored.failure = null;
  });
});
