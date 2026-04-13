import { isOpenAIConfigured } from "../ai";
import { getDbStats as getCrmLocalStats } from "../crmLocalDb";
import { env } from "../env";
import { isSerpApiConfigured } from "../serpapi";
import { getTossStoreHealth } from "../tossConfig";

export const buildHealthPayload = () => {
  const tossStoreHealth = getTossStoreHealth();
  const ga4SharedServiceAccountKey = env.GA4_SERVICE_ACCOUNT_KEY ?? env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  const ga4Properties = {
    default: {
      propertyId: env.GA4_PROPERTY_ID ?? null,
      configured: !!env.GA4_PROPERTY_ID && !!ga4SharedServiceAccountKey,
    },
    biocom: {
      propertyId: env.GA4_BIOCOM_PROPERTY_ID ?? null,
      configured: !!env.GA4_BIOCOM_PROPERTY_ID && !!ga4SharedServiceAccountKey,
    },
    thecleancoffee: {
      propertyId: env.GA4_COFFEE_PROPERTY_ID ?? null,
      configured: !!env.GA4_COFFEE_PROPERTY_ID && !!ga4SharedServiceAccountKey,
    },
    aibio: {
      propertyId: env.GA4_AIBIOCOM_PROPERTY_ID ?? null,
      configured: !!env.GA4_AIBIOCOM_PROPERTY_ID && !!ga4SharedServiceAccountKey,
    },
  };

  return {
    status: "ok",
    service: "biocom-seo-backend",
    timestamp: new Date().toISOString(),
    backgroundJobs: {
      enabled: env.BACKGROUND_JOBS_ENABLED,
      cwvAutoSync: {
        enabled: env.CWV_AUTO_SYNC_ENABLED,
      },
      attributionStatusSync: {
        enabled: env.ATTRIBUTION_STATUS_SYNC_ENABLED,
        intervalMs: env.ATTRIBUTION_STATUS_SYNC_INTERVAL_MS,
        limit: env.ATTRIBUTION_STATUS_SYNC_LIMIT,
      },
      capiAutoSync: {
        enabled: env.CAPI_AUTO_SYNC_ENABLED,
        intervalMs: env.CAPI_AUTO_SYNC_INTERVAL_MS,
        limit: env.CAPI_AUTO_SYNC_LIMIT,
      },
    },
    apis: {
      gsc: !!env.GSC_SERVICE_ACCOUNT_KEY,
      pagespeed: !!env.PAGESPEED_API_KEY,
      ga4: ga4Properties.default.configured,
      ga4Properties,
      serpapi: isSerpApiConfigured(),
      perplexity: !!env.PERPLEXITY_API_KEY,
      supabase: !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY,
      database: !!env.DATABASE_URL,
      openai: isOpenAIConfigured(),
      channeltalk: {
        sdk: !!env.CHANNELTALK_PLUGIN_KEY,
        openApi: !!env.CHANNELTALK_ACCESS_KEY && !!env.CHANNELTALK_ACCESS_SECRET,
        memberHash: !!env.CHANNELTALK_MEMBER_HASH_SECRET,
        marketing: env.CHANNELTALK_MARKETING_ENABLED,
      },
      kakao: {
        restApi: !!env.KAKAO_REST_API_KEY,
        javascript: !!env.KAKAO_JAVASCRIPT_KEY,
        admin: !!env.KAKAO_ADMIN_KEY,
      },
      aligo: {
        apiKey: !!env.ALIGO_API_KEY,
        userId: !!env.ALIGO_USER_ID,
        senderKey: !!env.ALIGO_SENDER_KEY,
        senderPhone: !!env.ALIGO_SENDER_PHONE,
        kakaoChannelId: !!env.ALIGO_KAKAOCHANNEL_ID,
        ready: !!env.ALIGO_API_KEY && !!env.ALIGO_USER_ID && !!env.ALIGO_SENDER_KEY,
      },
      toss: {
        shopId: !!env.TOSS_SHOP_ID,
        liveKey: !!env.TOSS_LIVE_SECRET_KEY,
        testKey: !!env.TOSS_TEST_SECRET_KEY,
        ready: !!env.TOSS_LIVE_SECRET_KEY,
        stores: tossStoreHealth,
      },
      meta: {
        token: !!env.META_ADMANAGER_API_KEY,
        appSecret: !!env.META_APP_SECRET_CODE,
        ready: !!env.META_ADMANAGER_API_KEY,
      },
      imweb: {
        apiKey: !!env.IMWEB_API_KEY,
        secretKey: !!env.IMWEB_SECRET_KEY,
        ready: !!env.IMWEB_API_KEY && !!env.IMWEB_SECRET_KEY,
      },
      playauto: {
        apiKey: !!env.PLAYAUTO_API_KEY,
        email: !!env.PLAYAUTO_EMAIL,
        ready: !!env.PLAYAUTO_API_KEY && !!env.PLAYAUTO_EMAIL && !!env.PLAYAUTO_PASSWORD,
      },
      crmLocal: (() => {
        try {
          return getCrmLocalStats();
        } catch {
          return { error: "init failed" };
        }
      })(),
    },
  };
};
