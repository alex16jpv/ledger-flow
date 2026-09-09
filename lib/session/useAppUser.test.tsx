import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/types/api";

const session = vi.hoisted(() => ({
  value: { user: null as User | null, status: "authenticated" },
}));
const mirror = vi.hoisted(() => ({
  value: null as User | null,
  enabled: undefined as boolean | undefined,
}));

vi.mock("./SessionProvider", () => ({ useSession: () => session.value }));
vi.mock("@/lib/local/useMirrorProfile", () => ({
  useMirrorProfile: (enabled: boolean) => {
    mirror.enabled = enabled;
    return enabled ? mirror.value : null;
  },
}));

const { useAppUser } = await import("./useAppUser");

const person = (name: string): User => ({ id: "u1", name, email: "a@b.test" }) as User;

describe("useAppUser", () => {
  beforeEach(() => {
    session.value = { user: null, status: "authenticated" };
    mirror.value = null;
    mirror.enabled = undefined;
  });

  it("prefers the session, and does not ask the mirror for what it already knows", () => {
    session.value = { user: person("Alex Perez"), status: "authenticated" };
    mirror.value = person("Old Name");

    const { result } = renderHook(() => useAppUser());

    expect(result.current?.name).toBe("Alex Perez");
    expect(mirror.enabled).toBe(false);
  });

  // F-82: an offline cold start, or local mode: the session answers nothing and the mirror has the row.
  it("falls back to the profile the mirror stored", () => {
    session.value = { user: null, status: "expired" };
    mirror.value = person("Alex Perez");

    const { result } = renderHook(() => useAppUser());

    expect(mirror.enabled).toBe(true);
    expect(result.current?.name).toBe("Alex Perez");
  });

  it("waits while the session is still resolving instead of reading the mirror", () => {
    session.value = { user: null, status: "loading" };
    mirror.value = person("Alex Perez");

    const { result } = renderHook(() => useAppUser());

    expect(mirror.enabled).toBe(false);
    expect(result.current).toBeNull();
  });
});
