import { type APIRequestContext, expect, type Page, test, uniqueEmail } from "../fixtures";
import {
  readEmailChangeEmail,
  readResetEmail,
  readUndoLink,
  signUpWithCode,
  TEST_CAPTCHA,
} from "../mailpit";
import { APP } from "../offline";
import { expectNoAxeViolations } from "./axe";

const PASSWORD = "LedgerFlow!2026";
const NEW_PASSWORD = "LedgerFlow!2027-new";
// Asking for an address hashes the password and emails both addresses, which a loaded run stretches.
const SAVE_WAIT = { timeout: 15_000 };

async function registered(request: APIRequestContext, tag: string): Promise<string> {
  const email = uniqueEmail(tag);
  const response = await signUpWithCode(request, {
    name: "Email change E2E",
    email,
    password: PASSWORD,
    captcha: TEST_CAPTCHA,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return email;
}

async function signedIn(page: Page, request: APIRequestContext): Promise<void> {
  await page.context().addCookies((await request.storageState()).cookies);
}

test("a new address counts only once its code comes back, and every other device is signed out", async ({
  page,
  request,
  playwright,
}) => {
  const email = await registered(request, "change-code");
  const next = uniqueEmail("change-code-new");
  const elsewhere = await playwright.request.newContext({ baseURL: APP });
  const other = await elsewhere.post("/api/auth/login", {
    headers: { origin: APP },
    data: { email, password: PASSWORD },
  });
  expect(other.ok()).toBe(true);

  await signedIn(page, request);
  await page.goto("/settings/profile");
  const field = page.getByRole("textbox", { name: /^Email/ });
  await expect(field).toHaveValue(email);
  await field.fill(next);
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText(`Check ${next}: your email changes once you confirm it`)).toBeVisible(
    SAVE_WAIT,
  );
  await expect(page.getByText(`Waiting for confirmation at ${next}`)).toBeVisible(SAVE_WAIT);
  await expect(field).toHaveValue(email);
  await expect(page.getByRole("button", { name: /Resend in \d:\d\d/ })).toBeDisabled();
  await expectNoAxeViolations(page);

  const { code } = await readEmailChangeEmail(request, next);
  await page.getByRole("button", { name: "Enter code" }).click();
  const sheet = page.getByRole("dialog", { name: "Confirm your new email" });
  await expect(sheet.getByText(`We sent a 6-digit code to ${next}`)).toBeVisible();
  await expectNoAxeViolations(page);
  await sheet.getByLabel("6-digit code").fill(code);
  await sheet.getByRole("button", { name: "Confirm" }).click();

  await expect(
    page.getByText(`Your email is now ${next}. Every other device was signed out.`),
  ).toBeVisible();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("textbox", { name: /^Email/ })).toHaveValue(next);
  await expect(page.getByText(/Waiting for confirmation at/)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("textbox", { name: /^Email/ })).toHaveValue(next);
  expect((await elsewhere.post("/api/auth/refresh", { headers: { origin: APP } })).ok()).toBe(
    false,
  );
  await elsewhere.dispose();
});

test("the email's link moves the account from a browser with no session, after one tap", async ({
  browser,
  request,
}) => {
  const email = await registered(request, "change-link");
  const next = uniqueEmail("change-link-new");
  const asked = await request.post("/api/auth/change-email", {
    headers: { origin: APP },
    data: { email: next, currentPassword: PASSWORD, captcha: TEST_CAPTCHA },
  });
  expect(asked.status(), await asked.text()).toBe(202);
  const { link } = await readEmailChangeEmail(request, next);

  const inbox = await browser.newContext({ baseURL: APP });
  const page = await inbox.newPage();
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Move your account to this address?" }),
  ).toBeVisible();
  expect(page.url()).not.toContain("token=");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Confirm new email" }).click();
  await expect(page.getByRole("heading", { name: "Your email changed" })).toBeVisible();
  await inbox.close();

  expect((await request.post("/api/auth/refresh", { headers: { origin: APP } })).ok()).toBe(false);
  const again = await request.post("/api/auth/login", {
    headers: { origin: APP },
    data: { email: next, password: PASSWORD },
  });
  expect(again.ok()).toBe(true);
  const old = await request.post("/api/auth/login", {
    headers: { origin: APP },
    data: { email, password: PASSWORD },
  });
  expect(old.status()).toBe(401);
});

test("the link keeps the session of the browser that holds the account", async ({
  page,
  request,
}) => {
  await registered(request, "change-own");
  const next = uniqueEmail("change-own-new");
  await signedIn(page, request);
  await page.goto("/settings/profile");
  await page.getByRole("textbox", { name: /^Email/ }).fill(next);
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(`Waiting for confirmation at ${next}`)).toBeVisible(SAVE_WAIT);
  const { link } = await readEmailChangeEmail(request, next);

  await page.goto(link);
  await page.getByRole("button", { name: "Confirm new email" }).click();
  await expect(page.getByRole("heading", { name: "Your email changed" })).toBeVisible();
  await page.getByRole("link", { name: "Open Ledger Flow" }).click();
  await expect(page).toHaveURL(`${APP}/home`);
  await page.goto("/settings/profile");
  await expect(page.getByRole("textbox", { name: /^Email/ })).toHaveValue(next);
  expect((await request.post("/api/auth/refresh", { headers: { origin: APP } })).ok()).toBe(false);
});

