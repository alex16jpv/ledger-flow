import { render, screen, within } from "@testing-library/react";

import type { TestLocale } from "@/lib/testing/intl-server";

import { SharedMock } from "./SharedMock";

const current = vi.hoisted((): { locale: TestLocale } => ({ locale: "en" }));

vi.mock("next-intl/server", async () =>
  (await import("@/lib/testing/intl-server")).serverIntl(() => current.locale),
);

describe("SharedMock", () => {
  it("paints the People face of Shared with the screen's own words and fixed sample people", async () => {
    current.locale = "en";
    render(await SharedMock());

    expect(screen.getByText("People")).toBeInTheDocument();
    expect(screen.getByText("Shared groups")).toBeInTheDocument();
    expect(screen.getByText("Owed to you")).toBeInTheDocument();
    expect(screen.getByText("3 people with something open · 23 contacts")).toBeInTheDocument();
    expect(screen.getByText("$552,600")).toBeInTheDocument();
    expect(screen.getAllByText("$60,000")).toHaveLength(2);

    const beto = screen.getByText("Beto Cano").closest("div");
    expect(beto).not.toBeNull();
    expect(within(beto as HTMLElement).getByText("owes you")).toBeInTheDocument();
    const diego = screen.getByText("Diego Pardo").closest("div");
    expect(within(diego as HTMLElement).getByText("you owe")).toBeInTheDocument();
    expect(within(diego as HTMLElement).getByText("Rent · September")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("follows the page's language", async () => {
    current.locale = "es";
    render(await SharedMock());

    expect(screen.getByText("Te deben")).toBeInTheDocument();
    expect(screen.getByText("Arriendo de septiembre")).toBeInTheDocument();
    expect(screen.getAllByText("te debe")).toHaveLength(2);
  });
});
