import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { activateWaitingWorker } from "@/lib/pwa/registration";
import { dismissUpdate, reportUpdateWaiting, updateStore } from "@/lib/pwa/update";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { SessionProvider } from "@/lib/session/SessionProvider";
import { renderWithProviders } from "@/lib/testing/render";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import { SettingsHub } from "./SettingsHub";

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/settings",
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/pwa/registration", () => ({ activateWaitingWorker: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            user: { id: "u1", name: "John", locale: "en", createdAt: "2026-08-01T10:00:00.000Z" },
          }),
          {
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    ),
  );
});

afterEach(() => {
  updateStore.reset();
  vi.mocked(activateWaitingWorker).mockReset();
  vi.unstubAllGlobals();
});

const view = () =>
  renderWithProviders(
    <QueryProvider>
      <SessionProvider onSignedOut={vi.fn()}>
        <ThemeProvider>
          <ToastProvider>
            <SettingsHub />
          </ToastProvider>
        </ThemeProvider>
      </SessionProvider>
    </QueryProvider>,
  );

describe("Settings › Version", () => {
  it("shows the version with nothing to do while no new one is waiting", async () => {
    view();
    expect(await screen.findByText("Version")).toBeInTheDocument();
    expect(screen.queryByText(/a new version is ready/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reload" })).not.toBeInTheDocument();
  });

  // T-196: the stripe can be put away, so this row is where the new version is never hidden.
  it("offers the new version even after its stripe was put away", async () => {
    view();
    act(() => {
      reportUpdateWaiting();
      dismissUpdate();
    });

    expect(await screen.findByText(/a new version is ready/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => {
      expect(activateWaitingWorker).toHaveBeenCalledTimes(1);
    });
  });
});
