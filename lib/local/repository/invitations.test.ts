import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import {
  changes as feedChanges,
  openTestVault,
  profile,
  receivedInvitation,
  sentInvitation,
  wipeVaults,
} from "@/lib/testing/vault";
import type { ReceivedInvitation, SentInvitation, SyncChangesResponse } from "@/types/api";

import { pullChanges } from "../pull";
import {
  isAnswerable,
  keepReceivedInvitation,
  keepSentInvitation,
  readGroupInvitations,
  readReceivedInvitations,
} from "./invitations";
import { setCurrentVault } from "./read";

const fetchMock = vi.fn<typeof fetch>();

function feedPage(sent: SentInvitation[], received: ReceivedInvitation[]): SyncChangesResponse {
  return {
    serverTime: "2026-09-22T12:00:00.000Z",
    changes: feedChanges({ invitationsSent: sent, invitationsReceived: received }),
    pagination: {
      limit: 500,
      count: sent.length + received.length,
      hasMore: false,
      nextCursor: "v1|done|",
    },
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  setCurrentVault(null);
  connectivityStore.reset();
  vi.unstubAllGlobals();
  await wipeVaults();
});

async function mirrorOf(sent: SentInvitation[], received: ReceivedInvitation[]) {
  const vault = await openTestVault("u1");
  const result = await pullChanges(vault, {
    fetchPage: () => Promise.resolve(feedPage(sent, received)),
  });
  setCurrentVault(vault);
  reportOnline(false);
  return { vault, result };
}

describe("invitations through the mirror", () => {
  it("stores both sides of the feed as they came, and calls them news", async () => {
    const mine = sentInvitation({ id: "s1" });
    const theirs = receivedInvitation({ id: "r1" });

    const { vault, result } = await mirrorOf([mine], [theirs]);

    expect(result.changed).toBe(true);
    expect((await vault.db.get("invitationsSent", "s1"))?.row).toEqual(mine);
    expect((await vault.db.get("invitationsReceived", "r1"))?.row).toEqual(theirs);
  });

  it("reads what was received, answered ones included, without a request", async () => {
    await mirrorOf(
      [],
      [receivedInvitation({ id: "r1" }), receivedInvitation({ id: "r2", status: "DECLINED" })],
    );

    expect((await readReceivedInvitations()).map((row) => row.id)).toEqual(["r1", "r2"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads one group's invitations and no other's", async () => {
    await mirrorOf(
      [sentInvitation({ id: "s1", groupId: "g1" }), sentInvitation({ id: "s2", groupId: "g2" })],
      [],
    );

    expect((await readGroupInvitations("g1")).map((row) => row.id)).toEqual(["s1"]);
  });

  it("keeps a server answer in the copy before the next pull brings it", async () => {
    await mirrorOf([], [receivedInvitation({ id: "r1" })]);

    await keepReceivedInvitation(receivedInvitation({ id: "r1", status: "ACCEPTED" }));
    await keepSentInvitation(sentInvitation({ id: "s9", groupId: "g1" }));

    expect((await readReceivedInvitations())[0]?.status).toBe("ACCEPTED");
    expect((await readGroupInvitations("g1")).map((row) => row.id)).toEqual(["s9"]);
  });
});

describe("a new email on the profile", () => {
  it("throws away what was received and pulls everything again", async () => {
    const vault = await openTestVault("u1");
    const first: SyncChangesResponse = {
      serverTime: "2026-09-22T12:00:00.000Z",
      changes: feedChanges({
        user: profile({ email: "old@example.com" }),
        invitationsReceived: [receivedInvitation({ id: "for-old" })],
      }),
      pagination: { limit: 500, count: 2, hasMore: false, nextCursor: "v1|first|" },
    };
    await pullChanges(vault, { fetchPage: () => Promise.resolve(first) });

    const queries: (string | undefined)[] = [];
    const answers: SyncChangesResponse[] = [
      {
        serverTime: "2026-09-22T13:00:00.000Z",
        changes: feedChanges({
          user: profile({ email: "new@example.com", updatedAt: "2026-09-22T13:00:00.000Z" }),
        }),
        pagination: { limit: 500, count: 1, hasMore: false, nextCursor: "v1|second|" },
      },
      {
        serverTime: "2026-09-22T13:00:01.000Z",
        changes: feedChanges({
          user: profile({ email: "new@example.com", updatedAt: "2026-09-22T13:00:00.000Z" }),
          invitationsReceived: [receivedInvitation({ id: "for-new" })],
        }),
        pagination: { limit: 500, count: 2, hasMore: false, nextCursor: "v1|snapshot|" },
      },
    ];
    await pullChanges(vault, {
      fetchPage: (query) => {
        queries.push(query.cursor);
        const next = answers.shift();
        if (!next) throw new Error("one page too many");
        return Promise.resolve(next);
      },
    });

    expect(queries).toEqual(["v1|first|", undefined]);
    expect((await vault.db.getAll("invitationsReceived")).map((record) => record.id)).toEqual([
      "for-new",
    ]);
    expect((await vault.db.get("meta", "syncCursor"))?.value).toBe("v1|snapshot|");
  });
});

describe("isAnswerable", () => {
  const now = Date.parse("2026-09-22T12:00:00.000Z");

  it("answers only a waiting invitation whose date is still ahead", () => {
    expect(isAnswerable(receivedInvitation({ expiresAt: "2026-09-22T12:00:01.000Z" }), now)).toBe(
      true,
    );
    expect(isAnswerable(receivedInvitation({ expiresAt: "2026-09-22T12:00:00.000Z" }), now)).toBe(
      false,
    );
    expect(isAnswerable(receivedInvitation({ status: "WITHDRAWN" }), now)).toBe(false);
  });
});
