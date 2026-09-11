import type { Platform } from "./platform";

const KEY = "lf.installNotice";

export interface NoticePolicy {
  snoozeDays: number;
  giveUpAfter: number | null;
}

// iOS never gives up: Safari deletes the copy and has no install prompt, so this is the only lever.
export const NOTICE_POLICY: Record<Platform, NoticePolicy | null> = {
  ios: { snoozeDays: 3, giveUpAfter: null },
  android: { snoozeDays: 7, giveUpAfter: 3 },
  desktop: null,
};

interface NoticeState {
  dismissals: number;
  until: number;
}

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

export function installNoticeSilenced(policy: NoticePolicy, now = Date.now()): boolean {
  const state = read();
  if (policy.giveUpAfter !== null && state.dismissals >= policy.giveUpAfter) return true;
  return state.until > now;
}

export function snoozeInstallNotice(policy: NoticePolicy, now = Date.now()): void {
  const state = read();
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        dismissals: state.dismissals + 1,
        until: now + policy.snoozeDays * 24 * 60 * 60 * 1000,
      }),
    );
  } catch {
    return;
  }
}
