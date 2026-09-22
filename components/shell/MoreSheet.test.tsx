import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/lib/testing/render";

import { MoreSheet } from "./MoreSheet";

let pathname = "/home";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => pathname,
}));

beforeEach(() => {
  pathname = "/home";
});

const view = (overrides: Partial<Parameters<typeof MoreSheet>[0]> = {}) => {
  const props = {
    open: true,
    onClose: vi.fn(),
    userName: "John Doe",
    userEmail: "john@example.com",
    accountCount: 4,
    categoryCounts: { active: 13, archived: 1 },
    ...overrides,
  };
  renderWithProviders(<MoreSheet {...props} />);
  return props;
};

describe("MoreSheet", () => {
  // T-72: below 900px these four have no other way in, which is the whole point of the sheet.
  it("holds everything the phone's bar cannot, and the user", () => {
    view();

    expect(screen.getByRole("dialog", { name: "More" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Accounts/ })).toHaveAttribute("href", "/accounts");
    expect(screen.getByRole("link", { name: /Stats/ })).toHaveAttribute("href", "/stats");
    expect(screen.getByRole("link", { name: /Categories/ })).toHaveAttribute("href", "/categories");
    expect(screen.getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: /John Doe/ })).toHaveAttribute("href", "/settings");
  });

  it("says how many accounts and categories there are", () => {
    view();

    expect(screen.getByText("4 accounts")).toBeInTheDocument();
    expect(screen.getByText("13 active · 1 archived")).toBeInTheDocument();
  });

  it("says an invitation is waiting on the Shared row, before what people owe", () => {
    view({ owedToYou: 552_600, invitations: 2 });

    const shared = screen.getByRole("link", { name: /Shared/ });
    expect(shared).toHaveTextContent("2 invitations waiting for you");
    expect(shared).toHaveTextContent("2 waiting");
    expect(shared).not.toHaveTextContent("owed to you");
  });

  it("says nothing about a count it does not have yet", () => {
    view({ accountCount: undefined, categoryCounts: undefined });

    expect(screen.queryByText("4 accounts")).not.toBeInTheDocument();
    expect(screen.queryByText("13 active · 1 archived")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Accounts" })).toBeInTheDocument();
  });

  it("marks the destination the screen underneath is already on", () => {
    pathname = "/stats/trends";
    view();

    expect(screen.getByRole("link", { name: /Stats/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Categories/ })).not.toHaveAttribute("aria-current");
  });

  // The shell outlives the route, so a sheet left open would sit on top of where it just went.
  it("closes itself when a destination is taken", async () => {
    const props = view();

    await userEvent.click(screen.getByRole("link", { name: /Stats/ }));

    expect(props.onClose).toHaveBeenCalled();
  });

  it("drops the user row when no name is known yet", () => {
    view({ userName: "" });

    expect(screen.queryByText("john@example.com")).not.toBeInTheDocument();
  });
});
