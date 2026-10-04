import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { refreshSession, resetRefreshState } from "@/lib/api/refresh";
import { countPendingOperations } from "@/lib/local/db";
import { accountRecord, type OutboxOperation } from "@/lib/local/schema";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import { account, openTestVault, wipeVaults } from "@/lib/testing/vault";

import { tabChannel } from "./channel";
import { SessionProvider, useSession } from "./SessionProvider";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const statuses: string[] = [];
const everywhere: unknown[] = [];

function Probe() {
  const session = useSession();
  statuses.push(session.status);
  return (
    <div>
      <output data-testid="status">{session.status}</output>
      <button onClick={() => void session.refetch()}>refetch</button>
      <output data-testid="name">{session.user?.name ?? ""}</output>
      <button onClick={() => void session.logout()}>logout</button>
      <button onClick={() => void session.logout({ discardPendingWork: true })}>discard</button>
      <button
        onClick={() => {
          session.logoutAll().then(
            (result) => {
              everywhere.push(result);
            },
            (error: unknown) => {
              everywhere.push(error);
            },
          );
        }}
      >
        everywhere
      </button>
    </div>
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  tabChannel.reset();
  resetRefreshState();
  everywhere.length = 0;
});

afterEach(async () => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
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

  // R-3b: React Query drops an errored query back to pending, and §2.6's vault hangs on it.
  it("does not fall back to loading when a failed session is fetched again", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    statuses.length = 0;
    renderWithProviders(
      <QueryProvider>
        <SessionProvider onSignedOut={vi.fn()}>
          <Probe />
        </SessionProvider>
      </QueryProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "Ada" } }));
    await userEvent.click(screen.getByRole("button", { name: "refetch" }));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    const afterError = statuses.slice(statuses.indexOf("error"));
    expect(afterError).not.toContain("loading");
  });

  it("gives up when there is no network to ask over, without asking", async () => {
    onlineManager.setOnline(false);
    statuses.length = 0;
    renderSession();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fall back to loading when the network comes back", async () => {
    onlineManager.setOnline(false);
    statuses.length = 0;
    renderSession();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "Ada" } }));
    act(() => {
      onlineManager.setOnline(true);
    });
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(statuses.slice(statuses.indexOf("error"))).not.toContain("loading");
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

  // H-61: the owner signed out and a stray 401 posted a refresh a second later, filing a dead session
  // in Sentry. What must not happen after a sign-out is the request, not just the report.
  it("asks for no token after signing out [H-61]", async () => {
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "A" } }));
    renderSession();
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    fetchMock.mockResolvedValue(json({ ok: true }));
    await userEvent.click(screen.getByRole("button", { name: "logout" }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => urlOf(url) === "/api/auth/logout")).toBe(true);
    });

    fetchMock.mockClear();
    await expect(refreshSession()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("signing out everywhere [T-252]", () => {
    const user = { user: { id: "u1", name: "A" } };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    async function signedIn() {
      fetchMock.mockResolvedValue(json(user));
      const onSignedOut = renderSession();
      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
      });
      return onSignedOut;
    }

    async function signOutEverywhere(answer: () => Promise<Response>) {
      const onSignedOut = await signedIn();
      const posted = vi.spyOn(tabChannel, "post");
      fetchMock.mockImplementation((input) =>
        urlOf(input) === "/api/auth/logout-all" ? answer() : Promise.resolve(json(user)),
      );
      await userEvent.click(screen.getByRole("button", { name: "everywhere" }));
      await waitFor(() => {
        expect(everywhere).toHaveLength(1);
      });
      // The sessions page navigates with what the sign-out returned, not the provider.
      expect(onSignedOut).not.toHaveBeenCalled();
      return posted;
    }

    it("signs this device out once the server signed every device out", async () => {
      const posted = await signOutEverywhere(() => Promise.resolve(json({ message: "ok" })));
      expect(everywhere).toEqual(["everywhere"]);
      expect(posted).toHaveBeenCalledWith({ type: "session:logout" });
      await expect(refreshSession()).resolves.toBe(false);
    });

    it("signs this device out and says only here when no session was left to do it with", async () => {
      const posted = await signOutEverywhere(() =>
        Promise.resolve(json({ code: "REFRESH_INVALID" }, { status: 401 })),
      );
      expect(everywhere).toEqual(["hereOnly"]);
      expect(posted).toHaveBeenCalledWith({ type: "session:logout" });
    });

    it.each([
      ["the server is down", { code: "DB_UNAVAILABLE" }, 503],
      ["there were too many attempts", { code: "RATE_LIMITED" }, 429],
      ["a 401 the BFF did not sign answers", {}, 401],
    ])("keeps the session and fails loudly when %s", async (_, body, status) => {
      const posted = await signOutEverywhere(() => Promise.resolve(json(body, { status })));
      expect(everywhere[0]).toBeInstanceOf(Error);
      expect(posted).not.toHaveBeenCalledWith({ type: "session:logout" });
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");

      fetchMock.mockResolvedValue(json({ ok: true }));
      await expect(refreshSession()).resolves.toBe(true);
    });

    it("keeps the session and fails loudly when there is no network", async () => {
      await signOutEverywhere(() => Promise.reject(new TypeError("Failed to fetch")));
      expect(everywhere[0]).toBeInstanceOf(Error);
      fetchMock.mockResolvedValue(json({ ok: true }));
      await expect(refreshSession()).resolves.toBe(true);
    });

    it("leaves the session over when another tab ended it while the sign-out failed [H-61]", async () => {
      await signedIn();
      let answer: (response: Response) => void = () => undefined;
      fetchMock.mockImplementation((input) =>
        urlOf(input) === "/api/auth/logout-all"
          ? new Promise<Response>((resolve) => {
              answer = resolve;
            })
          : Promise.resolve(json(user)),
      );
      await userEvent.click(screen.getByRole("button", { name: "everywhere" }));
      await waitFor(() => {
        expect(
          fetchMock.mock.calls.some(([input]) => urlOf(input) === "/api/auth/logout-all"),
        ).toBe(true);
      });
      act(() => {
        tabChannel.emitLocal({ type: "session:expired" });
      });
      answer(json({ code: "DB_UNAVAILABLE" }, { status: 503 }));
      await waitFor(() => {
        expect(everywhere).toHaveLength(1);
      });

      fetchMock.mockClear();
      await expect(refreshSession()).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
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
    await userEvent.click(screen.getByRole("button", { name: "logout" }));
    await waitFor(() => {
      expect(onSignedOut).toHaveBeenCalled();
    });

    const vault = await openTestVault("u1");
    expect(await vault.db.count("accounts")).toBe(0);
    expect(await countPendingOperations("u1")).toBe(4);
  });

  // F-34: keeping is the default; discarding only after the user was shown what goes.
  it("discards the queue on logout when the user chose to", async () => {
    await fillVault("u1", 4);
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "A" } }));
    const onSignedOut = renderSession();
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });

    fetchMock.mockResolvedValue(json({ ok: true }));
    await userEvent.click(screen.getByRole("button", { name: "discard" }));
    await waitFor(() => {
      expect(onSignedOut).toHaveBeenCalled();
    });

    expect(await countPendingOperations("u1")).toBe(0);
  });
});
