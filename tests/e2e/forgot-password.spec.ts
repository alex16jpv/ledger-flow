import { type APIRequestContext, expect, type Page, test, uniqueEmail } from "../fixtures";
import { readResetEmail, readRestoreLink, signUpWithCode, TEST_CAPTCHA } from "../mailpit";
import { APP } from "../offline";
import { expectNoAxeViolations } from "./axe";

const OLD_PASSWORD = "LedgerFlow!2026";
const NEW_PASSWORD = "LedgerFlow!2027-new";

async function emptyAccount(request: APIRequestContext, tag: string): Promise<string> {
  const email = uniqueEmail(tag);
  const registered = await signUpWithCode(request, {
    captcha: TEST_CAPTCHA,
    name: "Forgot E2E",
    email,
    password: OLD_PASSWORD,
  });
  expect(registered.ok(), await registered.text()).toBe(true);
  await request.post("/api/auth/logout", { headers: { origin: APP } });
  return email;
}

async function askForCode(page: Page, email: string): Promise<void> {
  await page.getByRole("button", { name: "Send code" }).click();
  // The server holds every answer to a floor of about two seconds, which a loaded run stretches.
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({
    timeout: 15_000,
  });
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

test("Forgot your password? restores a deleted account, and says so", async ({ page, request }) => {
  const email = uniqueEmail("forgot-deleted");
  const registered = await signUpWithCode(request, {
    name: "Forgot E2E",
    email,
    password: OLD_PASSWORD,
  });
  const { user } = (await registered.json()) as { user: { id: string } };
  const deleted = await request.delete(`/api/users/${user.id}`, {
    headers: { origin: APP },
    data: { currentPassword: OLD_PASSWORD },
  });
  expect(deleted.ok(), await deleted.text()).toBe(true);
  await request.post("/api/auth/logout", { headers: { origin: APP } });

  await chooseFromLink(page, await emailALink(request, email));
  await expect(page).toHaveURL(`${APP}/home`);
  await expect(
    page.getByText("Account restored. Every other device was signed out."),
  ).toBeVisible();
});

test("the deleted email's Restore account signs out, and its code chooses a new password", async ({
  request,
  browser,
}) => {
  const email = uniqueEmail("restore-link");
  const registered = await signUpWithCode(request, {
    name: "Restore E2E",
    email,
    password: OLD_PASSWORD,
  });
  const { user } = (await registered.json()) as { user: { id: string } };
  const deleted = await request.delete(`/api/users/${user.id}`, {
    headers: { origin: APP },
    data: { currentPassword: OLD_PASSWORD },
  });
  expect(deleted.ok(), await deleted.text()).toBe(true);
  const link = await readRestoreLink(request, email);

  const inbox = await browser.newContext({ baseURL: APP });
  const tab = await inbox.newPage();
  await tab.goto(link);
  await expect(tab.getByRole("heading", { name: "Restore your account?" })).toBeVisible();
  expect(tab.url()).not.toContain("token=");
  await expectNoAxeViolations(tab);
  await tab.getByRole("button", { name: "Restore account" }).click();
  await expect(tab.getByRole("heading", { name: "Account restored" })).toBeVisible();
  await tab.getByRole("link", { name: "Enter the code" }).click();
  await expect(tab).toHaveURL(`${APP}/forgot`);
  await expect(tab.getByText(email)).toBeVisible();
  const { code } = await readResetEmail(request, email);
  await tab.getByLabel("6-digit code").fill(code);
  await tab.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
  await tab.getByRole("button", { name: "Save password and sign in" }).click();
  await expect(tab).toHaveURL(`${APP}/home`);
  await inbox.close();

  expect((await signIn(request, email, OLD_PASSWORD)).status()).toBe(401);
});
