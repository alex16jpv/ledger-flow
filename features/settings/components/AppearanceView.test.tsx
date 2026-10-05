import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { SessionProvider } from "@/lib/session/SessionProvider";
import { renderWithProviders } from "@/lib/testing/render";
import { ThemeProvider, themeStore, unsentTheme } from "@/lib/theme";

import { AppearanceView } from "./AppearanceView";

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/settings/appearance",
  Link: ({ children }: { children: unknown }) => children,
}));

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();

function renderView() {
  return renderWithProviders(
    <QueryProvider>
      <ThemeProvider>
        <SessionProvider onSignedOut={vi.fn()}>
          <AppearanceView />
        </SessionProvider>
      </ThemeProvider>
    </QueryProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  themeStore.reset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    json({ user: { id: "u1", name: "John", locale: "en", theme: null } }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppearanceView", () => {
  it("applies a new mode here at once and keeps it to send to the account", async () => {
    renderView();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.anything());
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await userEvent.click(screen.getByRole("button", { name: /Dark/ }));

    expect(themeStore.getSnapshot()).toEqual({ palette: "brisa", mode: "dark" });
    expect(unsentTheme.read("u1")).toEqual({ palette: "brisa", mode: "dark" });
  });

  it("keeps nothing to send when the palette picked is the one already showing", async () => {
    renderView();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.anything());
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await userEvent.click(screen.getByRole("button", { name: /Brisa/ }));

    expect(unsentTheme.read("u1")).toBeNull();
  });

  it("keeps a choice made before the profile arrives for the signed-in user", async () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
    vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-session=u7.1000");
    renderView();

    await userEvent.click(screen.getByRole("button", { name: /Tinta/ }));

    expect(themeStore.getSnapshot()).toEqual({ palette: "tinta", mode: "system" });
    expect(unsentTheme.read("u7")).toEqual({ palette: "tinta", mode: "system" });
    vi.restoreAllMocks();
  });
});
