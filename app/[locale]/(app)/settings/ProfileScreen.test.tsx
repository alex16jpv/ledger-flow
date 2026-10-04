import { screen } from "@testing-library/react";

import { ToastProvider } from "@/components/ui/Toast";
import type { ProfileViewProps } from "@/features/settings/components/ProfileView";
import { renderWithProviders } from "@/lib/testing/render";

import { ProfileScreen } from "./ProfileScreen";

const saved = {
  value: { reauthenticated: false, newEmail: null as string | null, emailRefused: false },
};

vi.mock("@/features/settings/components/ProfileView", () => ({
  ProfileView: ({ onSaved }: ProfileViewProps) => (
    <button
      type="button"
      onClick={() => {
        onSaved(saved.value);
      }}
    >
      save
    </button>
  ),
}));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { id: "u1", email: "ana@ledgerflow.test" } }),
}));

vi.mock("@/lib/navigation/history", () => ({ useBackNavigation: () => vi.fn() }));

describe("ProfileScreen", () => {
  it.each([
    [
      { reauthenticated: true, newEmail: null, emailRefused: true },
      "Saved, but your email didn’t change.",
    ],
    [
      { reauthenticated: false, newEmail: "new@ledgerflow.test", emailRefused: false },
      "Check new@ledgerflow.test: your email changes once you confirm it",
    ],
    [
      { reauthenticated: true, newEmail: null, emailRefused: false },
      "Profile updated. Your other devices were signed out.",
    ],
    [{ reauthenticated: false, newEmail: null, emailRefused: false }, "Profile updated"],
  ])("says what was saved in its toast (%o)", async (value, message) => {
    saved.value = value;
    renderWithProviders(
      <ToastProvider>
        <ProfileScreen />
      </ToastProvider>,
    );
    screen.getByRole("button", { name: "save" }).click();
    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
