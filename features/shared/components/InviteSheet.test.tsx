import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import { contact, sentInvitation, sharedGroup } from "@/lib/testing/vault";
import type { SentInvitation } from "@/types/api";

import { InviteSheet } from "./InviteSheet";

const ANA = "k1";
const BETO = "k2";
const LUCIA = "k3";
const fetchMock = vi.fn<typeof fetch>();

const group = sharedGroup({
  id: "g1",
  name: "Cartagena trip",
  participants: [
    { contactId: null, addedAt: "2026-08-01T00:00:00.000Z" },
    { contactId: ANA, addedAt: "2026-08-01T00:00:00.000Z" },
    { contactId: BETO, addedAt: "2026-08-01T00:00:00.000Z" },
    { contactId: LUCIA, addedAt: "2026-08-01T00:00:00.000Z" },
  ],
});

const people = new Map([
  [ANA, contact({ id: ANA, name: "Ana Ruiz", email: "ana@example.com" })],
  [BETO, contact({ id: BETO, name: "Beto Cano", email: "beto@example.com" })],
  [LUCIA, contact({ id: LUCIA, name: "Lucía Mesa" })],
]);

const page = (data: unknown[]) =>
  json({
    data,
    pagination: { limit: 100, offset: 0, total: data.length, hasMore: false, nextCursor: null },
  });

const joined = sentInvitation({
  id: "i-ana",
  contactId: ANA,
  email: "ana@example.com",
  status: "ACCEPTED",
  answeredAt: "2026-09-19T10:00:00.000Z",
});

function serve(rows: SentInvitation[]) {
  const calls: { url: string; method: string }[] = [];
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method });
    if (method === "POST") {
      return Promise.resolve(
        json(sentInvitation({ id: "i-beto", contactId: BETO, email: "beto@example.com" }), {
          status: 201,
        }),
      );
    }
    if (method === "DELETE") {
      return Promise.resolve(json({ ...joined, status: "WITHDRAWN" }));
    }
    return Promise.resolve(page(rows));
  });
  return calls;
}

const view = () =>
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <InviteSheet open group={group} contacts={people} onClose={vi.fn()} />
      </ToastProvider>
    </QueryProvider>,
  );

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  connectivityStore.reset();
  vi.unstubAllGlobals();
});

const rowOf = async (name: string): Promise<HTMLElement> => {
  const row = (await screen.findByText(name)).closest<HTMLElement>("div[class*='min-h-']");
  if (!row) throw new Error(`No row for ${name}`);
  return row;
};

describe("InviteSheet", () => {
  it("says where each person stands, and what joining shows", async () => {
    serve([joined]);
    view();

    expect(await screen.findByText(/never your accounts, categories or notes/)).toBeInTheDocument();
    const ana = await rowOf("Ana Ruiz");
    await within(ana).findByText("Joined");
    expect(within(ana).getByRole("button", { name: "Stop sharing" })).toBeEnabled();
    const beto = await rowOf("Beto Cano");
    expect(beto).toHaveTextContent("beto@example.com · not invited");
    expect(within(beto).getByRole("button", { name: "Invite" })).toBeEnabled();
    const lucia = await rowOf("Lucía Mesa");
    expect(lucia).toHaveTextContent("No email yet");
    expect(within(lucia).getByRole("button", { name: "Add email" })).toBeEnabled();
    expect(screen.getByText(/can be waiting at once/)).toBeInTheDocument();
  });

  it("invites, and says the other side is never told apart", async () => {
    const user = userEvent.setup();
    const calls = serve([joined]);
    view();

    const beto = await rowOf("Beto Cano");
    await user.click(within(beto).getByRole("button", { name: "Invite" }));

    expect(await screen.findByText(/you are not told which/)).toBeInTheDocument();
    expect(calls).toContainEqual({ url: "/api/shared-groups/g1/invitations", method: "POST" });
  });

  it("asks before it stops sharing, and says the money does not move", async () => {
    const user = userEvent.setup();
    const calls = serve([joined]);
    view();

    const ana = await rowOf("Ana Ruiz");
    await user.click(await within(ana).findByRole("button", { name: "Stop sharing" }));

    const sheet = await screen.findByRole("dialog", { name: "Stop sharing with Ana Ruiz?" });
    expect(sheet).toHaveTextContent("Nothing about the money changes");
    await user.click(within(sheet).getByRole("button", { name: "Stop sharing" }));

    await vi.waitFor(() => {
      expect(calls).toContainEqual({
        url: "/api/shared-groups/g1/invitations/i-ana",
        method: "DELETE",
      });
    });
  });

  it("offers withdrawing a waiting one, and inviting again once it ran out", async () => {
    serve([
      sentInvitation({ id: "i-b", contactId: BETO }),
      sentInvitation({
        id: "i-a",
        contactId: ANA,
        email: "ana@example.com",
        expiresAt: "2020-01-01T00:00:00.000Z",
      }),
    ]);
    view();

    const beto = await rowOf("Beto Cano");
    expect(await within(beto).findByRole("button", { name: "Withdraw" })).toBeEnabled();
    const ana = await rowOf("Ana Ruiz");
    expect(await within(ana).findByRole("button", { name: "Invite again" })).toBeEnabled();
    expect(ana).toHaveTextContent("not answered in 30 days");
  });

  it("needs a connection to invite, but not to add an email", async () => {
    serve([]);
    reportOnline(false);
    view();

    const beto = await rowOf("Beto Cano");
    expect(within(beto).getByRole("button", { name: "Invite" })).toBeDisabled();
    const lucia = await rowOf("Lucía Mesa");
    expect(within(lucia).getByRole("button", { name: "Add email" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Inviting needs a connection");
  });
});
