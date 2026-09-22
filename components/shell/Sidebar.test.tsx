import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";

import { Sidebar } from "./Sidebar";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/home",
}));

describe("Sidebar", () => {
  it("counts what waits for review on Transactions and the invitations on Shared", () => {
    renderWithProviders(
      <Sidebar userName="John Doe" pendingCount={3} invitations={2} onAdd={vi.fn()} />,
    );

    expect(screen.getByRole("link", { name: /Transactions/ })).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: /Shared/ })).toHaveAccessibleName("Shared2 waiting");
  });

  it("says nothing on Shared when no invitation waits", () => {
    renderWithProviders(<Sidebar userName="John Doe" pendingCount={0} onAdd={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Shared" })).toBeInTheDocument();
  });
});
