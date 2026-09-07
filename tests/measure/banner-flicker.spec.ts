import { expect, type Page, test } from "@playwright/test";

import { addButton, freshUser, signInAs, uniqueAmount } from "../offline";

// F-72: how long the amber "changes waiting" stripe is on screen when the network is up, and how far
// it moves the content under it. Sampled with requestAnimationFrame, which is the granularity the eye
// gets: a change that never survives a frame is never painted.
const RUNS = Number(process.env.MEASURE_RUNS ?? 6);

interface Sample {
  t: number;
  present: boolean;
  height: number;
  contentTop: number;
  text: string;
}

type Instrumented = Window & { __samples?: Sample[]; __t0?: number; __raf?: number };

async function observe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as Instrumented;
    const main = document.getElementById("main");
    if (!main) throw new Error("no #main");
    const read = (): Omit<Sample, "t"> => {
      const first = main.firstElementChild;
      const role = first?.getAttribute("role");
      const stripe = role === "status" || role === "alert" ? first : null;
      const content = main.lastElementChild;
      return {
        present: stripe !== null,
        height: stripe ? Math.round(stripe.getBoundingClientRect().height * 10) / 10 : 0,
        contentTop: content ? Math.round(content.getBoundingClientRect().top * 10) / 10 : 0,
        text: stripe?.textContent?.trim().slice(0, 60) ?? "",
      };
    };
    win.__samples = [];
    win.__t0 = performance.now();
    const key = (s: Omit<Sample, "t">) =>
      `${String(s.present)}|${Math.round(s.height)}|${Math.round(s.contentTop)}|${s.text}`;
    let last = "";
    const tick = () => {
      const now = read();
      if (key(now) !== last) {
        win.__samples?.push({ t: performance.now(), ...now });
        last = key(now);
      }
      win.__raf = requestAnimationFrame(tick);
    };
    tick();
  });
}

async function mark(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as Instrumented;
    win.__t0 = performance.now();
    win.__samples = [];
  });
}

async function samples(page: Page): Promise<{ t0: number; list: Sample[] }> {
  return page.evaluate(() => {
    const win = window as Instrumented;
    return { t0: win.__t0 ?? 0, list: win.__samples ?? [] };
  });
}

test("how long the pending stripe lives, and how far it pushes the content", async ({
  page,
  request,
}) => {
  // Its own user and its own account: this script writes dozens of expenses, and doing that on the
  // shared seed user drove its balance negative and broke `pickers.spec.ts` two runs later.
  await signInAs(page.context(), request, await freshUser(request, "banner"));
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Let the first sync drain before measuring: a queue left over from the arrival is not the flicker.
  await page.waitForTimeout(4000);
  await observe(page);

  const rows: string[] = [];
  for (let run = 0; run < RUNS; run += 1) {
    await addButton(page).click();
    const sheet = page.getByRole("dialog", { name: "Add expense" });
    await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
    await page.keyboard.type(String(uniqueAmount()));
    await mark(page);
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(sheet).toBeHidden();
    await page.waitForTimeout(2500);

    const { t0, list } = await samples(page);
    const shown = list.find((s) => s.present);
    const hidden = shown ? list.find((s) => s.t > shown.t && !s.present) : undefined;
    const jump = shown ? Math.abs(shown.height) : 0;
    rows.push(
      shown
        ? `run ${run + 1}: stripe painted +${Math.round(shown.t - t0)} ms, gone +${
            hidden ? Math.round(hidden.t - t0) : NaN
          } ms, on screen ${hidden ? Math.round(hidden.t - shown.t) : NaN} ms, ` +
            `height ${shown.height} px, content pushed ${jump} px, text "${shown.text}"`
        : `run ${run + 1}: stripe never painted`,
    );
  }
  console.warn(`\n[${test.info().project.name}]\n${rows.join("\n")}\n`);
});

// The same thing over a link that is not localhost. `LATENCY_MS` is added to the batch request only,
// so what grows is the round trip the stripe is waiting for and nothing else.
const LATENCY_MS = Number(process.env.MEASURE_LATENCY_MS ?? 250);

test("the same write over a slower link", async ({ page, request }) => {
  await signInAs(page.context(), request, await freshUser(request, "banner-slow"));
  await page.route("**/api/sync", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
    await route.continue();
  });
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(4000);
  await observe(page);

  const rows: string[] = [];
  for (let run = 0; run < 3; run += 1) {
    await addButton(page).click();
    const sheet = page.getByRole("dialog", { name: "Add expense" });
    await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
    await page.keyboard.type(String(uniqueAmount()));
    await mark(page);
    await sheet.getByRole("button", { name: "Save" }).click();
    if (run === 0) {
      // After the stripe's grace and before waiting for the sheet, which does not close until the
      // server answers: by then the stripe this shot exists for is already gone (F-72).
      await page.waitForTimeout(Math.min(LATENCY_MS - 400, 1600));
      await page.screenshot({
        path: `test-results/measure/with-stripe-${test.info().project.name}.png`,
      });
    }
    await expect(sheet).toBeHidden();
    await page.waitForTimeout(LATENCY_MS + 2500);
    if (run === 0) {
      await page.screenshot({
        path: `test-results/measure/no-stripe-${test.info().project.name}.png`,
      });
    }

    const { t0, list } = await samples(page);
    const shown = list.find((s) => s.present);
    const hidden = shown ? list.find((s) => s.t > shown.t && !s.present) : undefined;
    rows.push(
      shown
        ? `run ${run + 1}: stripe painted +${Math.round(shown.t - t0)} ms, on screen ${
            hidden ? Math.round(hidden.t - shown.t) : NaN
          } ms, content pushed ${shown.height} px`
        : `run ${run + 1}: stripe never painted`,
    );
  }
  console.warn(
    `\n[${test.info().project.name}] +${LATENCY_MS} ms on POST /sync\n${rows.join("\n")}\n`,
  );
});
