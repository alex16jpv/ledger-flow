import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";

import { Amount } from "./Amount";

describe("Amount", () => {
  it("prefixes the sign of the flow type and dims the symbol", () => {
    renderWithProviders(<Amount value={48200} />);
    expect(screen.getByText(/48,200/).textContent).toBe("−$48,200");
  });

  it("formats income in Spanish with the decimal comma", () => {
    renderWithProviders(<Amount value={12.5} kind="income" />, { locale: "es", currency: "USD" });
    expect(screen.getByText(/12/).textContent?.replace(/\s/g, "")).toBe("+$12,50");
  });
});
