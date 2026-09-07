// The e2e build emits its own worker so it never overwrites the running app's `public/sw.js` (F-56).
export const SW_PATH = process.env.NEXT_PUBLIC_SW_PATH ?? "/sw.js";
