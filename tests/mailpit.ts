import { type APIRequestContext, expect } from "./fixtures";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";

export interface ResetEmail {
  code: string;
  link: string;
}

interface Search {
  messages: { ID: string }[];
}

export async function readResetEmail(
  request: APIRequestContext,
  to: string,
  { after = 0 }: { after?: number } = {},
): Promise<ResetEmail> {
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
  const code = /^\s*(\d{6})\s*$/m.exec(message.Text)?.[1];
  const link = /https?:\/\/[^/\s]+(\/(?:[a-z]{2}\/)?reset#token=[\w-]+)/.exec(message.Text)?.[1];
  if (!code || !link) throw new Error(`no code or link in the email to ${to}`);
  return { code, link };
}
