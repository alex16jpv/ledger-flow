import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";

import { Amount } from "./Amount";

describe("Amount", () => {
  it("prefixes the sign of the flow type and dims the symbol", () => {
    renderWithProviders(<Amount value={48200} />);
    expect(screen.getByText(/48,200/).textContent).toBe("−$48,200");
  });

  it("keeps the symbol and the decimals in the figure's colour when asked not to mute them", () => {
    renderWithProviders(<Amount value={12.5} kind="income" mutedParts={false} />, {
      currency: "USD",
    });
    const figure = screen.getByText(/12/);
    expect(figure).toHaveClass("text-income");
    expect(figure.querySelector(".text-text-3")).toBeNull();
  });

  it("formats income in Spanish with the decimal comma", () => {
    renderWithProviders(<Amount value={12.5} kind="income" />, { locale: "es", currency: "USD" });
    expect(screen.getByText(/12/).textContent?.replace(/\s/g, "")).toBe("+$12,50");
  });
});
