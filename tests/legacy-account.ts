import { createRequire } from "node:module";
import { resolve } from "node:path";

// Nothing in the API makes an account from before email any more, so the suite turns a new one into one.
const BACKEND_DIR = resolve(process.env.E2E_BACKEND_DIR ?? "../lag-money-manager");
const MONGO_URI =
  process.env.E2E_MONGO_URI ??
  "mongodb://localhost:27017/lag_money_test?replicaSet=rs0&directConnection=true";
const DEADLINE_ZONE = "America/Bogota";
const DAY_MS = 24 * 60 * 60 * 1000;

interface Users {
  updateOne(filter: object, update: object): Promise<{ matchedCount: number }>;
}

interface MongoClientLike {
  connect(): Promise<unknown>;
  db(): { collection(name: string): Users };
  close(): Promise<void>;
}

const { MongoClient } = createRequire(resolve(BACKEND_DIR, "package.json"))("mongodb") as {
  MongoClient: new (uri: string) => MongoClientLike;
};

const dayIn = (instant: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: DEADLINE_ZONE }).format(new Date(instant));

export type Deadline = "none" | "ahead" | "passed";

export interface LegacyAccount {
  confirmBy: string | null;
}

export async function makeAccountFromBeforeEmail(
  email: string,
  deadline: Deadline = "none",
): Promise<LegacyAccount> {
  const endsAt = deadline === "passed" ? Date.now() - 60_000 : Date.now() + 10 * DAY_MS;
  const confirmBy = deadline === "none" ? null : dayIn(endsAt);
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  try {
    const { matchedCount } = await client
      .db()
      .collection("users")
      .updateOne(
        { email },
        {
          $set: {
            emailVerifiedAt: null,
            confirmDeadline: confirmBy
              ? { day: confirmBy, endsAt: new Date(endsAt), remindedAt: null, links: [] }
              : null,
          },
        },
      );
    if (matchedCount !== 1) throw new Error(`no account for ${email} in the test database`);
  } finally {
    await client.close();
  }
  return { confirmBy };
}
