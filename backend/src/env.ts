import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSource = {
  ...process.env,
  KAKAO_REST_API_KEY: process.env.KAKAO_REST_API_KEY ?? process.env.KAKAO_BIOCOM_REST_API_KEY,
  KAKAO_JAVASCRIPT_KEY: process.env.KAKAO_JAVASCRIPT_KEY ?? process.env.KAKAO_BIOCOM_JavaScript_KEY,
  KAKAO_ADMIN_KEY: process.env.KAKAO_ADMIN_KEY ?? process.env.KAKAO_BIOCOM_Admin_KEY,
  KAKAO_ADMIN_KEY_COFFEE:
    process.env.KAKAO_ADMIN_KEY_COFFEE
    ?? process.env.KAKAO_COFFEE_ADMIN_KEY
    ?? process.env.KAKAO_COFFEE_Admin_KEY
    ?? process.env.KAKAO_THECLEANCOFFEE_Admin_KEY,
  KAKAO_CHANNEL_PUBLIC_ID_COFFEE:
    // Kakao API의 channel_public_id는 URL 경로용 ID (ex: _JwdMs).
    // @더클린커피 같은 검색 ID가 아니라 pf.kakao.com/{public_id} 의 public_id를 써야 함.
    process.env.KAKAO_CHANNEL_PUBLIC_ID_COFFEE
    ?? process.env.KAKAO_COFFEE_PUBLIC_ID
    ?? process.env.KAKAO_COFFEE_CHANNEL_ID,
  KAKAO_CHANNEL_PUBLIC_ID_BIOCOM:
    process.env.KAKAO_CHANNEL_PUBLIC_ID_BIOCOM
    ?? process.env.KAKAO_BIOCOM_PUBLIC_ID
    ?? process.env.KAKAO_BIOCOM_CHANNEL_ID,
  TOSS_SHOP_ID: process.env.TOSS_SHOP_ID ?? process.env.TOSS_SHOP_ID_BIOCOM,
  TOSS_SHOP_ID_BIOCOM: process.env.TOSS_SHOP_ID_BIOCOM ?? process.env.TOSS_SHOP_ID,
  TOSS_SHOP_ID_COFFEE:
    process.env.TOSS_SHOP_ID_NEWCOFFEE
    ?? process.env.TOSS_SHOP_ID_COFFEE,
  TOSS_LIVE_SECRET_KEY: process.env.TOSS_LIVE_SECRET_KEY ?? process.env.TOSS_LIVE_SECRET_KEY_BIOCOM,
  TOSS_LIVE_SECRET_KEY_BIOCOM:
    process.env.TOSS_LIVE_SECRET_KEY_BIOCOM ?? process.env.TOSS_LIVE_SECRET_KEY,
  TOSS_LIVE_SECRET_KEY_COFFEE:
    process.env.TOSS_NEW_COFFEE_API_SECRET_KEY
    ?? process.env.TOSS_LIVE_SECRET_KEY_COFFEE
    ?? process.env.TOSS_LIVE_SECRET_KEY_COFFEE_API,
  TOSS_LIVE_CLIENT_KEY:
    process.env.TOSS_LIVE_CLIENT_KEY
    ?? process.env.TOSS_LIVE_CLIENT_KEY_BIOCOM
    ?? process.env.TEST_LIVE_CLIENT_KEY,
  TOSS_LIVE_CLIENT_KEY_BIOCOM:
    process.env.TOSS_LIVE_CLIENT_KEY_BIOCOM ?? process.env.TOSS_LIVE_CLIENT_KEY,
  TOSS_LIVE_CLIENT_KEY_COFFEE:
    process.env.TOSS_NEW_COFFEE_API_LIVE_CLIENT_KEY
    ?? process.env.TOSS_LIVE_CLIENT_KEY_COFFEE
    ?? process.env.TOSS_LIVE_CLIENT_KEY_COFFEE_API,
  TOSS_TEST_CLIENT_KEY: process.env.TOSS_TEST_CLIENT_KEY ?? process.env.TOSS_TEST_CLIENT_KEY_BIOCOM,
  TOSS_TEST_CLIENT_KEY_BIOCOM:
    process.env.TOSS_TEST_CLIENT_KEY_BIOCOM ?? process.env.TOSS_TEST_CLIENT_KEY,
  TOSS_TEST_CLIENT_KEY_COFFEE:
    process.env.TOSS_CLIENT_KEY_NEW_COFFEE
    ?? process.env.TOSS_TEST_CLIENT_KEY_COFFEE
    ?? process.env.TOSS_TEST_CLIENT_KEY_COFFEE_API,
  TOSS_TEST_SECRET_KEY: process.env.TOSS_TEST_SECRET_KEY ?? process.env.TOSS_TEST_SECRET_KEY_BIOCOM,
  TOSS_TEST_SECRET_KEY_BIOCOM:
    process.env.TOSS_TEST_SECRET_KEY_BIOCOM ?? process.env.TOSS_TEST_SECRET_KEY,
  TOSS_TEST_SECRET_KEY_COFFEE:
    process.env.TOSS_SECRET_KEY_NEW_COFFEE
    ?? process.env.TOSS_TEST_SECRET_KEY_COFFEE
    ?? process.env.TOSS_TEST_SECRET_KEY_COFFEE_API,
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
  META_ADMANAGER_API_KEY_COFFEE: process.env.META_ADMANAGER_API_KEY_COFFEE,
  COFFEE_META_TOKEN: process.env.COFFEE_META_TOKEN,
  COFFEE_META_SYSTEM_USERID: process.env.COFFEE_META_SYSTEM_USERID,
  META_PIXEL_ID_BIOCOM: process.env.META_PIXEL_ID_BIOCOM ?? "1283400029487161",
  META_PIXEL_ID_COFFEE: process.env.META_PIXEL_ID_COFFEE ?? "1186437633687388",
  META_PIXEL_ID_AIBIO: process.env.META_PIXEL_ID_AIBIO ?? "1068377347547682",
  // C-Sprint 4: GA4 Measurement Protocol API secret (Refund 이벤트 전송용).
  // TJ 가 `.env` 에 `GA4_PROTOCOL_API_PASS` 라는 이름으로 biocom secret 을 저장한 이력이 있어
  // 코드 공식 이름(`GA4_MP_API_SECRET_BIOCOM`) 이 비어있으면 legacy 이름으로 fallback 한다.
  GA4_MP_API_SECRET_BIOCOM:
    process.env.GA4_MP_API_SECRET_BIOCOM ?? process.env.GA4_PROTOCOL_API_PASS,
  GA4_MP_API_SECRET_COFFEE: process.env.GA4_MP_API_SECRET_COFFEE,
  GA4_MEASUREMENT_ID_BIOCOM: process.env.GA4_MEASUREMENT_ID_BIOCOM ?? "G-WJFXN5E2Q1",
  GA4_MEASUREMENT_ID_COFFEE: process.env.GA4_MEASUREMENT_ID_COFFEE,
  GOOGLE_ADS_DEVELOPER_TOKEN:
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? process.env.API_TOKEN_BIOCOM,
  GOOGLE_ADS_CUSTOMER_ID:
    process.env.GOOGLE_ADS_CUSTOMER_ID
    ?? process.env.GOOGLE_ADS_CLIENT_CUSTOMER_ID
    ?? "2149990943",
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  GOOGLE_ADS_API_VERSION: process.env.GOOGLE_ADS_API_VERSION ?? "v22",
  ATTRIBUTION_OPERATIONAL_BASE_URL:
    process.env.ATTRIBUTION_OPERATIONAL_BASE_URL ?? "https://att.ainativeos.net",
  REFUND_DISPATCH_ENFORCE: process.env.REFUND_DISPATCH_ENFORCE,
  AIBIO_SUPABASE_PROJECT_ID: process.env.AIBIO_SUPABASE_PROJECT_ID,
  AIBIO_SUPABASE_SECRET_KEY:
    process.env.AIBIO_SUPABASE_SECRET_KEY
    ?? process.env.AIBIO_SUPABASE_Secret_Keys
    ?? process.env.AIBIO_SUPABASE_Secret_Key,
  AIBIO_SUPABASE_PUBLISHABLE_KEY:
    process.env.AIBIO_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.AIBIO_SUPABASE_Pubilshable_key
    ?? process.env.AIBIO_SUPABASE_Publishable_key,
  COUPANG_BIOCOM_CODE: process.env.COUPANG_BIOCOM_CODE,
  COUPANG_BIOCOM_ACCESS_KEY:
    process.env.COUPANG_BIOCOM_ACCESS_KEY ?? process.env.COUPANG_BIOCOM_Access_Key,
  COUPANG_BIOCOM_SECRET_KEY:
    process.env.COUPANG_BIOCOM_SECRET_KEY ?? process.env.COUPANG_BIOCOM_Secret_Key,
  COUPANG_TEAMKETO_CODE: process.env.COUPANG_TEAMKETO_CODE,
  COUPANG_TEAMKETO_ACCESS_KEY:
    process.env.COUPANG_TEAMKETO_ACCESS_KEY ?? process.env.COUPANG_TEAMKETO_Access_Key,
  COUPANG_TEAMKETO_SECRET_KEY:
    process.env.COUPANG_TEAMKETO_SECRET_KEY ?? process.env.COUPANG_TEAMKETO_Secret_Key,
  // 더클린커피 정기구독 트랙 알림톡 템플릿 코드 (알리고 검수 후 발급)
  ALIGO_TPL_COFFEE_SUBSCRIBER: process.env.ALIGO_TPL_COFFEE_SUBSCRIBER,
  ALIGO_TPL_COFFEE_LOYALIST: process.env.ALIGO_TPL_COFFEE_LOYALIST,
  ALIGO_TPL_COFFEE_MANIAC: process.env.ALIGO_TPL_COFFEE_MANIAC,
  ALIGO_TPL_COFFEE_EVERGREEN: process.env.ALIGO_TPL_COFFEE_EVERGREEN,
  ALIGO_TPL_COFFEE_CHURN_30: process.env.ALIGO_TPL_COFFEE_CHURN_30,
  ALIGO_TPL_COFFEE_CHURN_60: process.env.ALIGO_TPL_COFFEE_CHURN_60,
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TRUST_PROXY: z.enum(["0", "1"]).default("0"),
  PORT: z.coerce.number().int().positive().default(7020),
  BACKGROUND_JOBS_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false" && value !== "0"),
  CWV_AUTO_SYNC_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false" && value !== "0"),
  CAPI_AUTO_SYNC_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false" && value !== "0"),
  CAPI_AUTO_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(30 * 60 * 1000),
  CAPI_AUTO_SYNC_LIMIT: z.coerce.number().int().positive().default(100),
  ATTRIBUTION_STATUS_SYNC_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false" && value !== "0"),
  ATTRIBUTION_STATUS_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  ATTRIBUTION_STATUS_SYNC_LIMIT: z.coerce.number().int().positive().default(100),
  IMWEB_AUTO_SYNC_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true" || value === "1"),
  IMWEB_AUTO_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  IMWEB_AUTO_SYNC_MAX_PAGE: z.coerce.number().int().positive().default(30),
  TOSS_AUTO_SYNC_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true" || value === "1"),
  TOSS_AUTO_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  TOSS_AUTO_SYNC_WINDOW_HOURS: z.coerce.number().int().positive().default(6),
  SCHEDULED_SEND_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  SCHEDULED_SEND_POLL_MS: z.coerce.number().int().positive().default(60 * 1000),
  TEMP_GROUP_CLEANUP_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
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
  GA4_BIOCOM_PROPERTY_ID: z.string().optional(),
  GA4_BIOCOM_SERVICE_ACCOUNT_KEY: z.string().optional(),
  GA4_COFFEE_PROPERTY_ID: z.string().optional(),
  GA4_AIBIOCOM_PROPERTY_ID: z.string().optional(),
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
  KAKAO_ADMIN_KEY_COFFEE: z.string().min(1).optional(),
  KAKAO_CHANNEL_PUBLIC_ID_COFFEE: z.string().min(1).optional(),
  KAKAO_CHANNEL_PUBLIC_ID_BIOCOM: z.string().min(1).optional(),
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
  META_ADMANAGER_API_KEY: z.string().min(1).optional(),
  META_ADMANAGER_API_KEY_COFFEE: z.string().min(1).optional(),
  COFFEE_META_TOKEN: z.string().min(1).optional(),
  COFFEE_META_SYSTEM_USERID: z.string().min(1).optional(),
  META_APP_SECRET_CODE: z.string().min(1).optional(),
  META_PIXEL_ID_BIOCOM: z.string().min(1).default("1283400029487161"),
  META_PIXEL_ID_COFFEE: z.string().min(1).default("1186437633687388"),
  META_PIXEL_ID_AIBIO: z.string().min(1).default("1068377347547682"),
  GA4_MP_API_SECRET_BIOCOM: z.string().min(1).optional(),
  GA4_MP_API_SECRET_COFFEE: z.string().min(1).optional(),
  GA4_MEASUREMENT_ID_BIOCOM: z.string().min(1).default("G-WJFXN5E2Q1"),
  GA4_MEASUREMENT_ID_COFFEE: z.string().min(1).optional(),
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().min(1).optional(),
  GOOGLE_ADS_CUSTOMER_ID: z.string().min(1).default("2149990943"),
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.string().min(1).optional(),
  GOOGLE_ADS_API_VERSION: z.string().min(1).default("v22"),
  ATTRIBUTION_OPERATIONAL_BASE_URL: z.string().url().default("https://att.ainativeos.net"),
  REFUND_DISPATCH_ENFORCE: z
    .string()
    .optional()
    .transform((value) => value === "true" || value === "1"),
  TOSS_SHOP_ID: z.string().min(1).optional(),
  TOSS_SHOP_ID_BIOCOM: z.string().min(1).optional(),
  TOSS_SHOP_ID_COFFEE: z.string().min(1).optional(),
  TOSS_LIVE_SECRET_KEY: z.string().min(1).optional(),
  TOSS_LIVE_SECRET_KEY_BIOCOM: z.string().min(1).optional(),
  TOSS_LIVE_SECRET_KEY_COFFEE: z.string().min(1).optional(),
  TOSS_LIVE_CLIENT_KEY: z.string().min(1).optional(),
  TOSS_LIVE_CLIENT_KEY_BIOCOM: z.string().min(1).optional(),
  TOSS_LIVE_CLIENT_KEY_COFFEE: z.string().min(1).optional(),
  TOSS_TEST_CLIENT_KEY: z.string().min(1).optional(),
  TOSS_TEST_CLIENT_KEY_BIOCOM: z.string().min(1).optional(),
  TOSS_TEST_CLIENT_KEY_COFFEE: z.string().min(1).optional(),
  TOSS_TEST_SECRET_KEY: z.string().min(1).optional(),
  TOSS_TEST_SECRET_KEY_BIOCOM: z.string().min(1).optional(),
  TOSS_TEST_SECRET_KEY_COFFEE: z.string().min(1).optional(),
  AIBIO_SUPABASE_PROJECT_ID: z.string().min(1).optional(),
  AIBIO_SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  AIBIO_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  COUPANG_BIOCOM_CODE: z.string().min(1).optional(),
  COUPANG_BIOCOM_ACCESS_KEY: z.string().min(1).optional(),
  COUPANG_BIOCOM_SECRET_KEY: z.string().min(1).optional(),
  COUPANG_TEAMKETO_CODE: z.string().min(1).optional(),
  COUPANG_TEAMKETO_ACCESS_KEY: z.string().min(1).optional(),
  COUPANG_TEAMKETO_SECRET_KEY: z.string().min(1).optional(),
  ALIGO_TPL_COFFEE_SUBSCRIBER: z.string().min(1).optional(),
  ALIGO_TPL_COFFEE_LOYALIST: z.string().min(1).optional(),
  ALIGO_TPL_COFFEE_MANIAC: z.string().min(1).optional(),
  ALIGO_TPL_COFFEE_EVERGREEN: z.string().min(1).optional(),
  ALIGO_TPL_COFFEE_CHURN_30: z.string().min(1).optional(),
  ALIGO_TPL_COFFEE_CHURN_60: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(envSource);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment variables: ${details}`);
}

export const env = parsed.data;
