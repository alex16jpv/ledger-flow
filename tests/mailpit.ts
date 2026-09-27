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

interface Options {
  after?: number;
}

async function readLatestText(
  request: APIRequestContext,
  to: string,
  { after = 0 }: Options,
): Promise<string> {
  let id = "";
  await expect
    .poll(
      async () => {
        const response = await request.get(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
        );
        const { messages } = (await response.json()) as Search;
        id = messages.length > after ? (messages[0]?.ID ?? "") : "";
        return id;
      },
      { message: `an email for ${to}`, timeout: 15_000 },
    )
    .not.toBe("");
  const message = (await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json()) as {
    Text: string;
  };
  return message.Text;
}

const codeIn = (text: string) => /^\s*(\d{6})\s*$/m.exec(text)?.[1];

const linkIn = (text: string, page: string) =>
  new RegExp(`https?://[^/\\s]+(/(?:[a-z]{2}/)?${page}#token=[\\w-]+)`).exec(text)?.[1];

export async function readResetEmail(
  request: APIRequestContext,
  to: string,
  options: Options = {},
): Promise<ResetEmail> {
  const text = await readLatestText(request, to, options);
  const code = codeIn(text);
  const link = linkIn(text, "reset");
  if (!code || !link) throw new Error(`no code or link in the email to ${to}`);
  return { code, link };
}

export async function readVerifyEmail(
  request: APIRequestContext,
  to: string,
  options: Options = {},
): Promise<VerifyEmail> {
  const text = await readLatestText(request, to, options);
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
