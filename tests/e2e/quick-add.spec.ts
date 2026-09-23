import AxeBuilder from "@axe-core/playwright";

import { expect, type Page, test, uniqueEmail } from "../fixtures";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

async function signIn(page: Page, request: Request, credentials = SEED) {
  const response = await request.post("/api/auth/login", {
    headers: { origin: APP },
    data: credentials,
  });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

// Specs share the seed user and run in parallel: each one uses a unique amount to find its own row.
function uniqueAmount(): number {
  return 100_000 + Math.floor(Math.random() * 899_999);
}

interface QuickRow {
  id: string;
  type: string;
  amount: number;
  pendingDetails: boolean;
  description: string | null;
  categoryId: string | null;
}

async function quickRows(request: Request): Promise<QuickRow[]> {
  const list = (await (await request.get("/api/transactions?source=QUICK&limit=50")).json()) as {
    data: QuickRow[];
  };
  return list.data;
}

// The reply comes back before the row is readable, and a quick capture finishes in two steps, so
// the list is polled for the row in the state the test is waiting for rather than read once.
async function quickRow(
  request: Request,
  amount: number,
  settled: (row: QuickRow) => boolean = () => true,
): Promise<QuickRow | undefined> {
  let found: QuickRow | undefined;
  await expect
    .poll(async () => {
      const row = (await quickRows(request)).find((candidate) => candidate.amount === amount);
      if (row) found = row;
      return row !== undefined && settled(row);
    })
    .toBe(true);
  return found;
}

function addButton(page: Page) {
  return page.getByRole("button", { name: "Add", exact: true });
}

test("an expense is captured in two interactions, lands in the inbox and can be undone", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await expect(
    sheet.getByRole("button", { name: /From your main account.*Bancolombia/ }),
  ).toBeVisible();
  await expect(sheet.getByRole("group", { name: "Category" }).getByRole("button")).toHaveCount(6);
  expect((await new AxeBuilder({ page }).include("dialog[open]").analyze()).violations).toEqual([]);
  // T-77: the tint and the blur of a backdrop are resolved values, which jsdom cannot give.
  const backdrop = await sheet.evaluate((node) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--overlay)";
    document.documentElement.append(probe);
    const wanted = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const style = getComputedStyle(node, "::backdrop");
    return {
      blur: style.backdropFilter,
      tint: style.backgroundColor,
      wanted,
      token: getComputedStyle(document.documentElement).getPropertyValue("--overlay-blur").trim(),
    };
  });
  expect(backdrop.token).toMatch(/^\d+(\.\d+)?px$/);
  expect(backdrop.blur).toBe(`blur(${backdrop.token})`);
  expect(backdrop.tint).toBe(backdrop.wanted);

  const amount = uniqueAmount();
  await page.keyboard.type(String(amount));
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Transaction saved")).toBeVisible();

  const created = await quickRow(request, amount);
  expect(created).toMatchObject({ amount, pendingDetails: true });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Transaction removed")).toBeVisible();
  expect((await request.get(`/api/transactions/${created?.id}`)).status()).toBe(404);
});

test("a chosen category and a note complete the details, and More details carries the draft", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add" });
  const amount = uniqueAmount();
  await sheet.getByRole("textbox", { name: "Amount" }).fill(String(amount));
  await sheet
    .getByRole("group", { name: "Category" })
    .getByRole("button", { name: "Coffee" })
    .click();
  await sheet.getByRole("textbox", { name: "Quick note (optional)" }).fill("E2E latte");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText("Transaction saved")).toBeVisible();

  const created = await quickRow(request, amount);
  expect(created).toMatchObject({ description: "E2E latte", pendingDetails: false });
  expect(created?.categoryId).toBeTruthy();
  await request.delete(`/api/transactions/${created?.id}`, { headers: { origin: APP } });

  const onlyCategory = uniqueAmount();
  await addButton(page).click();
  await sheet.getByRole("textbox", { name: "Amount" }).fill(String(onlyCategory));
  await sheet
    .getByRole("group", { name: "Category" })
    .getByRole("button", { name: "Food" })
    .click();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  // The previous toast may still be on screen: wait for the follow-up PUT through the API instead.
  await expect
    .poll(async () => (await quickRow(request, onlyCategory))?.pendingDetails, { timeout: 10_000 })
    .toBe(false);
  const categorized = await quickRow(request, onlyCategory);
  expect(categorized).toMatchObject({ pendingDetails: false, description: null });
  await request.delete(`/api/transactions/${categorized?.id}`, { headers: { origin: APP } });

  await addButton(page).click();
  await sheet.getByRole("textbox", { name: "Amount" }).fill("4500");
  await sheet.getByRole("button", { name: /From your main account/ }).click();
  await page.getByRole("dialog", { name: "Account" }).getByRole("option", { name: /Cash/ }).click();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Account.*Cash/ })).toBeVisible();
  await sheet.getByRole("textbox", { name: "Quick note (optional)" }).fill("Bus");
  await sheet.getByRole("button", { name: "More details" }).click();
  await expect(page).toHaveURL(
    /\/transactions\/new\?type=EXPENSE&amount=4500&accountId=[^&]+&description=Bus$/,
  );
});

