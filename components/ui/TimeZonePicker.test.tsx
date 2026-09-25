import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderOnServer, renderWithProviders } from "@/lib/testing/render";

import { TimeZonePicker } from "./TimeZonePicker";

const picker = <TimeZonePicker value={null} onChange={vi.fn()} label="Time zone" hint="Pick one" />;

describe("TimeZonePicker", () => {
  it("leaves the zone list out of the server render, whose Intl data is not the browser's", () => {
    const html = renderOnServer(picker);
    expect(html).toContain("Time zone");
    expect(html).not.toContain("America/Bogota");
  });

  it("lists the zones once it runs in the browser", async () => {
    renderWithProviders(picker);
    await userEvent.click(screen.getByRole("button", { name: /Pick one/ }));
    expect(await screen.findByText("America/Bogota")).toBeInTheDocument();
  });
});
