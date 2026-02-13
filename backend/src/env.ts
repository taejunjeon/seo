import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(7020),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:7010"),
  GSC_SITE_URL: z.string().min(1).default("sc-domain:biocom.kr"),
  GSC_SERVICE_ACCOUNT_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  PAGESPEED_API_KEY: z.string().optional(),
  GA4_PROPERTY_ID: z.string().optional(),
  GA4_SERVICE_ACCOUNT_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(8).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment variables: ${details}`);
}

export const env = parsed.data;
