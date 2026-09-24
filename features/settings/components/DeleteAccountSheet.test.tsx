import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError } from "@/lib/api/errors";
import { renderWithProviders } from "@/lib/testing/render";

import { DeleteAccountSheet } from "./SettingsSheets";

const wrongPassword = new ApiError({
  status: 401,
  code: "CURRENT_PASSWORD_INVALID",
  message: "Current password is incorrect",
  requestId: "r1",
});

function renderSheet(props: Partial<Parameters<typeof DeleteAccountSheet>[0]> = {}) {
  const onConfirm = vi.fn();
  renderWithProviders(
    <DeleteAccountSheet
      open
      onClose={vi.fn()}
      pending={false}
      error={null}
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onConfirm, dialog: screen.getByRole("dialog", { name: "Delete my account" }) };
}

describe("DeleteAccountSheet", () => {
  it("asks for the current password and sends it, from the button or with Enter", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderSheet();
    const confirm = screen.getByRole("button", { name: "Delete account" });
    expect(confirm).toBeDisabled();

    const password = screen.getByLabelText("Current password");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    await user.type(password, "LedgerFlow!2026");
    await user.click(confirm);
    expect(onConfirm).toHaveBeenLastCalledWith("LedgerFlow!2026");

    await user.type(password, "{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("says a wrong password once, under the field", () => {
    const { dialog } = renderSheet({ error: wrongPassword });
    expect(screen.getByLabelText("Current password")).toHaveAccessibleDescription(
      /Your current password is wrong\./,
    );
    expect(within(dialog).getAllByText("Your current password is wrong.")).toHaveLength(1);
  });

  it("shows any other failure as an alert of its own", () => {
    const { dialog } = renderSheet({
      error: new ApiError({ status: 500, code: null, message: "boom", requestId: "r2" }),
    });
    expect(screen.queryByText("Your current password is wrong.")).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole("alert")).toHaveLength(2);
  });

  it("does not send anything offline", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderSheet({ offline: true });
    await user.type(screen.getByLabelText("Current password"), "LedgerFlow!2026{Enter}");
    expect(screen.getByRole("button", { name: "Delete account" })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
