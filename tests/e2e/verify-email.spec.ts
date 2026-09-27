import { type APIRequestContext, expect, type Page, test, uniqueEmail } from "../fixtures";
import { readVerifyEmail, TEST_CAPTCHA } from "../mailpit";
import { APP } from "../offline";
import { expectNoAxeViolations } from "./axe";

const PASSWORD = "LedgerFlow!2026";

async function registered(
  request: APIRequestContext,
  tag: string,
  { captcha = true }: { captcha?: boolean } = {},
): Promise<string> {
  const email = uniqueEmail(tag);
  const response = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: {
      name: "Verify E2E",
      email,
      password: PASSWORD,
      ...(captcha && { captcha: TEST_CAPTCHA }),
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return email;
}

async function signedIn(page: Page, request: APIRequestContext): Promise<void> {
  await page.context().addCookies((await request.storageState()).cookies);
}

const stripe = (page: Page) => page.getByRole("status").filter({ hasText: "Confirm your email." });

test("a new account confirms its email with the code its sign-up sent", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("verify-code");
  await page.goto("/register");
  await page.getByRole("textbox", { name: "Name" }).fill("Verify E2E");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox").check({ force: true });
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(`${APP}/onboarding`, { timeout: 15_000 });

  await page.goto("/home");
  await expect(stripe(page)).toBeVisible();
  await expectNoAxeViolations(page);
  await stripe(page).getByRole("button", { name: "Confirm" }).click();
  const sheet = page.getByRole("dialog", { name: "Confirm your email" });
  await expect(sheet.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible();
  await expect(sheet.getByText(/You can resend it in \d:\d\d/)).toBeVisible();
  await expectNoAxeViolations(page);

  const { code } = await readVerifyEmail(request, email);
  await sheet.getByLabel("6-digit code").fill(code);
  await sheet.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText("Email confirmed")).toBeVisible();
  await expect(sheet).toBeHidden();
  await expect(stripe(page)).toHaveCount(0);
  await page.goto("/settings");
  await expect(page.getByText("Requires your current password")).toBeVisible();
  await expect(page.getByText("Not confirmed")).toHaveCount(0);
});

test("an account with no code sends one from the sheet, with Cloudflare's check", async ({
  page,
  request,
}) => {
  const email = await registered(request, "verify-send", { captcha: false });
  await signedIn(page, request);
  await page.goto("/settings");
  await expect(page.getByText("Your email isn’t confirmed yet")).toBeVisible();

  await stripe(page).getByRole("button", { name: "Confirm" }).click();
  const sheet = page.getByRole("dialog", { name: "Confirm your email" });
  await expect(sheet.getByText(`We’ll send a 6-digit code to ${email}`)).toBeVisible();
  await sheet.getByRole("button", { name: "Send code" }).click();
  await expect(sheet.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible();

  const { code } = await readVerifyEmail(request, email);
  await sheet.getByLabel("6-digit code").fill(code);
  await sheet.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Email confirmed")).toBeVisible();
  await expect(page.getByText("Requires your current password")).toBeVisible();
});

test("the email's link confirms from a browser with no session, after one tap", async ({
  page,
  request,
  browser,
}) => {
  const email = await registered(request, "verify-link");
  const { link } = await readVerifyEmail(request, email);

  const elsewhere = await browser.newContext({ baseURL: APP });
  const other = await elsewhere.newPage();
  await other.goto(link);
  await expect(other.getByRole("heading", { name: "Confirm your email" })).toBeVisible();
  expect(other.url()).not.toContain("token=");
  await expectNoAxeViolations(other);
  await other.getByRole("button", { name: "Confirm email" }).click();
  await expect(other.getByRole("heading", { name: "Email confirmed" })).toBeVisible();
  await other.goto(link.replace(/#.*$/, ""));
  await expect(other.getByText(/This page lost its link/)).toBeVisible();
  await elsewhere.close();

  await signedIn(page, request);
  await page.goto("/settings");
  await expect(page.getByText("Requires your current password")).toBeVisible();
  await expect(stripe(page)).toHaveCount(0);
});

test("It wasn't me erases the account that used the address, and frees it", async ({
  browser,
  request,
}) => {
  const email = await registered(request, "verify-not-me");
  const { notMe } = await readVerifyEmail(request, email);
  expect(notMe).not.toBeNull();

  const inbox = await browser.newContext({ baseURL: APP });
  const page = await inbox.newPage();
  await page.goto(notMe ?? "");
  await expect(page.getByText("If you signed up yourself, don’t.")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Delete that account" }).click();
  await expect(page.getByRole("heading", { name: "That account is gone" })).toBeVisible();

  const again = await inbox.request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "The owner", email, password: "Another!2026" },
  });
  expect(again.status(), await again.text()).toBe(201);

  await page.goto(notMe ?? "");
  await page.getByRole("button", { name: "Delete that account" }).click();
  await expect(page.getByRole("heading", { name: "This link no longer works" })).toBeVisible();
  await inbox.close();
});
