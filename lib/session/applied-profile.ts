const APPLIED_KEY = "lf.profileApplied";

export type AppliedField = "theme" | "locale";

type Applied = { userId: string } & Partial<Record<AppliedField, string>>;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function stored(userId: string): Applied {
  try {
    const raw = storage()?.getItem(APPLIED_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (typeof value !== "object" || value === null) return { userId };
    const { userId: owner, theme, locale } = value as Record<string, unknown>;
    if (owner !== userId) return { userId };
    return {
      userId,
      ...(typeof theme === "string" ? { theme } : {}),
      ...(typeof locale === "string" ? { locale } : {}),
    };
  } catch {
    return { userId };
  }
}

const later = (a: string, b: string) => Date.parse(a) > Date.parse(b);

export const appliedProfile = {
  isNews: (userId: string, field: AppliedField, updatedAt: string): boolean => {
    const at = stored(userId)[field];
    return at === undefined || later(updatedAt, at);
  },
  note: (userId: string, field: AppliedField, updatedAt: string): void => {
    const applied = stored(userId);
    const at = applied[field];
    if (at !== undefined && !later(updatedAt, at)) return;
    try {
      storage()?.setItem(APPLIED_KEY, JSON.stringify({ ...applied, [field]: updatedAt }));
    } catch {
      return;
    }
  },
  forget: (): void => {
    try {
      storage()?.removeItem(APPLIED_KEY);
    } catch {
      return;
    }
  },
};
