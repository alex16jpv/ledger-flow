import { type APIRequestContext, expect } from "./fixtures";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";
const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";

// Cloudflare's dummy token: the suite's backend holds the test secret, which passes any token.
export const TEST_CAPTCHA = "XXXX.DUMMY.TOKEN.XXXX";

export interface ResetEmail {
  code: string;
  link: string;
}

export interface VerifyEmail {
  code: string;
  link: string;
  notMe: string | null;
}

interface Search {
  messages: { ID: string }[];
}

const codeIn = (text: string) => /^\s*(\d{6})\s*$/m.exec(text)?.[1];

const linkIn = (text: string, page: string) =>
  new RegExp(`https?://[^/\\s]+(/(?:[a-z]{2}/)?${page}#token=[\\w-]+)`).exec(text)?.[1];

// Registering sends verify-email too, so the newest message is read only once it is the one wanted.
async function readLatestText(
  request: APIRequestContext,
  to: string,
  page: string,
): Promise<string> {
  let text = "";
  await expect
    .poll(
      async () => {
        const response = await request.get(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
        );
        const { messages } = (await response.json()) as Search;
        const id = messages[0]?.ID;
        if (!id) return "";
        const message = (await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json()) as {
          Text: string;
        };
        text = linkIn(message.Text, page) ? message.Text : "";
        return text;
      },
      { message: `a ${page} email for ${to}`, timeout: 15_000 },
    )
    .not.toBe("");
  return text;
}

export async function readResetEmail(request: APIRequestContext, to: string): Promise<ResetEmail> {
  const text = await readLatestText(request, to, "reset");
  const code = codeIn(text);
  const link = linkIn(text, "reset");
  if (!code || !link) throw new Error(`no code or link in the email to ${to}`);
  return { code, link };
}

export async function readVerifyEmail(
  request: APIRequestContext,
  to: string,
): Promise<VerifyEmail> {
  const text = await readLatestText(request, to, "verify");
  const code = codeIn(text);
  const link = linkIn(text, "verify");
  if (!code || !link) throw new Error(`no code or link in the email to ${to}`);
  return { code, link, notMe: linkIn(text, "not-me") ?? null };
}

// For a session registered with TEST_CAPTCHA: the code its verify-email carries confirms it.
export async function confirmEmailOf(request: APIRequestContext, email: string): Promise<void> {
  const { code } = await readVerifyEmail(request, email);
  const response = await request.post("/api/auth/verify", {
    headers: { origin: APP },
    data: { code },
  });
  expect(response.ok()).toBe(true);
}
