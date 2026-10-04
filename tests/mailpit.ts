import { type APIRequestContext, type APIResponse, expect } from "./fixtures";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";
const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";

// Cloudflare's dummy token: the suite's backend holds the test secret, which passes any token.
export const TEST_CAPTCHA = "XXXX.DUMMY.TOKEN.XXXX";

export interface ResetEmail {
  code: string;
  link: string;
}

export type VerifyEmail = ResetEmail;

interface Search {
  messages: { ID: string }[];
}

const codeIn = (text: string) => /^\s*(\d{6})\s*$/m.exec(text)?.[1];

const linkIn = (text: string, page: string) =>
  new RegExp(`https?://[^/\\s]+(/(?:[a-z]{2}/)?${page}#token=[\\w-]+)`).exec(text)?.[1];

// Other emails reach the same address, so the newest message is read only once it is the one wanted.
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
  return { code, link };
}

interface Listed {
  messages: { Subject: string; Created: string }[];
}

// The subjects of what reached an address since a moment: other specs email the same addresses.
export async function subjectsSince(
  request: APIRequestContext,
  to: string,
  since: number,
): Promise<string[]> {
  const response = await request.get(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
  );
  const { messages } = (await response.json()) as Listed;
  return messages.filter((message) => Date.parse(message.Created) >= since).map((m) => m.Subject);
}

export async function readRestoreLink(request: APIRequestContext, to: string): Promise<string> {
  const link = linkIn(await readLatestText(request, to, "restore"), "restore");
  if (!link) throw new Error(`no restore link in the email to ${to}`);
  return link;
}

export async function readUndoLink(request: APIRequestContext, to: string): Promise<string> {
  const link = linkIn(await readLatestText(request, to, "undo"), "undo");
  if (!link) throw new Error(`no undo link in the email to ${to}`);
  return link;
}

export interface SignUpData {
  name: string;
  email: string;
  password: string;
  currency?: string;
  timezone?: string;
  locale?: "en" | "es";
  captcha?: string;
}

// Creating an account takes the code its sign-up email carries; the answer is the session, as a login's.
export async function signUpWithCode(
  request: APIRequestContext,
  data: SignUpData,
): Promise<APIResponse> {
  const started = await request.post("/api/auth/sign-up", {
    headers: { origin: APP },
    data: { captcha: TEST_CAPTCHA, ...data },
  });
  expect(started.status(), await started.text()).toBe(202);
  const { code } = await readVerifyEmail(request, data.email.trim().toLowerCase());
  return request.post("/api/auth/sign-up/confirm", { headers: { origin: APP }, data: { code } });
}

export async function readEmailChangeEmail(
  request: APIRequestContext,
  to: string,
): Promise<ResetEmail> {
  const text = await readLatestText(request, to, "confirm-email");
  const code = codeIn(text);
  const link = linkIn(text, "confirm-email");
  if (!code || !link) throw new Error(`no code or link in the email to ${to}`);
  return { code, link };
}
