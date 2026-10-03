import { type APIRequestContext, expect, type Page, test, uniqueEmail } from "../fixtures";
import { type Deadline, makeAccountFromBeforeEmail } from "../legacy-account";
import { readVerifyEmail, signUpWithCode, TEST_CAPTCHA } from "../mailpit";
import { APP } from "../offline";
import { expectNoAxeViolations } from "./axe";

const PASSWORD = "LedgerFlow!2026";

interface Legacy {
  email: string;
  signUpCode: string;
  confirmBy: string | null;
}

// Signs in again after the change, so the session carries the deadline as the server would give it.
async function fromBeforeEmail(
  request: APIRequestContext,
  tag: string,
  deadline: Deadline = "none",
): Promise<Legacy> {
  const email = uniqueEmail(tag);
  const response = await signUpWithCode(request, { name: "Verify E2E", email, password: PASSWORD });
  expect(response.ok(), await response.text()).toBe(true);
  const { code: signUpCode } = await readVerifyEmail(request, email);
  const { confirmBy } = await makeAccountFromBeforeEmail(email, deadline);
  const login = await request.post("/api/auth/login", {
    headers: { origin: APP },
    data: { email, password: PASSWORD },
  });
  expect(login.ok(), await login.text()).toBe(true);
  return { email, signUpCode, confirmBy };
}

async function newCode(request: APIRequestContext, email: string, before: string) {
  let code = before;
  await expect
    .poll(async () => (code = (await readVerifyEmail(request, email)).code))
    .not.toBe(before);
  return code;
}

async function signedIn(page: Page, request: APIRequestContext): Promise<void> {
  await page.context().addCookies((await request.storageState()).cookies);
}

const stripe = (page: Page) => page.getByRole("status").filter({ hasText: /^Confirm your email/ });

test("an account from before email confirms from the stripe's sheet, with Cloudflare's check", async ({
  page,
  request,
}) => {
  const { email, signUpCode } = await fromBeforeEmail(request, "verify-send");
  await signedIn(page, request);
  await page.goto("/settings");
  await expect(page.getByText("Your email isn’t confirmed yet")).toBeVisible();
  await expect(stripe(page)).toContainText("Confirm your email.");
  await expectNoAxeViolations(page);

  await stripe(page).getByRole("button", { name: "Confirm" }).click();
  const sheet = page.getByRole("dialog", { name: "Confirm your email" });
  await expect(sheet.getByText(`We’ll send a 6-digit code to ${email}`)).toBeVisible();
  await sheet.getByRole("button", { name: "Send code" }).click();
  await expect(sheet.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible();
  await expectNoAxeViolations(page);

  await sheet.getByLabel("6-digit code").fill(await newCode(request, email, signUpCode));
  await sheet.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Email confirmed")).toBeVisible();
  await expect(stripe(page)).toHaveCount(0);
  await expect(page.getByText("Requires your current password")).toBeVisible();
});

test("the stripe names the deadline once the account has one", async ({ page, request }) => {
  const { confirmBy } = await fromBeforeEmail(request, "verify-dated", "ahead");
  const [year, month, day] = (confirmBy ?? "").split("-").map(Number);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day)));
  await signedIn(page, request);
  await page.goto("/home");
  await expect(stripe(page)).toContainText(`Confirm your email by ${date}.`);
  await expect(stripe(page)).toContainText("After that, signing in asks for a code first.");
});

test("the email's link confirms from a browser with no session, after one tap", async ({
  page,
  request,
  browser,
}) => {
  const { email, signUpCode } = await fromBeforeEmail(request, "verify-link");
  const sent = await request.post("/api/auth/resend", {
    headers: { origin: APP },
    data: { captcha: TEST_CAPTCHA },
  });
  expect(sent.status(), await sent.text()).toBe(202);
  await newCode(request, email, signUpCode);
  const { link } = await readVerifyEmail(request, email);

  const elsewhere = await browser.newContext({ baseURL: APP });
  const other = await elsewhere.newPage();
  await other.goto(link);
  await expect(other.getByRole("heading", { name: "Confirm your email" })).toBeVisible();
  expect(other.url()).not.toContain("token=");
  await expectNoAxeViolations(other);
  await other.getByRole("button", { name: "Confirm email" }).click();
  await expect(other.getByRole("heading", { name: "Email confirmed" })).toBeVisible();
  await expect(other.getByText("Nothing else changes in your account.")).toBeVisible();
  await other.goto(link.replace(/#.*$/, ""));
  await expect(other.getByText(/This page lost its link/)).toBeVisible();
  await elsewhere.close();

  await signedIn(page, request);
  await page.goto("/settings");
  await expect(page.getByText("Requires your current password")).toBeVisible();
  await expect(stripe(page)).toHaveCount(0);
});

test("a sign-up's link creates the account in another browser without signing anybody in", async ({
  browser,
}) => {
  const email = uniqueEmail("verify-ready");
  const inbox = await browser.newContext({ baseURL: APP });
  const started = await inbox.request.post("/api/auth/sign-up", {
    headers: { origin: APP },
    data: { name: "Ready E2E", email, password: PASSWORD, captcha: TEST_CAPTCHA },
  });
  expect(started.status(), await started.text()).toBe(202);
  const { link } = await readVerifyEmail(inbox.request, email);

  const elsewhere = await browser.newContext({ baseURL: APP });
  const other = await elsewhere.newPage();
  await other.goto(link);
  await other.getByRole("button", { name: "Confirm email" }).click();
  await expect(other.getByRole("heading", { name: "Your account is ready" })).toBeVisible();
  await other.getByRole("link", { name: "Sign in" }).click();
  await expect(other).toHaveURL(/\/login$/);
  await elsewhere.close();

  const login = await inbox.request.post("/api/auth/login", {
    headers: { origin: APP },
    data: { email, password: PASSWORD },
  });
  expect(login.ok(), await login.text()).toBe(true);
  await inbox.close();
});

test("past its deadline the account opens nothing until its email is confirmed", async ({
  page,
  request,
}) => {
  const { email, signUpCode } = await fromBeforeEmail(request, "verify-door", "passed");
  const blocked = await request.get("/api/accounts", { headers: { origin: APP } });
  expect(blocked.status()).toBe(403);
  expect(((await blocked.json()) as { code: string }).code).toBe("EMAIL_CONFIRMATION_REQUIRED");

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${APP}/confirm-to-continue`, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Confirm your email to continue" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto("/home");
  await expect(page).toHaveURL(`${APP}/confirm-to-continue`, { timeout: 15_000 });

  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible();
  await page.getByLabel("6-digit code").fill(await newCode(request, email, signUpCode));
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(`${APP}/home`, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect((await page.request.get("/api/accounts", { headers: { origin: APP } })).status()).toBe(
    200,
  );
});
