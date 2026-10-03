import { expect, type Page, test, uniqueEmail } from "../fixtures";
import { readVerifyEmail, signUpWithCode } from "../mailpit";
import { expectNoAxeViolations } from "./axe";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const PASSWORD = "LedgerFlow!2026";
const SEED_EMAIL = "seed@ledgerflow.test";

// A streamed form that renders again on the client keeps its hidden server copy for a frame.
const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).filter({ visible: true });

async function fillTheForm(page: Page, email: string, password = PASSWORD) {
  await page.getByRole("textbox", { name: "Name" }).fill("Register E2E");
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(password);
  await page.getByRole("checkbox").check({ force: true });
}

test("Create account sends a code, and the account exists once it is typed", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("register");
  await page.goto("/register");
  await expectNoAxeViolations(page);
  const submit = page.getByRole("button", { name: "Create account" });
  await expect(submit).toBeDisabled();
  await fillTheForm(page, email);
  await expect(page.getByText(/Detected from your region/)).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(email)).toBeVisible();
  await expect(page).toHaveURL(`${APP}/register`);
  await expectNoAxeViolations(page);

  // The step is this browser's for 24 hours: a reload lands on it again.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  const { code } = await readVerifyEmail(request, email);
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(`${APP}/onboarding`, { timeout: 15_000 });

  await page.goto("/home");
  await expect(page.getByRole("status").filter({ hasText: "Confirm your email" })).toHaveCount(0);
});

// The seed's address has an account and no sign-up of its own a minute ago, so its brake is free.
test("an address with an account reads the same, and no code it can type creates anything", async ({
  page,
}) => {
  test.skip(
    test.info().project.name === "mobile",
    "one sign-up a minute per address, and both projects would ask for the same one",
  );
  await page.goto("/register");
  await fillTheForm(page, SEED_EMAIL, "Someone-else!2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(SEED_EMAIL)).toBeVisible();
  await expect(page.getByText(/already has an account/)).toHaveCount(0);

  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/That code doesn’t work/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();
});

test("Change it goes back to the form with the email, and without the password", async ({
  page,
}) => {
  const email = uniqueEmail("change-it");
  await page.goto("/register");
  await fillTheForm(page, email);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Change it" }).click({ timeout: 15_000 });
  await expect(field(page, "Email")).toHaveValue(email);
  await expect(field(page, "Password")).toHaveValue("");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
});

test("a deleted account is not taken back by Create account: Sign in restores it", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("restore");
  const registered = await signUpWithCode(request, { name: "Before", email, password: PASSWORD });
  expect(registered.ok(), await registered.text()).toBe(true);
  const { user } = (await registered.json()) as { user: { id: string } };
  const deleted = await request.delete(`/api/users/${user.id}`, {
    headers: { origin: APP },
    data: { currentPassword: PASSWORD },
  });
  expect(deleted.ok(), await deleted.text()).toBe(true);
  const { keptUntil } = (await deleted.json()) as { keptUntil: string };
  await request.post("/api/auth/logout", { headers: { origin: APP } });

  await page.goto("/login");
  await field(page, "Email").fill(email);
  await field(page, "Password").fill("Wrong-password!1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();

  await field(page, "Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Restore your account?" })).toBeVisible();
  const [year, month, day] = keptUntil.split("-").map(Number);
  const kept = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    dateStyle: "long",
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day)));
  await expect(page.getByText(kept)).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Not now" }).click();
  await expect(field(page, "Email")).toHaveValue(email);
  await field(page, "Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Restore account" }).click();
  await expect(page).toHaveURL(`${APP}/home`, { timeout: 15_000 });
  await expect(page.getByText("Account restored")).toBeVisible();
});

test("the currency picker opens with the search box focused", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: /[A-Z]{3} · / }).click();
  const dialog = page.getByRole("dialog", { name: "Choose your currency" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("searchbox", { name: "Search" })).toBeFocused();
  await page.keyboard.type("euro");
  await expect(dialog.getByRole("option", { name: /EUR/ })).toBeVisible();
});
