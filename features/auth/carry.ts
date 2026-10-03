"use client";

let email = "";

export function carryEmail(value: string): void {
  email = value.trim();
}

export function carriedEmail(): string {
  return email;
}

export interface SentCode {
  email: string;
  resendAt: number;
}

const CODE_LIFETIME_MS = 30 * 60_000;

let sentCode: (SentCode & { at: number }) | null = null;

export function rememberSentCode(value: SentCode | null): void {
  sentCode = value && { ...value, at: Date.now() };
}

export function lastSentCode(): SentCode | null {
  if (sentCode && Date.now() - sentCode.at > CODE_LIFETIME_MS) sentCode = null;
  return sentCode && { email: sentCode.email, resendAt: sentCode.resendAt };
}

export type LinkPurpose = "reset" | "verify" | "confirm-email" | "restore";

const linkTokens = new Map<LinkPurpose, string>();

export function keepLinkToken(purpose: LinkPurpose, value: string | null): void {
  if (value === null) linkTokens.delete(purpose);
  else linkTokens.set(purpose, value);
}

export function keptLinkToken(purpose: LinkPurpose): string | null {
  return linkTokens.get(purpose) ?? null;
}
