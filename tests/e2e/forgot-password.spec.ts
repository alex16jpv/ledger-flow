import { type APIRequestContext, expect, type Page, test, uniqueEmail } from "../fixtures";
import { readResetEmail, TEST_CAPTCHA } from "../mailpit";
import {
  accountIdsIn,
  APP,
  coldStart,
  freshUser,
  listAccounts,
  readyForOffline,
  signInAs,
  vaultState,
} from "../offline";
import { expectNoAxeViolations } from "./axe";

const OLD_PASSWORD = "LedgerFlow!2026";
const NEW_PASSWORD = "LedgerFlow!2027-new";

async function emptyAccount(request: APIRequestContext, tag: string): Promise<string> {
  const email = uniqueEmail(tag);
  const registered = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Forgot E2E", email, password: OLD_PASSWORD },
  });
  expect(registered.ok(), await registered.text()).toBe(true);
  await request.post("/api/auth/logout", { headers: { origin: APP } });
  return email;
}

async function askForCode(page: Page, email: string): Promise<void> {
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
}

async function signIn(request: APIRequestContext, email: string, password: string) {
  return request.post("/api/auth/login", { headers: { origin: APP }, data: { email, password } });
}

async function emailALink(request: APIRequestContext, email: string): Promise<string> {
  const asked = await request.post("/api/auth/forgot", {
    headers: { origin: APP },
    data: { email, captcha: TEST_CAPTCHA },
  });
  expect(asked.status(), await asked.text()).toBe(202);
  return (await readResetEmail(request, email)).link;
}

async function chooseFromLink(page: Page, link: string): Promise<void> {
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  expect(page.url()).not.toContain("token=");
  await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
  await page.waitForTimeout(500);
  expect(page.url()).not.toContain("token=");
  await page.getByRole("button", { name: "Save password and sign in" }).click();
}

test("a code by email chooses a new password and opens Home", async ({ page, request }) => {
  const email = await emptyAccount(request, "forgot-code");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(`${APP}/forgot`);
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  await expectNoAxeViolations(page);

  await askForCode(page, email);
  const { code } = await readResetEmail(request, email);
  await page.getByLabel("6-digit code").fill(code);
  await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Save password and sign in" }).click();

  await expect(page).toHaveURL(`${APP}/home`);
  await expect(
    page.getByText("Password changed. Every other device was signed out."),
  ).toBeVisible();
  expect((await signIn(request, email, OLD_PASSWORD)).status()).toBe(401);
  expect((await signIn(request, email, NEW_PASSWORD)).ok()).toBe(true);
});

test("a wrong code gets the one answer, and Save waits for another code", async ({
  page,
  request,
}) => {
  const email = await emptyAccount(request, "forgot-wrong");
  await page.goto("/forgot");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await askForCode(page, email);
  const { code } = await readResetEmail(request, email);
  const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");

  const field = page.getByLabel("6-digit code");
  await field.fill(wrong);
  await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
  const save = page.getByRole("button", { name: "Save password and sign in" });
  await save.click();
  await expect(page.getByText(/That code doesn’t work/)).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(page.getByText(/You can resend it in \d:\d\d/)).toBeVisible();

  await field.fill(code);
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page).toHaveURL(`${APP}/home`);
});

test("the email's link asks about an account that was never confirmed, until it is answered", async ({
  page,
  request,
}) => {
  const owner = await freshUser(request, "forgot-keep");
  await chooseFromLink(page, await emailALink(request, owner.email));

  await expect(page).toHaveURL(`${APP}/keep-or-start-fresh`);
  await expect(page.getByRole("heading", { name: "Keep what’s in this account?" })).toBeVisible();
  await expect(page.getByText("Accounts", { exact: true })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.goto("/home");
  await expect(page).toHaveURL(`${APP}/keep-or-start-fresh`);

  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page).toHaveURL(`${APP}/home`);
  await page.goto("/accounts");
  await expect(page.getByText(owner.accountName).first()).toBeVisible();
});

test("Start fresh erases the account, and another device's copy drops it too", async ({
  page,
  request,
  browser,
}) => {
  const owner = await freshUser(request, "forgot-fresh");
  const otherDevice = await browser.newContext();
  await signInAs(otherDevice, request, owner);
  const other = await coldStart(otherDevice);
  await readyForOffline(other);
  const vault = (await vaultState(other))?.name ?? "";
  expect(await accountIdsIn(other, vault)).toContain(owner.accountId);

  await chooseFromLink(page, await emailALink(request, owner.email));
  await page.getByRole("button", { name: "Start fresh" }).click();
  await expect(page.getByText(/deleted for good/)).toBeVisible();
  await page.getByRole("button", { name: "Delete everything and start" }).click();
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  await page.getByRole("textbox", { name: "Name" }).fill("Fresh Start");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(`${APP}/onboarding`);
  expect(await listAccounts(page.request)).toEqual([]);

  await signInAs(otherDevice, request, { email: owner.email, password: NEW_PASSWORD });
  await other.goto("/home");
  await expect
    .poll(() => accountIdsIn(other, vault), { timeout: 15_000 })
    .not.toContain(owner.accountId);
  await otherDevice.close();
});
