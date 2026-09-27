import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type * as Flags from "@/lib/flags";
import type { FeatureFlag } from "@/lib/flags";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { confirmEmailStore } from "@/lib/session/confirm-email";
import { SessionProvider } from "@/lib/session/SessionProvider";
import { renderWithProviders } from "@/lib/testing/render";
import type { User } from "@/types/api";

import { ProfileView } from "./ProfileView";

vi.mock("@/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof Flags>();
  return {
    ...actual,
    isEnabled: (flag: FeatureFlag) => flag === "emailVerification" || actual.isEnabled(flag),
  };
});

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const user: User = {
  id: "u1",
  name: "Ana",
  email: "ana@ledgerflow.test",
  emailVerified: true,
  timezone: "America/Bogota",
  currency: "COP",
  locale: "en",
  lastLoginAt: null,
  keepOrStartFresh: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function renderView(onSaved = vi.fn(), shown: User = user) {
  renderWithProviders(
    <QueryProvider>
      <SessionProvider onSignedOut={vi.fn()}>
        <ProfileView user={shown} onSaved={onSaved} />
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
  confirmEmailStore.reset();
  vi.unstubAllGlobals();
});

describe("ProfileView", () => {
  it("marks an email not confirmed beside its label, and opens the code sheet from its help", async () => {
    renderView(vi.fn(), { ...user, emailVerified: false });
    expect(screen.getByText("Not confirmed")).toBeInTheDocument();
    expect(screen.getByText(/Confirm it to invite people to Shared/)).toBeInTheDocument();
    expect(screen.queryByText("Changing it signs out your other devices.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm it" }));
    expect(confirmEmailStore.getSnapshot().sheetOpen).toBe(true);
  });

  it("tells the screen which address a new email went to", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      const moved = { ...user, email: "new@ledgerflow.test", emailVerified: false };
      if (url.startsWith("/api/auth/me")) return Promise.resolve(json({ user: moved }));
      if (init?.method === "PUT") return Promise.resolve(json(moved));
      if (init?.method === "POST") return Promise.resolve(json({ user: moved, accessToken: "a" }));
      return Promise.resolve(json({}));
    });
    const onSaved = renderView();
    const email = screen.getByLabelText("Email");
    await userEvent.clear(email);
    await userEvent.type(email, "new@ledgerflow.test");
    await userEvent.type(screen.getByLabelText("Current password"), "OldPass!2026");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({
        reauthenticated: true,
        newEmail: "new@ledgerflow.test",
      });
    });
  });

  it("renames without asking for the current password", async () => {
    const onSaved = renderView();
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Ana María");
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({ reauthenticated: false, newEmail: null });
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
      expect(onSaved).toHaveBeenCalledWith({ reauthenticated: true, newEmail: null });
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
