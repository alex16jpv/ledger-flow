import { ERROR_CODES, type ErrorCode } from "@/lib/api/errors";
import { CATEGORY_ICON_KEYS, type CategoryIconKey } from "@/lib/icons/category-icons";
import { COLOR_TOKENS, type ColorToken } from "@/lib/theme/feature-color";
import type { components } from "@/types/api";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type ApiColor = NonNullable<components["schemas"]["Account"]["color"]>;
type ApiIcon = NonNullable<components["schemas"]["Category"]["icon"]>;
type ApiErrorCode = NonNullable<components["schemas"]["ErrorResponse"]["code"]>;

export type ColorsMatchContract = Expect<Equal<ColorToken, ApiColor>>;
export type IconsMatchContract = Expect<Equal<CategoryIconKey, ApiIcon>>;
export type ErrorCodesMatchContract = Expect<Equal<ErrorCode, ApiErrorCode>>;

describe("contract with types/api.d.ts", () => {
  it("keeps the runtime lists aligned with the generated enums", () => {
    expect(COLOR_TOKENS).toHaveLength(16);
    expect(CATEGORY_ICON_KEYS).toHaveLength(105);
    expect(ERROR_CODES.length).toBeGreaterThan(20);
  });
});
