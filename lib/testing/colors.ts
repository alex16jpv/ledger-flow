import { COLOR_TOKENS, type ColorToken } from "@/lib/theme/feature-color";

export function drawOf(token: ColorToken): number {
  return COLOR_TOKENS.indexOf(token) / COLOR_TOKENS.length;
}
