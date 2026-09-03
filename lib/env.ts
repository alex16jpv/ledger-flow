import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    API_URL: z.url(),
    API_SECRET: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_CONTACT_EMAIL: z.email(),
    NEXT_PUBLIC_APP_VERSION: z.string().min(1).default("dev"),
    NEXT_PUBLIC_APP_ENV: z.enum(["development", "test", "production"]).optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
    NEXT_PUBLIC_VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  },
  shared: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  runtimeEnv: {
    API_URL: process.env.API_URL,
    API_SECRET: process.env.API_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
  },
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
