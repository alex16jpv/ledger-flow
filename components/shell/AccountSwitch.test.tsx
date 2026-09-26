import { act, screen } from "@testing-library/react";

import { ToastProvider } from "@/components/ui/Toast";
import type { SessionMarker } from "@/lib/auth/cookies";
import { tabChannel } from "@/lib/session/channel";
import { noteAccountSwitched } from "@/lib/session/switch";
import { renderWithProviders } from "@/lib/testing/render";

import { AccountSwitch } from "./AccountSwitch";

const marker = vi.hoisted(() => ({ value: null as SessionMarker | null }));
vi.mock("@/lib/auth/marker", () => ({ readSessionMarker: () => marker.value }));

const assign = vi.fn();
const reload = vi.fn();
const ada: SessionMarker = { userId: "ada", issuedAt: 1_758_000_000_000 };

beforeEach(() => {
  vi.stubGlobal("location", {
    origin: "https://app.test",
    href: "https://app.test/",
    assign,
    reload,
  });
  marker.value = ada;
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  assign.mockReset();
  reload.mockReset();
  tabChannel.reset();
});

const render = ({
  expired = false,
  vaultUserId = "ada",
}: { expired?: boolean; vaultUserId?: string | null } = {}) =>
  renderWithProviders(
    <ToastProvider>
      <AccountSwitch vaultUserId={vaultUserId ?? undefined} mountedMarker={ada} expired={expired} />
    </ToastProvider>,
  );

const signInElsewhere = (next: SessionMarker) => {
  marker.value = next;
  act(() => {
    tabChannel.emitLocal({ type: "session:signedIn" });
  });
};

describe("AccountSwitch", () => {
  it("moves the tab to Home of the account that signed in, with a full load", () => {
    render();

    signInElsewhere({ userId: "grace", issuedAt: 1_758_000_600_000 });

    expect(assign).toHaveBeenCalledTimes(1);
    expect(String(assign.mock.calls[0]?.[0])).toBe("https://app.test/home");
    expect(window.sessionStorage.getItem("lf:account-switched")).toBe("1");
    expect(reload).not.toHaveBeenCalled();
  });

  it("notices the switch when the tab is looked at, if it missed the message", () => {
    render();
    marker.value = { userId: "grace", issuedAt: 1_758_000_600_000 };

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("notices the switch when the browser restores the page from its cache", () => {
    render();
    marker.value = { userId: "grace", issuedAt: 1_758_000_600_000 };

    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });

    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("still moves when the session answer already names the new account", () => {
    const view = render();
    marker.value = { userId: "grace", issuedAt: 1_758_000_600_000 };

    view.rerender(
      <ToastProvider>
        <AccountSwitch vaultUserId="grace" mountedMarker={ada} expired={false} />
      </ToastProvider>,
    );

    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("never moves a page whose marker has not changed since it loaded", () => {
    renderWithProviders(
      <ToastProvider>
        <AccountSwitch vaultUserId="grace" mountedMarker={ada} expired={false} />
      </ToastProvider>,
    );
    act(() => {
      tabChannel.emitLocal({ type: "session:signedIn" });
      window.dispatchEvent(new Event("focus"));
    });

    expect(assign).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("leaves only once, however many signals arrive", () => {
    render();

    signInElsewhere({ userId: "grace", issuedAt: 1_758_000_600_000 });
    act(() => {
      window.dispatchEvent(new Event("focus"));
      tabChannel.emitLocal({ type: "session:signedIn" });
    });

    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("brings a tab with a dead session back to life when the same person signs in again", () => {
    render({ expired: true });

    signInElsewhere({ userId: "ada", issuedAt: 1_758_000_600_000 });

    expect(reload).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("lf:account-switched")).toBeNull();
  });

  it("does nothing to a live tab when the same person signs in again", () => {
    render();

    signInElsewhere({ userId: "ada", issuedAt: 1_758_000_600_000 });

    expect(reload).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("does nothing when another tab signs out: that is the logout's message", () => {
    render();

    marker.value = null;
    act(() => {
      tabChannel.emitLocal({ type: "session:signedIn" });
      window.dispatchEvent(new Event("focus"));
    });

    expect(assign).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("does nothing while it still does not know whose copy it shows", () => {
    render({ vaultUserId: null });

    signInElsewhere({ userId: "grace", issuedAt: 1_758_000_600_000 });

    expect(assign).not.toHaveBeenCalled();
  });

  it("says why on the screen it lands on, once", async () => {
    noteAccountSwitched();
    marker.value = { userId: "grace", issuedAt: 1_758_000_600_000 };

    renderWithProviders(
      <ToastProvider>
        <AccountSwitch vaultUserId="grace" mountedMarker={marker.value} expired={false} />
      </ToastProvider>,
    );

    expect(await screen.findByText("Another account signed in on this browser")).toBeVisible();
    expect(window.sessionStorage.getItem("lf:account-switched")).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });
});
