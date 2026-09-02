import { render, screen } from "@testing-library/react";

import { Alert } from "./Alert";
import { Banner } from "./Banner";
import { Empty } from "./Empty";
import { Skeleton, SkeletonRow } from "./Skeleton";

describe("Alert", () => {
  it("uses role=alert only for danger", () => {
    const { rerender } = render(<Alert tone="warning" title="Careful" />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<Alert tone="danger">Broken</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Broken");
  });
});

describe("Banner", () => {
  it("is a polite status when offline and an alert on error", () => {
    const { rerender } = render(<Banner variant="offline" title="You’re offline." />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    rerender(
      <Banner
        variant="error"
        title="1 change couldn’t sync."
        action={{ label: "Review", onClick: vi.fn() }}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
  });
});

describe("Empty and Skeleton", () => {
  it("renders the title as a heading with an optional action", () => {
    render(
      <Empty
        icon={<svg />}
        title="No transactions yet"
        body="Log your first expense."
        action={<button>Add</button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("No transactions yet");
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("skeletons are hidden from assistive tech", () => {
    const { container } = render(
      <div>
        <Skeleton className="h-3" />
        <SkeletonRow />
      </div>,
    );
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(3);
  });
});
