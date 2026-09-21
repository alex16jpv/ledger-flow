import { expect, type Page, test, uniqueEmail } from "../fixtures";
import { expectNoAxeViolations } from "./axe";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

// Every mutation runs on a throwaway user with its ten seeded categories, so the seed stays untouched.
async function signUp(page: Page, request: Request) {
  const response = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name: "Shared E2E", email: uniqueEmail("shared"), password: "LedgerFlow!2026" },
  });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

async function anExpense(request: Request, amount: number, description: string) {
  const accounts = await request.post("/api/accounts", {
    headers: { origin: APP },
    data: { name: `Bancolombia ${description}`, type: "ACCOUNT", balance: 2_000_000 },
  });
  expect(accounts.ok()).toBe(true);
  const categories = await request.get("/api/categories?type=EXPENSE&limit=1", {
    headers: { origin: APP },
  });
  const created = await request.post("/api/transactions", {
    headers: { origin: APP },
    data: {
      type: "EXPENSE",
      amount,
      date: "2026-09-20T20:00:00.000Z",
      description,
      fromAccountId: ((await accounts.json()) as { id: string }).id,
      categoryId: ((await categories.json()) as { data: { id: string }[] }).data[0]?.id,
    },
  });
  expect(created.ok()).toBe(true);
}

