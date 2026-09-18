import { accountKeys } from "./keys";
import { ACCOUNT_TYPES, accountFormSchema } from "./schemas";

describe("accounts", () => {
  it("nests keys under the feature root", () => {
    expect(accountKeys.list()[0]).toBe("accounts");
    expect(accountKeys.list(true)).toEqual(["accounts", "list", { includeArchived: true }]);
  });

  it("validates the account form with message keys", () => {
    expect(ACCOUNT_TYPES).toHaveLength(9);
    const empty = { balance: null, creditLimit: null, borrowedAmount: null };
    const result = accountFormSchema.safeParse({
      name: " ",
      type: "ACCOUNT",
      color: "BLUE",
      ...empty,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("validation.required");
    expect(
      accountFormSchema.safeParse({
        name: "Cash",
        type: "CASH",
        color: "GRAY",
        ...empty,
        balance: 100,
      }).success,
    ).toBe(true);
  });

  it("refuses a debt amount of zero or less, and takes none at all", () => {
    const card = {
      name: "Visa",
      type: "CARD" as const,
      balance: -100,
      borrowedAmount: null,
      color: "PURPLE" as const,
    };
    expect(accountFormSchema.safeParse({ ...card, creditLimit: null }).success).toBe(true);
    expect(accountFormSchema.safeParse({ ...card, creditLimit: 4000000 }).success).toBe(true);
    const zero = accountFormSchema.safeParse({ ...card, creditLimit: 0 });
    expect(zero.success).toBe(false);
    expect(zero.error?.issues[0]?.message).toBe("validation.amountPositive");
  });
});
