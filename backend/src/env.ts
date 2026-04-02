import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSource = {
  ...process.env,
  KAKAO_REST_API_KEY: process.env.KAKAO_REST_API_KEY ?? process.env.KAKAO_BIOCOM_REST_API_KEY,
  KAKAO_JAVASCRIPT_KEY: process.env.KAKAO_JAVASCRIPT_KEY ?? process.env.KAKAO_BIOCOM_JavaScript_KEY,
  KAKAO_ADMIN_KEY: process.env.KAKAO_ADMIN_KEY ?? process.env.KAKAO_BIOCOM_Admin_KEY,
  TOSS_LIVE_SECRET_KEY: process.env.TOSS_LIVE_SECRET_KEY,
  TOSS_LIVE_CLIENT_KEY: process.env.TOSS_LIVE_CLIENT_KEY ?? process.env.TEST_LIVE_CLIENT_KEY,
  ALIGO_SENDER_KEY:
    process.env.ALIGO_SENDER_KEY
    ?? process.env.ALIGO_Senderkey
    ?? process.env.KAKAO_ALIGO_Senderkey,
  ALIGO_KAKAOCHANNEL_ID: process.env.ALIGO_KAKAOCHANNEL_ID ?? process.env.KAKAOCHANNEL_ID,
  CHANNELTALK_PLUGIN_KEY: process.env.CHANNELTALK_PLUGIN_KEY ?? process.env.CHANNELTALK_PLUGINKEY,
  CHANNELTALK_ACCESS_KEY: process.env.CHANNELTALK_ACCESS_KEY ?? process.env.CHANNELTALK_ACCESSKEY,
  CHANNELTALK_ACCESS_SECRET: process.env.CHANNELTALK_ACCESS_SECRET ?? process.env.CHANNELTALK_ACCESSSECRET,
  CHANNELTALK_MEMBER_HASH_SECRET:
    process.env.CHANNELTALK_MEMBER_HASH_SECRET ?? process.env.CHANNELTALK_MEMBERHASHSECRET,
  CHANNELTALK_MARKETING_ENABLED:
    process.env.CHANNELTALK_MARKETING_ENABLED ?? process.env.CHANNELTALK_MARKETINGENABLED,
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TRUST_PROXY: z.enum(["0", "1"]).default("0"),
  PORT: z.coerce.number().int().positive().default(7020),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:7010"),
  DATABASE_URL: z.string().min(1).optional(),
  REVENUE_API_BASE_URL: z.string().url().optional(),
  REVENUE_API_BEARER_TOKEN: z.string().min(1).optional(),
  GSC_SITE_URL: z.string().min(1).default("sc-domain:biocom.kr"),
  GSC_SERVICE_ACCOUNT_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  PAGESPEED_API_KEY: z.string().optional(),
  GA4_PROPERTY_ID: z.string().optional(),
  GA4_SERVICE_ACCOUNT_KEY: z.string().optional(),
  SERP_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),
  PERPLEXITY_MODEL: z.string().default("sonar-pro"),
  REDIS_URL: z.string().min(1).optional(),
  REDIS_PREFIX: z.string().default("biocom-seo:"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(8).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_SEARCH_MODEL: z.string().default("gpt-4o-mini"),
  CHANNELTALK_PLUGIN_KEY: z.string().min(1).optional(),
  CHANNELTALK_ACCESS_KEY: z.string().min(1).optional(),
  CHANNELTALK_ACCESS_SECRET: z.string().min(1).optional(),
  CHANNELTALK_MEMBER_HASH_SECRET: z.string().min(1).optional(),
  CHANNELTALK_MARKETING_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true" || value === "1"),
  KAKAO_REST_API_KEY: z.string().min(1).optional(),
  KAKAO_JAVASCRIPT_KEY: z.string().min(1).optional(),
  KAKAO_ADMIN_KEY: z.string().min(1).optional(),
  ALIGO_API_KEY: z.string().min(1).optional(),
  ALIGO_USER_ID: z.string().min(1).optional(),
  ALIGO_SENDER_KEY: z.string().min(1).optional(),
  ALIGO_SENDER_PHONE: z.string().min(1).optional(),
  ALIGO_KAKAOCHANNEL_ID: z.string().min(1).optional(),
  IMWEB_API_KEY: z.string().min(1).optional(),
  IMWEB_SECRET_KEY: z.string().min(1).optional(),
  IMWEB_API_KEY_COFFEE: z.string().min(1).optional(),
  IMWEB_SECRET_KEY_COFFEE: z.string().min(1).optional(),
  IMWEB_API_KEY_LAB: z.string().min(1).optional(),
  IMWEB_SECRET_KEY_LAB: z.string().min(1).optional(),
  PLAYAUTO_API_KEY: z.string().min(1).optional(),
  PLAYAUTO_EMAIL: z.string().min(1).optional(),
  PLAYAUTO_PASSWORD: z.string().min(1).optional(),
  PLAYAUTO_BASE_URL: z.string().url().optional(),
  TOSS_SHOP_ID: z.string().min(1).optional(),
  TOSS_LIVE_SECRET_KEY: z.string().min(1).optional(),
  TOSS_LIVE_CLIENT_KEY: z.string().min(1).optional(),
  TOSS_TEST_SECRET_KEY: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(envSource);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment variables: ${details}`);
}

export const env = parsed.data;
