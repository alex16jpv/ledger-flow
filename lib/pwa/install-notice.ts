const KEY = "lf.installNotice";
const SNOOZE_DAYS = 7;
const GIVE_UP_AFTER = 3;

interface NoticeState {
  dismissals: number;
  until: number;
}

// P-34: "Not now" hides it for a week, and the third time it never comes back. The rows in Settings
// keep saying the same thing without insisting, so this can afford to give up.
function read(): NoticeState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { dismissals: 0, until: 0 };
    const parsed = JSON.parse(raw) as Partial<NoticeState>;
    return {
      dismissals: typeof parsed.dismissals === "number" ? parsed.dismissals : 0,
      until: typeof parsed.until === "number" ? parsed.until : 0,
    };
  } catch {
    return { dismissals: 0, until: 0 };
  }
}

export function installNoticeSilenced(now = Date.now()): boolean {
  const state = read();
  return state.dismissals >= GIVE_UP_AFTER || state.until > now;
}

export function snoozeInstallNotice(now = Date.now()): void {
  const state = read();
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        dismissals: state.dismissals + 1,
        until: now + SNOOZE_DAYS * 24 * 60 * 60 * 1000,
      }),
    );
  } catch {
    return;
  }
}
