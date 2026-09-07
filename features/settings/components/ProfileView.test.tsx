import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { SessionProvider } from "@/lib/session/SessionProvider";
import { renderWithProviders } from "@/lib/testing/render";
import type { User } from "@/types/api";

import { ProfileView } from "./ProfileView";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const user: User = {
  id: "u1",
  name: "Ana",
  email: "ana@ledgerflow.test",
  timezone: "America/Bogota",
  currency: "COP",
  locale: "en",
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function renderView(onSaved = vi.fn()) {
  renderWithProviders(
    <QueryProvider>
      <SessionProvider onSignedOut={vi.fn()}>
        <ProfileView user={user} onSaved={onSaved} />
      </SessionProvider>
    </QueryProvider>,
  );
  return onSaved;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    if (url.startsWith("/api/auth/me")) return Promise.resolve(json({ user }));
    if (init?.method === "PUT") return Promise.resolve(json({ ...user, name: "Ana María" }));
    if (init?.method === "POST") return Promise.resolve(json({ user, accessToken: "a" }));
    return Promise.resolve(json({}));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProfileView", () => {
  it("renames without asking for the current password", async () => {
    const onSaved = renderView();
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Ana María");
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(false);
    });
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(put?.[1]?.body as string)).toEqual({ name: "Ana María" });
  });

  it("asks for the current password on a password change and signs in again with the new pair", async () => {
    const onSaved = renderView();
    await userEvent.type(screen.getByLabelText(/^New password/), "Str0ngPass!");
    expect(screen.getByText(/confirm your current password/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("This field is required.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Current password"), "OldPass!2026");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(true);
    });
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(put?.[1]?.body as string)).toEqual({
      name: "Ana",
      password: "Str0ngPass!",
      currentPassword: "OldPass!2026",
    });
    const login = fetchMock.mock.calls.find(
      ([input, init]) => init?.method === "POST" && urlOf(input) === "/api/auth/login",
    );
    expect(JSON.parse(login?.[1]?.body as string)).toEqual({
      email: "ana@ledgerflow.test",
      password: "Str0ngPass!",
    });
  });

  it("shows a wrong current password under its field", async () => {
    fetchMock.mockImplementation((input, init) => {
      if (urlOf(input).startsWith("/api/auth/me")) return Promise.resolve(json({ user }));
      if (init?.method === "PUT")
        return Promise.resolve(
          json({ code: "CURRENT_PASSWORD_INVALID", message: "nope" }, { status: 401 }),
        );
      return Promise.resolve(json({}));
    });
    renderView();
    await userEvent.type(screen.getByLabelText("Email"), "x");
    await userEvent.type(screen.getByLabelText("Current password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Your current password is wrong.")).toBeInTheDocument();
  });
});
