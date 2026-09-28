import { screen, waitFor } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";

import { RateLimitAlert } from "./RateLimitAlert";

describe("RateLimitAlert", () => {
  it("counts down the wait the server gave, and says when it is over", async () => {
    const onExpire = vi.fn();
    renderWithProviders(<RateLimitAlert retryAfterSeconds={1} onExpire={onExpire} />);
    expect(screen.getByText("Too many attempts.")).toBeInTheDocument();
    expect(screen.getByText("You can try again in 0:01.")).toBeInTheDocument();
    await waitFor(
      () => {
        expect(onExpire).toHaveBeenCalled();
      },
      { timeout: 2_500 },
    );
  });

  it("speaks of codes asked for when the limit is on requests", () => {
    renderWithProviders(
      <RateLimitAlert retryAfterSeconds={42} onExpire={vi.fn()} kind="requests" />,
    );
    expect(screen.getByText("Too many requests.")).toBeInTheDocument();
    expect(screen.getByText("You can ask for a code again in 0:42.")).toBeInTheDocument();
  });
});
