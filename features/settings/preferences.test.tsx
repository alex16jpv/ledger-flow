import { act, waitFor } from "@testing-library/react";
import { useEffect } from "react";

import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { appliedProfile } from "@/lib/session/applied-profile";
import { SessionProvider, useSession } from "@/lib/session/SessionProvider";
import { renderWithProviders } from "@/lib/testing/render";
import { ThemeProvider, themeStore, unsentTheme } from "@/lib/theme";

import { useProfilePreferences } from "./preferences";

const nav = vi.hoisted(() => ({ path: "/settings", replace: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => nav.path,
  Link: ({ children }: { children: unknown }) => children,
}));

type SavedTheme = { palette: "brisa" | "tinta"; mode: "light" | "dark" | "system" } | null;

interface Server {
  locale: "en" | "es";
  theme: SavedTheme;
  updatedAt: string;
  saving: "works" | "fails" | "refuses" | "held";
  confirmationRequired: boolean;
}

const T1 = "2026-10-05T10:00:00.000Z";
const T2 = "2026-10-05T11:00:00.000Z";
let server: Server;
let tick = 0;
const held: (() => void)[] = [];

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const profile = () => ({
  id: "u1",
  name: "John",
  locale: server.locale,
  theme: server.theme,
  updatedAt: server.updatedAt,
  emailConfirmationRequired: server.confirmationRequired,
});

function serve(state: Partial<Server> = {}) {
  server = {
    locale: "en",
    theme: { palette: "brisa", mode: "system" },
    updatedAt: T1,
    saving: "works",
    confirmationRequired: false,
    ...state,
  };
  fetchMock.mockImplementation((input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "/api/auth/me") return Promise.resolve(json({ user: profile() }));
    if (url !== "/api/users/u1" || init?.method !== "PUT") {
      return Promise.resolve(json({ error: "x", message: "unexpected" }, { status: 500 }));
    }
    if (server.saving === "fails") {
      return Promise.resolve(json({ error: "x", message: "down" }, { status: 503 }));
    }
    if (server.saving === "refuses") {
      return Promise.resolve(
        json({ error: "x", message: "no", code: "VALIDATION" }, { status: 400 }),
      );
    }
    const body = JSON.parse(typeof init.body === "string" ? init.body : "{}") as {
      theme: SavedTheme;
    };
    const save = () => {
      server.theme = body.theme;
      server.updatedAt = new Date(Date.parse(T2) + ++tick * 1000).toISOString();
      return json(profile());
    };
    if (server.saving === "works") return Promise.resolve(save());
    return new Promise<Response>((resolve) => {
      held.push(() => {
        resolve(save());
      });
    });
  });
}

const puts = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(
      ([, init]) =>
        JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { theme: SavedTheme },
    );
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

let readMeAgain: () => Promise<unknown> = () => Promise.resolve();

function Probe() {
  const { refetch } = useSession();
  useEffect(() => {
    readMeAgain = refetch;
  }, [refetch]);
  useProfilePreferences();
  return null;
}

const tree = () => (
  <QueryProvider>
    <ThemeProvider>
      <SessionProvider onSignedOut={vi.fn()}>
        <Probe />
      </SessionProvider>
    </ThemeProvider>
  </QueryProvider>
);

async function open() {
  const view = renderWithProviders(tree());
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.anything());
  });
  await flush();
  return view;
}

function storeLocally(palette: string, mode: string) {
  window.localStorage.setItem("lf.palette", palette);
  window.localStorage.setItem("lf.mode", mode);
}

beforeEach(() => {
  fetchMock.mockReset();
  nav.replace.mockReset();
  nav.path = "/settings";
  held.length = 0;
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/settings");
  themeStore.reset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  connectivityStore.reset();
  vi.unstubAllGlobals();
});

