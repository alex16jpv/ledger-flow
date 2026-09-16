import type { Page } from "../fixtures";

// T-72: below 900px Accounts, Stats, Categories and Settings live behind More; above it, the sidebar.
export async function goToSection(page: Page, name: string): Promise<void> {
  const more = page
    .getByRole("navigation", { name: "Navigation" })
    .last()
    .getByRole("button", { name: "More", exact: true });
  if (await more.isVisible()) await more.click();
  // In the sheet the accessible name carries the count too, so this match is a substring.
  await page.getByRole("link", { name }).first().click();
}
