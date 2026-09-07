import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { SessionsView } from "./SessionsView";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();

const sessions = [
  {
    id: "s1",
    createdAt: "2026-08-12T10:00:00Z",
    lastUsedAt: new Date().toISOString(),
    expiresAt: "2026-10-12T10:00:00Z",
    userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/128.0 Mobile",
  },
  {
    id: "s2",
    createdAt: "2026-08-18T10:00:00Z",
    lastUsedAt: "2026-08-30T10:00:00Z",
    expiresAt: "2026-09-29T10:00:00Z",
    userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/128.0 Safari/537.36 Edg/128.0",
  },
];

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  connectivityStore.reset();
});

describe("SessionsView", () => {
  it("lists devices, most recent first, and signs one out", async () => {
    const deleted: string[] = [];
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === "DELETE") {
        deleted.push(typeof input === "string" ? input : "");
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(json({ data: sessions }));
    });
    const onSignOutAll = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <SessionsView onSignOutAll={onSignOutAll} />
        </ToastProvider>
      </QueryProvider>,
    );
    const rows = await screen.findAllByRole("button", { name: /^Sign out (Android|Windows)/ });
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Sign out Android · Chrome",
      "Sign out Windows · Edge",
    ]);
    expect(screen.getByText("Active now")).toBeInTheDocument();
    const [, windows] = rows as [HTMLElement, HTMLElement];
    await userEvent.click(windows);
    expect(await screen.findByText("Device signed out")).toBeVisible();
    expect(deleted).toEqual(["/api/auth/sessions/s2"]);

    await userEvent.click(screen.getByRole("button", { name: "Sign out all other sessions" }));
    const dialog = screen.getByRole("dialog", { name: "Sign out every device?" });
    expect(dialog).toHaveTextContent(/also signs out this device/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Sign out everywhere" }));
    expect(onSignOutAll).toHaveBeenCalled();
  });

  // R-3b §C: with no network the request cannot reach the server, so the sign-out would only clear
  // this device and leave the account signed in. It waits, and says why.
  it("does not offer to sign out every device while offline", async () => {
    fetchMock.mockResolvedValue(json({ data: sessions }));
    reportOnline(false);
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <SessionsView onSignOutAll={vi.fn()} />
        </ToastProvider>
      </QueryProvider>,
    );
    await screen.findAllByRole("button", { name: /^Sign out (Android|Windows)/ });
    expect(screen.getByRole("button", { name: "Sign out all other sessions" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/needs a connection/);
  });
});
