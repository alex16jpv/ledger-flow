import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/Toast";
import { reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import type { EmailChange } from "@/types/api";

import { PendingEmailCard } from "./PendingEmailCard";

const token = vi.fn<() => Promise<string>>();
vi.mock("@/lib/captcha/useHumanCheck", () => ({
  useHumanCheck: () => ({ mount: vi.fn(), interactive: false, token }),
  HumanCheckSlot: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const fetchMock = vi.fn<typeof fetch>();
const change: EmailChange = {
  email: "new@ledgerflow.test",
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  resendAvailableAt: null,
};

const failure = (code: string, status: number) =>
  json({ error: "Error", message: code, code }, { status });

function renderCard(answer: () => Response) {
  fetchMock.mockImplementation((input) =>
    Promise.resolve(urlOf(input) === "/api/auth/change-email/resend" ? answer() : json({})),
  );
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <PendingEmailCard emailChange={change} currentEmail="ana@ledgerflow.test" />
      </ToastProvider>
    </QueryProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  token.mockReset().mockResolvedValue("captcha-token");
  vi.stubGlobal("fetch", fetchMock);
  reportOnline(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PendingEmailCard", () => {
  it("resends to the address that waits with Cloudflare's check", async () => {
    renderCard(() => json({ resendAfterSeconds: 60, emailChange: change }, { status: 202 }));
    await userEvent.click(screen.getByRole("button", { name: "Resend" }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([input]) => urlOf(input) === "/api/auth/change-email/resend",
      );
      expect(JSON.parse(call?.[1]?.body as string)).toEqual({ captcha: "captcha-token" });
    });
  });

  it("says an address that takes none of our email above its buttons", async () => {
    renderCard(() => failure("EMAIL_SEND_FAILED", 422));
    await userEvent.click(screen.getByRole("button", { name: "Resend" }));
    expect(
      await screen.findByText("We can’t send email to this address. Check it, or use another one."),
    ).toBeInTheDocument();
  });

  it("says when nothing waits any more", async () => {
    renderCard(() => failure("EMAIL_CHANGE_NOT_PENDING", 409));
    await userEvent.click(screen.getByRole("button", { name: "Resend" }));
    expect(
      await screen.findByText(/This change isn’t waiting any more: it was confirmed/),
    ).toBeInTheDocument();
  });

  it("sends nothing when Cloudflare's check fails", async () => {
    token.mockRejectedValueOnce(new Error("blocked"));
    renderCard(() => json({}));
    await userEvent.click(screen.getByRole("button", { name: "Resend" }));
    expect(await screen.findByText("We couldn’t check that you’re a person.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("waits out a limit on Resend with the countdown on its button", async () => {
    renderCard(
      () =>
        new Response(JSON.stringify({ error: "Too many", code: "RATE_LIMITED" }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "42" },
        }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Resend" }));
    expect(await screen.findByRole("button", { name: /Resend in 0:4\d/ })).toBeDisabled();
  });

  it("says a Cancel that failed, and keeps the card", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json({ error: "Down", message: "down", code: "DB_UNAVAILABLE" }, { status: 503 }),
      ),
    );
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <PendingEmailCard emailChange={change} currentEmail="ana@ledgerflow.test" />
        </ToastProvider>
      </QueryProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel change" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Waiting for confirmation at/)).toBeInTheDocument();
  });

  it("keeps its buttons off without a connection", () => {
    reportOnline(false);
    renderCard(() => json({}));
    expect(screen.getByRole("button", { name: "Enter code" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Resend" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel change" })).toBeDisabled();
  });
});
