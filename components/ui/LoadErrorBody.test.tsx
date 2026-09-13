import { screen } from "@testing-library/react";

import { ApiError, NetworkError } from "@/lib/api/errors";
import { renderWithProviders } from "@/lib/testing/render";

import { LoadErrorBody } from "./LoadErrorBody";

describe("LoadErrorBody", () => {
  it("shows the request reference for API failures", () => {
    renderWithProviders(
      <LoadErrorBody
        error={new ApiError({ status: 500, code: "INTERNAL", message: "x", requestId: "req-9" })}
      />,
    );
    expect(screen.getByText(/Reference: req-9/)).toBeInTheDocument();
  });

  // H-17: with the retry no longer paused, a lost connection reaches this line, and it must say so.
  it("tells a lost connection from a server that did not answer", () => {
    const { unmount } = renderWithProviders(
      <LoadErrorBody error={new NetworkError("req-3", false)} />,
    );
    expect(screen.getByText(/You seem to be offline/i)).toBeInTheDocument();
    unmount();
    renderWithProviders(<LoadErrorBody error={new NetworkError("req-4", true)} />);
    expect(screen.getByText(/took too long/i)).toBeInTheDocument();
  });

  it("omits the reference when the error carries none", () => {
    renderWithProviders(<LoadErrorBody error={new Error("render")} />);
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });
});