test("Cancel change drops the address that waits, and its link stops working", async ({
  page,
  request,
  browser,
}) => {
  const email = await registered(request, "change-cancel");
  const next = uniqueEmail("change-cancel-new");
  await signedIn(page, request);
  await page.goto("/settings/profile");
  await page.getByRole("textbox", { name: /^Email/ }).fill(next);
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(`Waiting for confirmation at ${next}`)).toBeVisible(SAVE_WAIT);
  const { link } = await readEmailChangeEmail(request, next);

  await page.getByRole("button", { name: "Cancel change" }).click();
  await expect(page.getByText(`Change cancelled. Your account keeps ${email}.`)).toBeVisible();
  await expect(page.getByText(/Waiting for confirmation at/)).toHaveCount(0);

  const inbox = await browser.newContext({ baseURL: APP });
  const other = await inbox.newPage();
  await other.goto(link);
  await other.getByRole("button", { name: "Confirm new email" }).click();
  await expect(other.getByRole("heading", { name: "This link no longer works" })).toBeVisible();
  await inbox.close();
});

test("a new password saved with a new address goes first, so the address still waits for its code", async ({
  page,
  request,
}) => {
  await registered(request, "change-with-password");
  const next = uniqueEmail("change-with-password-new");
  await signedIn(page, request);
  await page.goto("/settings/profile");
  await page.getByRole("textbox", { name: /^Email/ }).fill(next);
  await page.getByLabel(/^New password/).fill(NEW_PASSWORD);
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(`Waiting for confirmation at ${next}`)).toBeVisible(SAVE_WAIT);

  const { code } = await readEmailChangeEmail(request, next);
  await page.getByRole("button", { name: "Enter code" }).click();
  const sheet = page.getByRole("dialog", { name: "Confirm your new email" });
  await sheet.getByLabel("6-digit code").fill(code);
  await sheet.getByRole("button", { name: "Confirm" }).click();
  await expect(
    page.getByText(`Your email is now ${next}. Every other device was signed out.`),
  ).toBeVisible();

  const again = await request.post("/api/auth/login", {
    headers: { origin: APP },
    data: { email: next, password: NEW_PASSWORD },
  });
  expect(again.ok(), await again.text()).toBe(true);
});

test("the old address's Undo the change takes the account back after one tap, and its code chooses a new password", async ({
  browser,
  request,
}) => {
  const email = await registered(request, "change-undo");
  const next = uniqueEmail("change-undo-new");
  const asked = await request.post("/api/auth/change-email", {
    headers: { origin: APP },
    data: { email: next, currentPassword: PASSWORD, captcha: TEST_CAPTCHA },
  });
  expect(asked.status(), await asked.text()).toBe(202);
  const { code } = await readEmailChangeEmail(request, next);
  const moved = await request.post("/api/auth/confirm-change", {
    headers: { origin: APP },
    data: { code },
  });
  expect(moved.ok(), await moved.text()).toBe(true);
  const link = await readUndoLink(request, email);

  const inbox = await browser.newContext({ baseURL: APP });
  const tab = await inbox.newPage();
  await tab.goto(link);
  await expect(tab.getByRole("heading", { name: "Undo the change?" })).toBeVisible();
  expect(tab.url()).not.toContain("token=");
  await expectNoAxeViolations(tab);
  await tab.getByRole("button", { name: "Undo the change" }).click();
  await expect(tab.getByRole("heading", { name: "Change undone" })).toBeVisible();
  await expectNoAxeViolations(tab);
  await tab.getByRole("link", { name: "Enter the code" }).click();
  await expect(tab).toHaveURL(`${APP}/forgot`);
  await expect(tab.getByText(email)).toBeVisible();
  const reset = await readResetEmail(request, email);
  await tab.getByLabel("6-digit code").fill(reset.code);
  await tab.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
  await tab.getByRole("button", { name: "Save password and sign in" }).click();
  await expect(tab).toHaveURL(`${APP}/home`);
  await inbox.close();

  const again = await browser.newContext({ baseURL: APP });
  const used = await again.newPage();
  await used.goto(link);
  await used.getByRole("button", { name: "Undo the change" }).click();
  await expect(used.getByRole("heading", { name: "This link no longer works" })).toBeVisible();
  await expect(used.getByText(/An undo link works for 7 days and only once/)).toBeVisible();
  await again.close();

  expect((await request.post("/api/auth/refresh", { headers: { origin: APP } })).ok()).toBe(false);
  for (const [address, password] of [
    [next, PASSWORD],
    [email, PASSWORD],
  ]) {
    const refused = await request.post("/api/auth/login", {
      headers: { origin: APP },
      data: { email: address, password },
    });
    expect(refused.status()).toBe(401);
  }
});