test("without a main account the sheet asks for one instead of failing silently", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("quick");
  const registered = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Quick E2E", email, password: "LedgerFlow!2026" },
  });
  expect(registered.ok(), await registered.text()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/home");
  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add" });
  await expect(sheet.getByRole("button", { name: /Account.*Choose an account/ })).toBeVisible();
  await sheet.getByRole("textbox", { name: "Amount" }).fill("500");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet.getByRole("alert")).toHaveText(
    "Choose an account: you don’t have a main one yet.",
  );
});

test("holding the add button chains captures", async ({ page, request }) => {
  test.skip(test.info().project.name !== "mobile", "the hold gesture lives on the tab bar");
  await signIn(page, request);
  const fab = addButton(page);
  const box = await fab.boundingBox();
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  const sheet = page.getByRole("dialog", { name: "Add" });
  await expect(sheet).toBeVisible();
  const amount = uniqueAmount();
  await sheet.getByRole("textbox", { name: "Amount" }).fill(String(amount));
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Transaction saved")).toBeVisible();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("textbox", { name: "Amount" })).toHaveValue("");
  const created = await quickRow(request, amount);
  expect(created).toBeDefined();
  await request.delete(`/api/transactions/${created?.id}`, { headers: { origin: APP } });
});

// T-75: what broke was layout, and jsdom has none, so the guard has to be a real coordinate.
test("a tap outside the quick sheet closes it, and a tap inside does not", async ({
  page,
  request,
}) => {
  test.skip(test.info().project.name === "mobile", "on a phone quick add fills the screen (T-150)");
  const tap = async (x: number, y: number) => {
    await page.mouse.click(x, y);
  };
  await signIn(page, request);
  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add" });
  await expect(sheet).toBeVisible();
  const panel = sheet.getByRole("heading", { name: "Add" });

  async function outside() {
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    // A scrim the test can aim at: if the panel starts at the top there is nothing outside to tap.
    expect(box?.y ?? 0).toBeGreaterThan(40);
    return box;
  }

  let box = await outside();
  if (!box) return;
  await tap(box.x + box.width / 2, box.y);
  await expect(sheet).toBeVisible();

  await tap(box.x + box.width / 2, Math.round(box.y / 2));
  await expect(sheet).toBeHidden();

  await addButton(page).click();
  await expect(sheet).toBeVisible();
  box = await outside();
  if (box) await tap(box.x + box.width / 2, Math.round(box.y / 2));
  await expect(sheet).toBeHidden();
});

// T-73: the sheet sent an expense whatever the user meant; the endpoint always took all three.
test("the quick sheet records an income and a transfer against the real backend", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add" });

  const income = uniqueAmount();
  await sheet.getByRole("button", { name: "Income" }).click();
  await expect(sheet.getByRole("button", { name: /Into your main account/ })).toBeVisible();
  await sheet.getByRole("textbox", { name: "Amount" }).fill(String(income));
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Transaction saved")).toBeVisible();
  const saved = await quickRow(request, income);
  expect(saved?.type).toBe("INCOME");
  await request.delete(`/api/transactions/${saved?.id}`, { headers: { origin: APP } });

  await addButton(page).click();
  const transfer = uniqueAmount();
  await sheet.getByRole("button", { name: "Transfer" }).click();
  // T-86: the sheet keeps its category row on a transfer, filtered to the ones marked Transfer.
  await expect(sheet.getByRole("group", { name: "Category" })).toBeVisible();
  await sheet
    .getByRole("group", { name: "Category" })
    .getByRole("button", { name: "More" })
    .click();
  const picker = page.getByRole("dialog", { name: "Category" });
  await picker.getByRole("option", { name: /Credit Card Payment/ }).click();
  await sheet.getByRole("textbox", { name: "Amount" }).fill(String(transfer));
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("This field is required.");
  await sheet.getByRole("button", { name: /^To/ }).click();
  await page.getByRole("option").first().click();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Transaction saved")).toBeVisible();
  // A transfer has no category to give, so it must not sit in the review inbox for ever.
  const moved = await quickRow(request, transfer, (row) => !row.pendingDetails);
  expect(moved?.type).toBe("TRANSFER");
  expect(moved?.pendingDetails).toBe(false);
  expect(moved?.categoryId).toBeTruthy();
  await request.delete(`/api/transactions/${moved?.id}`, { headers: { origin: APP } });
});
