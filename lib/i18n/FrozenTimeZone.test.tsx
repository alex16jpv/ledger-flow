import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";

import {
  FormatSettingsProvider,
  FrozenTimeZone,
  useFormatSettings,
} from "./FormatSettingsProvider";

function Zone() {
  return <p>{useFormatSettings().timeZone}</p>;
}

const tree = (timeZone: string, open?: boolean) => (
  <FormatSettingsProvider timeZone={timeZone}>
    <FrozenTimeZone {...(open === undefined ? {} : { open })}>
      <Zone />
    </FrozenTimeZone>
  </FormatSettingsProvider>
);

describe("FrozenTimeZone [T-192]", () => {
  it("keeps the zone it was mounted with when the profile's changes", () => {
    const { rerender } = renderWithProviders(tree("Europe/Madrid"));
    rerender(tree("America/Bogota"));

    expect(screen.getByText("Europe/Madrid")).toBeVisible();
  });

  it("takes the zone again each time it opens, and holds it while open", () => {
    const { rerender } = renderWithProviders(tree("Europe/Madrid", false));
    rerender(tree("America/Bogota", false));
    rerender(tree("America/Bogota", true));
    expect(screen.getByText("America/Bogota")).toBeVisible();

    rerender(tree("Asia/Tokyo", true));
    expect(screen.getByText("America/Bogota")).toBeVisible();

    rerender(tree("Asia/Tokyo", false));
    expect(screen.getByText("America/Bogota")).toBeVisible();
    rerender(tree("Asia/Tokyo", true));
    expect(screen.getByText("Asia/Tokyo")).toBeVisible();
  });

  it("follows the zone until the profile is resolved, and holds the user's from then on", () => {
    const unresolved = (
      <FormatSettingsProvider profileResolved={false}>
        <FrozenTimeZone>
          <Zone />
        </FrozenTimeZone>
      </FormatSettingsProvider>
    );
    const { rerender } = renderWithProviders(unresolved);
    rerender(tree("Europe/Madrid"));
    rerender(tree("America/Bogota"));

    expect(screen.getByText("Europe/Madrid")).toBeVisible();
  });

  it("keeps a zone it holds even if the profile stops being resolved", () => {
    const { rerender } = renderWithProviders(tree("Europe/Madrid"));
    rerender(
      <FormatSettingsProvider profileResolved={false}>
        <FrozenTimeZone>
          <Zone />
        </FrozenTimeZone>
      </FormatSettingsProvider>,
    );

    expect(screen.getByText("Europe/Madrid")).toBeVisible();
  });
});
