import {
  array,
  boolean,
  config,
  email,
  enum as choice,
  literal,
  number,
  object,
  string,
  union,
  url,
} from "zod";

export type { infer as Infer } from "zod";

// F-67: `jitless` skips Zod's `new Function` probe, which the CSP reports before the catch.
config({ jitless: true });

// F-70: named imports, because a `z` namespace keeps the nineteen locale catalogues reachable.
export const z = {
  array,
  boolean,
  email,
  enum: choice,
  literal,
  number,
  object,
  string,
  union,
  url,
};
