import { screen } from "@testing-library/react";

import { ApiError } from "@/lib/api/errors";
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

  it("omits the reference when the error carries none", () => {
    renderWithProviders(<LoadErrorBody error={new Error("render")} />);
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });
});
