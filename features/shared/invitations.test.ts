import type { SentInvitation } from "@/types/api";

import { inviteStateOf, latestByContact } from "./invitations";

const NOW = Date.parse("2026-09-22T12:00:00.000Z");

const invitation = (overrides: Partial<SentInvitation> = {}): SentInvitation => ({
  id: "i1",
  groupId: "g1",
  contactId: "c1",
  email: "beto@example.com",
  status: "PENDING",
  expiresAt: "2026-10-22T12:00:00.000Z",
  answeredAt: null,
  withdrawnAt: null,
  leftAt: null,
  createdAt: "2026-09-22T11:00:00.000Z",
  updatedAt: "2026-09-22T11:00:00.000Z",
  ...overrides,
});

describe("inviteStateOf", () => {
  it("asks for an email before anything else can be sent", () => {
    expect(inviteStateOf(undefined, undefined, NOW).state).toBe("noEmail");
  });

  it("reads a withdrawn invitation as never sent", () => {
    expect(inviteStateOf("beto@example.com", invitation({ status: "WITHDRAWN" }), NOW).state).toBe(
      "notInvited",
    );
  });

  it("waits while the date is ahead, and runs out after it", () => {
    expect(inviteStateOf("beto@example.com", invitation(), NOW).state).toBe("waiting");
    expect(
      inviteStateOf("beto@example.com", invitation({ expiresAt: "2026-09-22T11:59:59.000Z" }), NOW)
        .state,
    ).toBe("expired");
  });

  it("keeps somebody who joined as joined even after their email was cleared", () => {
    expect(inviteStateOf(undefined, invitation({ status: "ACCEPTED" }), NOW).state).toBe("joined");
  });

  it("says a declined invitation was declined", () => {
    expect(inviteStateOf("beto@example.com", invitation({ status: "DECLINED" }), NOW).state).toBe(
      "declined",
    );
  });
});

describe("latestByContact", () => {
  it("keeps the newest invitation of each person", () => {
    const old = invitation({ id: "old", status: "DECLINED" });
    const next = invitation({ id: "new", createdAt: "2026-09-22T11:30:00.000Z" });
    const other = invitation({ id: "other", contactId: "c2" });

    const latest = latestByContact([next, old, other]);

    expect(latest.get("c1")?.id).toBe("new");
    expect(latest.get("c2")?.id).toBe("other");
  });

  it("reads somebody who left as a person you can invite again, while they have an email", () => {
    const left = invitation({ status: "LEFT", leftAt: "2026-09-23T10:00:00.000Z" });

    expect(inviteStateOf("beto@example.com", left, NOW)).toEqual({
      state: "left",
      invitation: left,
    });
    expect(inviteStateOf(undefined, left, NOW).state).toBe("noEmail");
  });
});
