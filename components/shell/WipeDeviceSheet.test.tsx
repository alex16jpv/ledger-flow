import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { setCurrentVault } from "@/lib/local/repository";
import type { OutboxOperation } from "@/lib/local/schema";
import { renderWithProviders } from "@/lib/testing/render";
import { openTestVault, wipeVaults } from "@/lib/testing/vault";

import { WipeDeviceSheet } from "./WipeDeviceSheet";

const operation = (seq: number): OutboxOperation => ({
  seq,
  opId: `op-${seq}`,
  opVersion: 1,
  entity: "transaction",
  entityId: `t${seq}`,
  action: "create",
  occurredAt: "2026-09-26T10:00:00.000Z",
  payload: { amount: 12.5 },
  dependsOn: [],
  status: "pending",
  attempts: 0,
  lastError: null,
});

async function queue(userId: string, count: number): Promise<void> {
  const vault = await openTestVault(userId);
  for (let seq = 1; seq <= count; seq += 1) await vault.db.put("outbox", operation(seq));
  vault.close();
}

afterEach(async () => {
  setCurrentVault(null);
  await wipeVaults();
});

const view = (onConfirm = vi.fn()) => {
  renderWithProviders(
    <WipeDeviceSheet open pending={2} onCancel={vi.fn()} onConfirm={onConfirm} />,
  );
  return onConfirm;
};

describe("WipeDeviceSheet", () => {
  it("counts the changes another account left waiting here, and says so", async () => {
    await queue("u1", 3);
    setCurrentVault(await openTestVault("me"));

    view();

    expect(
      await screen.findByText(/It also deletes 3 unsent changes from another account/),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 changes that only exist here/)).toBeInTheDocument();
  });

  it("adds nothing when only this account's work is on the device", async () => {
    setCurrentVault(await openTestVault("me"));

    const onConfirm = view();
    await userEvent.click(await screen.findByRole("button", { name: "Delete everything" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByText(/from another account/)).not.toBeInTheDocument();
  });

  it("never counts this account's own queue twice", async () => {
    await queue("me", 2);
    setCurrentVault(await openTestVault("me"));

    view();

    await screen.findByRole("button", { name: "Delete everything" });
    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete everything" })).toBeEnabled();
    });
    expect(screen.queryByText(/from another account/)).not.toBeInTheDocument();
  });
});
