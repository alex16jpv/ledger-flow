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

let resetToken: string | null = null;

export function keepResetToken(value: string | null): void {
  resetToken = value;
}

export function keptResetToken(): string | null {
  return resetToken;
}
