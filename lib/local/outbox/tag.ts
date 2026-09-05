// Shared with the service worker, which cannot import the engine without pulling the whole app
// bundle into `public/sw.js`: the worker listens for this `sync` tag and posts it back (F-24).
export const OUTBOX_SYNC_TAG = "ledger-flow-outbox";
