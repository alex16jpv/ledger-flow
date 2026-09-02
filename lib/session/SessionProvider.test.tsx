import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "Andrés" } }));
    renderSession();
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(screen.getByTestId("name")).toHaveTextContent("Andrés");
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
});
