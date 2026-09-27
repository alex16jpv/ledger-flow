import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { keepLinkToken } from "../carry";
import { ResetLinkView } from "./ResetLinkView";

const replace = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/reset",
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
const TOKEN = "GtoyKT81-gDpx_56Gnr4nePZlBzP3G2U8u_tpp-zNqk";

beforeEach(() => {
  replace.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  keepLinkToken("reset", null);
  window.history.replaceState(null, "", `/reset#token=${TOKEN}`);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

function renderView() {
  renderWithProviders(
    <QueryProvider>
      <ResetLinkView />
    </QueryProvider>,
  );
}

async function save(password = "LedgerFlow!2027") {
  await userEvent.type(await screen.findByLabelText("New password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Save password and sign in" }));
}

describe("ResetLinkView", () => {
  it("takes the token out of the address bar and spends nothing on opening", async () => {
    renderView();
    await screen.findByLabelText("New password");
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/reset");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redeems the token only with the new password, asking for no email", async () => {
    renderView();
    fetchMock.mockResolvedValueOnce(json({ user: { id: "u1", keepOrStartFresh: null } }));
    await save();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith({ pathname: "/home", query: { passwordChanged: "1" } });
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(urlOf(url ?? "")).toMatch(/\/api\/auth\/reset$/);
    expect(JSON.parse(init?.body as string)).toEqual({
      token: TOKEN,
      newPassword: "LedgerFlow!2027",
    });
  });

  it("shows the dead link, with a way to a new code, when the server says so", async () => {
    renderView();
    fetchMock.mockResolvedValueOnce(json({ code: "LINK_INVALID" }, { status: 400 }));
    await save();
    expect(
      await screen.findByRole("heading", { name: "This link no longer works" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask for a new code" })).toHaveAttribute(
      "href",
      "/forgot",
    );
  });

  it("keeps the token and what was typed after a failure on our side", async () => {
    renderView();
    fetchMock.mockResolvedValueOnce(json({ code: "INTERNAL" }, { status: 500 }));
    await save();
    expect(
      await screen.findByText("Something went wrong on our side. Nothing changed: try again."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveValue("LedgerFlow!2027");
    fetchMock.mockResolvedValueOnce(json({ user: { id: "u1", keepOrStartFresh: null } }));
    await userEvent.click(screen.getByRole("button", { name: "Save password and sign in" }));
    await waitFor(() => {
      expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toMatchObject({
        token: TOKEN,
      });
    });
  });

  it("counts down a 429 with Save disabled", async () => {
    renderView();
    fetchMock.mockResolvedValueOnce(
      json({ code: "RATE_LIMITED" }, { status: 429, headers: { "retry-after": "252" } }),
    );
    await save();
    expect(await screen.findByText(/try again in 4:1\d/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save password and sign in" })).toBeDisabled();
  });

  it("says it needs a connection, with Save disabled, when offline", async () => {
    act(() => {
      reportOnline(false);
    });
    renderView();
    expect(await screen.findByText("Saving the password needs a connection.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save password and sign in" })).toBeDisabled();
    act(() => {
      reportOnline(true);
    });
  });

  it("says in its own words that a reload lost the link", async () => {
    window.history.replaceState(null, "", "/reset");
    renderView();
    expect(
      await screen.findByText("This page lost its link. Open the link from the email again."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("keeps the token across a remount, as the language chip does", async () => {
    renderView();
    await screen.findByLabelText("New password");
    document.body.innerHTML = "";
    renderView();
    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
  });
});
