import { accountKeys } from "./keys";
import { ACCOUNT_TYPES, accountFormSchema } from "./schemas";

describe("accounts", () => {
  it("nests keys under the feature root", () => {
    expect(accountKeys.list()[0]).toBe("accounts");
    expect(accountKeys.list(true)).toEqual(["accounts", "list", { includeArchived: true }]);
  });

  it("validates the account form with message keys", () => {
    expect(ACCOUNT_TYPES).toHaveLength(9);
    const result = accountFormSchema.safeParse({
      name: " ",
      type: "ACCOUNT",
      balance: null,
      color: "BLUE",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("validation.required");
    expect(
      accountFormSchema.safeParse({ name: "Cash", type: "CASH", balance: 100, color: "GRAY" })
        .success,
    ).toBe(true);
  });
});