test("a person, a group made from a movement already recorded, and what it counts as yours", async ({
  page,
  request,
}) => {
  await signUp(page, request);
  await anExpense(request, 100_000, "Food");

  await page.goto("/shared");
  await expect(page.getByRole("heading", { level: 1, name: "Shared" })).toBeVisible();
  // Nothing at all: the two faces are not drawn, because there is nothing to switch between.
  await expect(page.getByText("Nothing shared yet")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Shared groups$/ })).toHaveCount(0);
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByPlaceholder("Beto Cano").fill("Ana Ruiz");
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByText("Person added")).toBeVisible();
  // A person you keep is a row of her own, before anything is split with her.
  await expect(page.getByRole("button", { name: /^Settled/ })).toBeVisible();

  await page.getByRole("link", { name: "New shared group" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "New shared group" })).toBeVisible();
  await page.getByPlaceholder("Cartagena trip").fill("Night out");

  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByRole("checkbox", { name: /Ana Ruiz/ }).check({ force: true });
  await page.getByRole("button", { name: "Add 1" }).click();

  await page.getByRole("button", { name: "Pick from my transactions" }).click();
  await page.getByRole("checkbox", { name: /Food/ }).check({ force: true });
  await page.getByRole("button", { name: /^Add 1 · / }).click();
  await expect(page.getByText(/1 selected · /)).toBeVisible();

  await page.getByRole("button", { name: "Create shared group" }).click();
  // What it changes in the budgets is said before saving, and the answer is: nothing, today.
  await expect(page.getByText(/Nothing changes in your budgets today/)).toBeVisible();
  await page.getByRole("button", { name: "Add 1 expense" }).click();

  // The detail leads with what still counts as yours, which splitting does not lower.
  await expect(page.getByRole("heading", { level: 1, name: "Shared group" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Night out" })).toBeVisible();
  await expect(page.getByText(/counts as yours/)).toContainText("total $100,000");
  await expect(page.getByText(/counts as yours/)).toContainText("your share $50,000");
  await expect(page.getByRole("heading", { name: "Expenses · 1" })).toBeVisible();
  await expect(page.getByText("Ana Ruiz")).toBeVisible();
  await expect(page.getByText("Nothing paid yet · owes you $50,000")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("settling up lowers what counts as yours, in the month the expense happened", async ({
  page,
  request,
}) => {
  await signUp(page, request);
  await anExpense(request, 100_000, "Dinner");

  await page.goto("/shared");
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByPlaceholder("Beto Cano").fill("Beto Cano");
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByText("Person added")).toBeVisible();

  await page.getByRole("link", { name: "New shared group" }).first().click();
  await page.getByPlaceholder("Cartagena trip").fill("Night out");
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByRole("checkbox", { name: /Beto Cano/ }).check({ force: true });
  await page.getByRole("button", { name: "Add 1" }).click();
  await page.getByRole("button", { name: "Pick from my transactions" }).click();
  await page.getByRole("checkbox", { name: /Dinner/ }).check({ force: true });
  await page.getByRole("button", { name: /^Add 1 · / }).click();
  await page.getByRole("button", { name: "Create shared group" }).click();
  await page.getByRole("button", { name: "Add 1 expense" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Night out" })).toBeVisible();

  // One person with something open, so the group's primary action opens her sheet straight away.
  await page.getByRole("button", { name: "Settle up" }).click();
  const sheet = page.getByRole("dialog", { name: "Settle up with Beto Cano" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("This is not income.")).toBeVisible();
  await sheet.getByRole("button", { name: /Where it arrives/ }).click();
  await page.getByRole("option", { name: /Bancolombia Dinner/ }).click();
  await sheet.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Payment recorded")).toBeVisible();

  // The money came back, so the group's lead figure falls by it; nobody is left owing.
  await expect(page.getByText(/counts as yours/)).toContainText("total $100,000");
  await expect(page.getByRole("heading", { level: 2, name: "Night out" })).toBeVisible();
  await expect(page.getByText("Paid in full")).toBeVisible();

  // And the movement says the same thing, with the history that explains it.
  await page.goto("/transactions");
  await expect(page.getByText("Your share $50,000")).toBeVisible();
  await page
    .getByRole("button", { name: /^Dinner/ })
    .first()
    .click();
  await expect(page.getByText(/counts as yours, and it is what Stats/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByText("Somebody paid you back")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("adding somebody to a group that exists shows the whole result before it happens", async ({
  page,
  request,
}) => {
  await signUp(page, request);
  await anExpense(request, 90_000, "Hotel");

  await page.goto("/shared");
  for (const name of ["Ana Ruiz", "Beto Cano"]) {
    await page.getByRole("button", { name: "Add a person" }).click();
    await page.getByPlaceholder("Beto Cano").fill(name);
    await page.getByRole("button", { name: "Add person" }).click();
    await expect(page.getByText("Person added")).toBeVisible();
  }

  await page.getByRole("link", { name: "New shared group" }).first().click();
  await page.getByPlaceholder("Cartagena trip").fill("Cartagena trip");
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByRole("checkbox", { name: /Ana Ruiz/ }).check({ force: true });
  await page.getByRole("button", { name: "Add 1" }).click();
  await page.getByRole("button", { name: "Pick from my transactions" }).click();
  await page.getByRole("checkbox", { name: /Hotel/ }).check({ force: true });
  await page.getByRole("button", { name: /^Add 1 · / }).click();
  await page.getByRole("button", { name: "Create shared group" }).click();
  await page.getByRole("button", { name: "Add 1 expense" }).click();
  await expect(page.getByText("Nothing paid yet · owes you $45,000")).toBeVisible();

  await page.getByRole("button", { name: "Add people" }).click();
  const sheet = page.getByRole("dialog", { name: "Add people" });
  await expect(sheet).toBeVisible();
  // Somebody already in the group is a row that reads, not one that picks.
  await expect(sheet.getByText("Already in")).toBeVisible();
  await sheet.getByRole("checkbox", { name: /Beto Cano/ }).check({ force: true });

  // Off is the default: they are in what you add from now on and in none of what is there.
  await sheet.getByRole("switch").click();
  await expect(sheet.getByText("How Cartagena trip would end up")).toBeVisible();
  await expect(sheet.getByText("Your share would be $30,000")).toBeVisible();
  await expect(sheet.getByText(/What counts as yours does not move/)).toBeVisible();
  await expectNoAxeViolations(page);

  await sheet.getByRole("button", { name: "Add Beto Cano" }).click();
  await expect(page.getByText("1 person added")).toBeVisible();
  await expect(page.getByText("Nothing paid yet · owes you $30,000").first()).toBeVisible();

  // And the group itself is editable: its name, its colour and the split it hands down.
  await page.getByRole("button", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit this shared group" });
  await edit.getByRole("textbox").first().fill("Cartagena, the trip");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Shared group saved")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Cartagena, the trip" })).toBeVisible();
});

test("recording a new expense from inside the group writes the movement and the line at once", async ({
  page,
  request,
}) => {
  await signUp(page, request);
  // An account to spend from, and nothing recorded yet: the group is made before the expense exists.
  await anExpense(request, 10_000, "Coffee");

  await page.goto("/shared");
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByPlaceholder("Beto Cano").fill("Ana Ruiz");
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByText("Person added")).toBeVisible();

  await page.getByRole("link", { name: "New shared group" }).first().click();
  await page.getByPlaceholder("Cartagena trip").fill("Night out");
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByRole("checkbox", { name: /Ana Ruiz/ }).check({ force: true });
  await page.getByRole("button", { name: "Add 1" }).click();
  await page.getByRole("button", { name: "Create shared group" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Night out" })).toBeVisible();

  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByRole("button", { name: "Record a new expense" }).click();

  // The form knows the group, says the split it will inherit, and offers no type to choose.
  await expect(page.getByText(/This goes into Night out/)).toContainText(
    "split equally between 2 people",
  );
  await expect(page.getByRole("group", { name: "Type" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Amount" }).fill("120000");
  await page.getByRole("button", { name: /^Account/ }).click();
  await page.getByRole("option", { name: /Bancolombia Coffee/ }).click();
  await page.getByRole("textbox", { name: /^Description/ }).fill("Beach club");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Save and add to the group" }).click();

  // Back in the group, with the line split by the group's default and nothing else asked.
  await expect(page.getByRole("heading", { level: 2, name: "Night out" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Expenses · 1" })).toBeVisible();
  await expect(page.getByText("Beach club")).toBeVisible();
  await expect(page.getByText(/counts as yours/)).toContainText("total $120,000");
  await expect(page.getByText(/counts as yours/)).toContainText("your share $60,000");
  await expect(page.getByText("Nothing paid yet · owes you $60,000")).toBeVisible();

  // And it is a movement of yours like any other, with its shared card on it.
  await page.goto("/transactions");
  await expect(page.getByText("Your share $60,000")).toBeVisible();
});
