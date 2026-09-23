import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import { receivedInvitation } from "@/lib/testing/vault";
import type { ReceivedInvitation } from "@/types/api";

import { InvitationsBlock } from "./InvitationsBlock";

const fetchMock = vi.fn<typeof fetch>();

const page = (data: unknown[]) =>
  json({
    data,
    pagination: { limit: 100, offset: 0, total: data.length, hasMore: false, nextCursor: null },
  });

function serve(rows: ReceivedInvitation[], answer?: (url: string) => Response) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    if (init?.method === "POST" && answer) return Promise.resolve(answer(url));
    return Promise.resolve(page(rows));
  });
}

const view = () =>
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <InvitationsBlock />
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

describe("InvitationsBlock", () => {
  it("draws nothing when nothing waits", async () => {
    serve([]);
    view();

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole("region", { name: "Invitations" })).not.toBeInTheDocument();
  });

  it("shows only the group's name and who sent it, with the two answers and the count", async () => {
    serve([receivedInvitation()]);
    view();

    const section = await screen.findByRole("region", { name: "Invitations" });
    expect(section).toHaveTextContent("Ana Ruiz invited you to Villa de Leyva weekend");
    expect(section).toHaveTextContent("ana@example.com");
    expect(within(section).getByText("1 waiting")).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Decline" })).toBeEnabled();
    expect(within(section).getByRole("button", { name: "Accept" })).toBeEnabled();
  });

  it("leaves out one that ran out or stopped waiting", async () => {
    serve([
      receivedInvitation({
        id: "old",
        groupName: "Old trip",
        expiresAt: "2020-01-01T00:00:00.000Z",
      }),
      receivedInvitation({ id: "gone", groupName: "Withdrawn trip", status: "WITHDRAWN" }),
      receivedInvitation({ id: "open" }),
    ]);
    view();

    const section = await screen.findByRole("region", { name: "Invitations" });
    expect(within(section).getAllByRole("button", { name: "Accept" })).toHaveLength(1);
    expect(section).not.toHaveTextContent("Old trip");
    expect(section).not.toHaveTextContent("Withdrawn trip");
  });

  it("answers in place, and keeps the row saying how it ended", async () => {
    const user = userEvent.setup();
    serve([receivedInvitation()], (url) => {
      expect(url).toContain("/invitations/r1/accept");
      return json(receivedInvitation({ status: "ACCEPTED", answeredAt: new Date().toISOString() }));
    });
    view();

    await user.click(await screen.findByRole("button", { name: "Accept" }));

    const section = await screen.findByRole("region", { name: "Invitations" });
    expect(await within(section).findByText("Joined")).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  });

  it("says no longer available when it stopped waiting before the answer landed", async () => {
    const user = userEvent.setup();
    serve([receivedInvitation()], () =>
      json(
        { error: "BadRequestError", message: "gone", code: "INVITATION_UNAVAILABLE" },
        { status: 400 },
      ),
    );
    view();

    await user.click(await screen.findByRole("button", { name: "Decline" }));

    expect(await screen.findByText("No longer available")).toBeInTheDocument();
  });

  it("offers only Decline for a group in another currency", async () => {
    serve([receivedInvitation({ groupCurrency: "EUR" })]);
    view();

    const section = await screen.findByRole("region", { name: "Invitations" });
    expect(section).toHaveTextContent("this group is in EUR and your Ledger Flow is in COP");
    expect(within(section).getByRole("button", { name: "Decline" })).toBeEnabled();
    expect(within(section).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  });

  it("shows them offline but waits for a connection to answer", async () => {
    serve([receivedInvitation()]);
    reportOnline(false);
    view();

    expect(await screen.findByRole("button", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Answering needs a connection");
  });

  it("reads an invitation the server no longer finds as gone, not as an error", async () => {
    const user = userEvent.setup();
    serve([receivedInvitation()], () =>
      json({ error: "NotFoundError", message: "x", code: "NOT_FOUND" }, { status: 404 }),
    );
    view();

    await user.click(await screen.findByRole("button", { name: "Accept" }));

    expect(await screen.findByText("No longer available")).toBeInTheDocument();
  });

  it("names the invitation each answer is about", async () => {
    serve([receivedInvitation()]);
    view();

    expect(await screen.findByRole("button", { name: "Accept" })).toHaveAccessibleDescription(
      "Ana Ruiz invited you to Villa de Leyva weekend",
    );
  });
});
