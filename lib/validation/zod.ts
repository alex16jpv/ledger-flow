import { z } from "zod";

// F-67: Zod probes for `new Function("")` the first time it compiles a schema, to decide whether it
// can JIT its validators. The throw is caught, but the browser files the `securitypolicyviolation`
// before the catch runs, so every page load reported a blocked `eval` — 229 in one e2e run. `jitless`
// skips the probe and takes the interpreted path, which is the path a CSP without `unsafe-eval`
// leaves it anyway.
//
// It lives here, and every schema imports `z` from here, so the configuration is set before the
// first schema is built. Setting it in `instrumentation-client.ts` would work too, and would put the
// whole of Zod in the bundle every page loads — including the landing, which validates nothing.
z.config({ jitless: true });

export { z };
