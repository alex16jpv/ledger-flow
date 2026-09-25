import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderOnServer, renderWithProviders } from "@/lib/testing/render";

import { CurrencyPicker } from "./CurrencyPicker";

const picker = <CurrencyPicker value={null} onChange={vi.fn()} label="Currency" hint="Pick one" />;

describe("CurrencyPicker", () => {
  it("leaves the currency list out of the server render, whose Intl data is not the browser's", () => {
    const html = renderOnServer(picker);
    expect(html).toContain("Currency");
    expect(html).not.toContain("COP · ");
  });

  it("lists the currencies once it runs in the browser", async () => {
    renderWithProviders(picker);
    await userEvent.click(screen.getByRole("button", { name: /Pick one/ }));
    expect(await screen.findByText(/^COP · /)).toBeInTheDocument();
  });
});
