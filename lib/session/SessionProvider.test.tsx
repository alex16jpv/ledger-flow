import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { countPendingOperations } from "@/lib/local/db";
import { accountRecord, type OutboxOperation } from "@/lib/local/schema";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import { account, openTestVault, wipeVaults } from "@/lib/testing/vault";

import { tabChannel } from "./channel";
import { SessionProvider, useSession } from "./SessionProvider";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const urlOf = (input: string | URL | Request) =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

function Probe() {
  const session = useSession();
  return (
    <div>
      <output data-testid="status">{session.status}</output>
      <output data-testid="name">{session.user?.name ?? ""}</output>
      <button onClick={() => void session.logout()}>logout</button>
    </div>
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  tabChannel.reset();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await wipeVaults();
});

const operation = (seq: number): OutboxOperation => ({
  seq,
  opId: `op-${seq}`,
  opVersion: 1,
  entity: "transaction",
  entityId: `t${seq}`,
  action: "create",
  occurredAt: "2026-08-01T10:00:00.000Z",
  payload: {},
  dependsOn: [],
  status: "pending",
  attempts: 0,
  lastError: null,
});

async function fillVault(userId: string, pending: number) {
  const vault = await openTestVault(userId);
  await vault.db.put("accounts", accountRecord(account({ id: "a1" })));
  for (let seq = 1; seq <= pending; seq += 1) await vault.db.put("outbox", operation(seq));
  vault.close();
}

function renderSession(onSignedOut = vi.fn()) {
  renderWithProviders(
    <QueryProvider>
      <SessionProvider onSignedOut={onSignedOut}>
        <Probe />
      </SessionProvider>
    </QueryProvider>,
  );
  return onSignedOut;
}

describe("SessionProvider", () => {
  it("loads the current user from the BFF", async () => {
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "John" } }));
    renderSession();
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(screen.getByTestId("name")).toHaveTextContent("John");
    expect(urlOf(fetchMock.mock.calls[0]?.[0] ?? "")).toBe("/api/auth/me");
  });

  it("logs out, tells the other tabs and calls onSignedOut", async () => {
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "A" } }));
    const onSignedOut = renderSession();
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    fetchMock.mockResolvedValue(json({ ok: true }));
    await userEvent.click(screen.getByRole("button", { name: "logout" }));
    await waitFor(() => {
      expect(onSignedOut).toHaveBeenCalled();
    });
    expect(fetchMock.mock.calls.some(([url]) => urlOf(url) === "/api/auth/logout")).toBe(true);
  });

  it("marks the session expired when the channel says so", async () => {
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "A" } }));
    renderSession();
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    act(() => {
      tabChannel.emitLocal({ type: "session:expired" });
    });
    expect(screen.getByTestId("status")).toHaveTextContent("expired");
  });

  it("leaves the vault untouched when the session expires", async () => {
    await fillVault("u1", 4);
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "A" } }));
    renderSession();
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });

    act(() => {
      tabChannel.emitLocal({ type: "session:expired" });
    });
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("expired");
    });

    expect(await countPendingOperations("u1")).toBe(4);
    const vault = await openTestVault("u1");
    expect(await vault.db.count("accounts")).toBe(1);
  });

  it("drops the mirror on an explicit logout but keeps the unsent queue", async () => {
    await fillVault("u1", 4);
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "A" } }));
    const onSignedOut = renderSession();
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });

    fetchMock.mockResolvedValue(json({ ok: true }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await userEvent.click(screen.getByRole("button", { name: "logout" }));
    await waitFor(() => {
      expect(onSignedOut).toHaveBeenCalled();
    });

    const vault = await openTestVault("u1");
    expect(await vault.db.count("accounts")).toBe(0);
    expect(await countPendingOperations("u1")).toBe(4);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("4 unsent operations"));
    warn.mockRestore();
  });
});
