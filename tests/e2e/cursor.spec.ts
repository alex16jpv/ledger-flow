import { expect, type Page, test } from "../fixtures";

const CATALOG = "/en/dev/ui";
const CONTROLS =
  ':is(button, a[href], [role="button"], summary, input:is([type="checkbox"], [type="radio"]), label:has(button, input:is([type="checkbox"], [type="radio"]))):not(:disabled, [aria-disabled="true"], :has(:disabled))';
const TOGGLES = 'button, input:is([type="checkbox"], [type="radio"])';
const LABELS = `
  <label data-cursor="pointer"><button type="button" role="switch" aria-checked="false"></button>On</label>
  <label data-cursor="not-allowed"><button type="button" role="switch" aria-checked="false" disabled></button>Off</label>
  <label data-cursor="pointer"><input type="checkbox" />On</label>
  <label data-cursor="not-allowed"><input type="checkbox" disabled />Off</label>
  <span role="button" data-cursor="pointer">Act</span>
  <span role="button" aria-disabled="true" data-cursor="not-allowed">Soon</span>
  <details><summary data-cursor="pointer">More</summary></details>`;

async function openCatalog(page: Page) {
  await page.goto(CATALOG);
  await expect(page.getByRole("button", { name: "Field" }).first()).toBeVisible();
}

test("every control of the catalog shows the pointer while it acts", async ({ page }) => {
  await openCatalog(page);
  const withoutPointer = await page.evaluate((selector) => {
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((node) => getComputedStyle(node).cursor !== "pointer")
      .map((node) => node.outerHTML.slice(0, 160));
  }, CONTROLS);
  expect(withoutPointer).toEqual([]);
});

test("every control of the catalog shows not-allowed once disabled, and so does its label", async ({
  page,
}) => {
  await openCatalog(page);
  const stillPointing = await page.evaluate((selector) => {
    return [...document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(selector)]
      .filter((node) => {
        const was = node.disabled;
        node.disabled = true;
        const label = node.closest("label");
        const blocked =
          getComputedStyle(node).cursor === "not-allowed" &&
          (label === null || getComputedStyle(label).cursor === "not-allowed");
        node.disabled = was;
        return !blocked;
      })
      .map((node) => node.outerHTML.slice(0, 160));
  }, TOGGLES);
  expect(stillPointing).toEqual([]);
});

test("a label follows the control it wraps, and aria-disabled blocks like disabled", async ({
  page,
}) => {
  await openCatalog(page);
  const mismatches = await page.evaluate((markup) => {
    const host = document.createElement("div");
    host.innerHTML = markup;
    document.body.append(host);
    return [...host.querySelectorAll<HTMLElement>("[data-cursor]")]
      .filter((node) => getComputedStyle(node).cursor !== node.dataset.cursor)
      .map((node) => node.outerHTML);
  }, LABELS);
  expect(mismatches).toEqual([]);
});