describe("useProfilePreferences", () => {
  it("takes the account's theme on a device that shows another one", async () => {
    storeLocally("brisa", "system");
    serve({ theme: { palette: "tinta", mode: "dark" } });

    await open();

    await waitFor(() => {
      expect(themeStore.getSnapshot()).toEqual({ palette: "tinta", mode: "dark" });
    });
    expect(window.localStorage.getItem("lf.palette")).toBe("tinta");
    expect(puts()).toEqual([]);
  });

  it("saves this device's theme on an account that never picked one", async () => {
    storeLocally("tinta", "light");
    serve({ theme: null });

    await open();

    await waitFor(() => {
      expect(server.theme).toEqual({ palette: "tinta", mode: "light" });
    });
    expect(puts()).toEqual([{ theme: { palette: "tinta", mode: "light" } }]);
    expect(unsentTheme.read("u1")).toBeNull();
  });

  it("keeps a choice that never reached the server over the account's, and sends it on the next read", async () => {
    storeLocally("tinta", "light");
    unsentTheme.mark("u1", { palette: "tinta", mode: "light" });
    serve({ theme: { palette: "brisa", mode: "dark" }, saving: "fails" });

    await open();

    await waitFor(() => {
      expect(puts()).toEqual([{ theme: { palette: "tinta", mode: "light" } }]);
    });
    await flush();
    expect(themeStore.getSnapshot()).toEqual({ palette: "tinta", mode: "light" });
    expect(unsentTheme.read("u1")).not.toBeNull();

    server.saving = "works";
    await act(async () => {
      await readMeAgain();
    });

    await waitFor(() => {
      expect(server.theme).toEqual({ palette: "tinta", mode: "light" });
    });
    expect(unsentTheme.read("u1")).toBeNull();
    expect(themeStore.getSnapshot()).toEqual({ palette: "tinta", mode: "light" });
  });

  it("drops a choice the server refuses for good and takes the account's", async () => {
    storeLocally("tinta", "light");
    unsentTheme.mark("u1", { palette: "tinta", mode: "light" });
    serve({ theme: { palette: "brisa", mode: "dark" }, saving: "refuses" });

    await open();

    await waitFor(() => {
      expect(themeStore.getSnapshot()).toEqual({ palette: "brisa", mode: "dark" });
    });
    expect(unsentTheme.read("u1")).toBeNull();
    expect(puts()).toHaveLength(1);
  });

  it("waits for the connection to send a choice made offline", async () => {
    serve();
    await open();

    act(() => {
      reportOnline(false);
      themeStore.set({ palette: "tinta", mode: "dark" });
      unsentTheme.mark("u1", { palette: "tinta", mode: "dark" });
    });
    await flush();
    expect(puts()).toEqual([]);

    act(() => {
      reportOnline(true);
    });

    await waitFor(() => {
      expect(server.theme).toEqual({ palette: "tinta", mode: "dark" });
    });
    expect(puts()).toEqual([{ theme: { palette: "tinta", mode: "dark" } }]);
  });

  it("sends a choice made while another was on its way, after it", async () => {
    serve({ saving: "held" });
    await open();

    act(() => {
      themeStore.set({ palette: "tinta", mode: "dark" });
      unsentTheme.mark("u1", { palette: "tinta", mode: "dark" });
    });
    await waitFor(() => {
      expect(held).toHaveLength(1);
    });
    act(() => {
      themeStore.set({ palette: "tinta", mode: "light" });
      unsentTheme.mark("u1", { palette: "tinta", mode: "light" });
    });
    await flush();
    expect(puts()).toHaveLength(1);

    server.saving = "works";
    act(() => {
      held[0]?.();
    });

    await waitFor(() => {
      expect(server.theme).toEqual({ palette: "tinta", mode: "light" });
    });
    expect(puts().map(({ theme }) => theme?.mode)).toEqual(["dark", "light"]);
    expect(themeStore.getSnapshot()).toEqual({ palette: "tinta", mode: "light" });
  });

  it("sends nothing for an account that has to confirm its email first", async () => {
    serve({ theme: null, confirmationRequired: true });

    await open();

    expect(puts()).toEqual([]);
    expect(unsentTheme.read("u1")).toBeNull();
  });

  it("ignores a read older than what this device already applied", async () => {
    appliedProfile.note("u1", "theme", T2);
    appliedProfile.note("u1", "locale", T2);
    serve({ locale: "es", theme: { palette: "tinta", mode: "dark" }, updatedAt: T1 });

    await open();

    expect(themeStore.getSnapshot()).toEqual({ palette: "brisa", mode: "system" });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("leaves alone a choice another account left unsent", async () => {
    unsentTheme.mark("u2", { palette: "tinta", mode: "dark" });
    serve({ theme: { palette: "tinta", mode: "light" } });

    await open();

    await waitFor(() => {
      expect(themeStore.getSnapshot()).toEqual({ palette: "tinta", mode: "light" });
    });
    expect(puts()).toEqual([]);
  });

  it("on a device already open, takes a newer theme at once and a newer language at the next screen", async () => {
    window.history.replaceState(null, "", "/settings?period=2026-09");
    serve();
    const view = await open();

    server.theme = { palette: "tinta", mode: "dark" };
    server.locale = "es";
    server.updatedAt = T2;
    await act(async () => {
      await readMeAgain();
    });

    await waitFor(() => {
      expect(themeStore.getSnapshot()).toEqual({ palette: "tinta", mode: "dark" });
    });
    expect(nav.replace).not.toHaveBeenCalled();

    nav.path = "/stats";
    window.history.replaceState(null, "", "/stats?period=2026-09");
    view.rerender(tree());

    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith("/stats?period=2026-09", { locale: "es" });
    });
  });

  it("switches to the account's language at the next screen, keeping the address, and forgets the old device mode", async () => {
    window.localStorage.setItem("lf.localeMode", "device");
    serve({ locale: "es" });
    const view = await open();

    expect(nav.replace).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("lf.localeMode")).toBeNull();

    view.unmount();
    nav.path = "/transactions";
    window.history.replaceState(null, "", "/transactions?tab=a#top");
    renderWithProviders(tree());

    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith("/transactions?tab=a#top", { locale: "es" });
    });
  });
});
