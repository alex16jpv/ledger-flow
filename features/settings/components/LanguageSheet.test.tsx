import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { SessionProvider } from "@/lib/session/SessionProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { LanguageSheet } from "./LanguageSheet";

const replace = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/settings",
  Link: ({ children }: { children: unknown }) => children,
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  window.localStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LanguageSheet", () => {
  it("marks the current language and switches to Spanish through the API and the router", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "/api/auth/me") {
        return Promise.resolve(json({ user: { id: "u1", name: "John", locale: "en" } }));
      }
      if (url === "/api/users/u1" && init?.method === "PUT") {
        return Promise.resolve(json({ id: "u1", name: "John", locale: "es" }));
      }
      return Promise.resolve(json({ error: "x", message: "unexpected" }, { status: 500 }));
    });
    const onClose = vi.fn();
    renderWithProviders(
      <QueryProvider>
        <SessionProvider onSignedOut={vi.fn()}>
          <LanguageSheet open onClose={onClose} />
        </SessionProvider>
      </QueryProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /English/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
    await userEvent.click(screen.getByRole("option", { name: /Español/ }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/settings", { locale: "es" });
    });
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(put?.[1]?.body).toBe(JSON.stringify({ locale: "es" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("stores the device mode without calling the API when the device already matches", async () => {
    fetchMock.mockResolvedValue(json({ user: { id: "u1", name: "John", locale: "en" } }));
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
    const onClose = vi.fn();
    renderWithProviders(
      <QueryProvider>
        <SessionProvider onSignedOut={vi.fn()}>
          <LanguageSheet open onClose={onClose} />
        </SessionProvider>
      </QueryProvider>,
    );
    await userEvent.click(await screen.findByRole("option", { name: /Follow device/ }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(window.localStorage.getItem("lf.localeMode")).toBe("device");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
    vi.restoreAllMocks();
  });
});
