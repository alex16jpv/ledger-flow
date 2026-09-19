import { INCOME_REFUSED_ON, INCOME_REFUSED_TYPES } from "@/lib/accounts/debt";
import { ERROR_CODES, type ErrorCode } from "@/lib/api/errors";
import { ZERO_DECIMAL_CURRENCIES } from "@/lib/format/currency";
import { CATEGORY_ICON_KEYS, type CategoryIconKey } from "@/lib/icons/category-icons";
import { COLOR_TOKENS, type ColorToken } from "@/lib/theme/feature-color";
import type { components } from "@/types/api";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type ApiColor = NonNullable<components["schemas"]["Account"]["color"]>;
type ApiIcon = NonNullable<components["schemas"]["Category"]["icon"]>;
type ApiErrorCode = NonNullable<components["schemas"]["ErrorResponse"]["code"]>;
type ApiIncomeRefused = components["schemas"]["IncomeRefusedAccountType"];
type ApiZeroDecimal = components["schemas"]["ZeroDecimalCurrency"];

export type ColorsMatchContract = Expect<Equal<ColorToken, ApiColor>>;
export type IconsMatchContract = Expect<Equal<CategoryIconKey, ApiIcon>>;
export type ErrorCodesMatchContract = Expect<Equal<ErrorCode, ApiErrorCode>>;
export type IncomeRefusalMatchesContract = Expect<
  Equal<(typeof INCOME_REFUSED_ON)[number], ApiIncomeRefused>
>;
export type ZeroDecimalMatchesContract = Expect<
  Equal<(typeof ZERO_DECIMAL_CURRENCIES)[number], ApiZeroDecimal>
>;

describe("contract with types/api.d.ts", () => {
  it("keeps the runtime lists aligned with the generated enums", () => {
    expect(COLOR_TOKENS).toHaveLength(16);
    expect(CATEGORY_ICON_KEYS).toHaveLength(105);
    expect(ERROR_CODES.length).toBeGreaterThan(20);
    expect(INCOME_REFUSED_TYPES.size).toBe(INCOME_REFUSED_ON.length);
    expect(ZERO_DECIMAL_CURRENCIES).toHaveLength(34);
  });
});
