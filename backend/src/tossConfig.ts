import { env } from "./env";

export const TOSS_STORES = ["biocom", "coffee"] as const;

export type TossStore = (typeof TOSS_STORES)[number];
export type TossMode = "live" | "test";

type TossStoreConfig = {
  store: TossStore;
  shopId: string | null;
  clientKey: string | null;
  secretKey: string | null;
  ready: boolean;
};

const trimOrNull = (value?: string | null) => value?.trim() || null;

export const normalizeTossStore = (value?: string | null): TossStore => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "coffee" || normalized === "thecleancoffee" || normalized === "the_clean_coffee") {
    return "coffee";
  }
  return "biocom";
};

export const inferTossStoreFromPaymentKey = (
  paymentKey?: string | null,
  fallbackStore?: string | null,
): TossStore => {
  const normalizedKey = paymentKey?.trim().toLowerCase() ?? "";
  if (normalizedKey.startsWith("iw_th")) return "coffee";
  if (normalizedKey.startsWith("iw_bi")) return "biocom";
  return normalizeTossStore(fallbackStore);
};

export const getTossStoreConfig = (
  storeInput?: string | null,
  mode: TossMode = "live",
): TossStoreConfig => {
  const store = normalizeTossStore(storeInput);

  if (store === "coffee") {
    const secretKey =
      mode === "live"
        ? trimOrNull(env.TOSS_LIVE_SECRET_KEY_COFFEE)
        : trimOrNull(env.TOSS_TEST_SECRET_KEY_COFFEE);
    const clientKey =
      mode === "live"
        ? trimOrNull(env.TOSS_LIVE_CLIENT_KEY_COFFEE)
        : trimOrNull(env.TOSS_TEST_CLIENT_KEY_COFFEE);

    return {
      store,
      shopId: trimOrNull(env.TOSS_SHOP_ID_COFFEE),
      clientKey,
      secretKey,
      ready: Boolean(secretKey),
    };
  }

  const secretKey =
    mode === "live"
      ? trimOrNull(env.TOSS_LIVE_SECRET_KEY_BIOCOM ?? env.TOSS_LIVE_SECRET_KEY)
      : trimOrNull(env.TOSS_TEST_SECRET_KEY_BIOCOM ?? env.TOSS_TEST_SECRET_KEY);
  const clientKey =
    mode === "live"
      ? trimOrNull(env.TOSS_LIVE_CLIENT_KEY_BIOCOM ?? env.TOSS_LIVE_CLIENT_KEY)
      : trimOrNull(env.TOSS_TEST_CLIENT_KEY_BIOCOM ?? env.TOSS_TEST_CLIENT_KEY);

  return {
    store,
    shopId: trimOrNull(env.TOSS_SHOP_ID_BIOCOM ?? env.TOSS_SHOP_ID),
    clientKey,
    secretKey,
    ready: Boolean(secretKey),
  };
};

export const getTossBasicAuth = (
  storeInput?: string | null,
  mode: TossMode = "live",
): string | null => {
  const config = getTossStoreConfig(storeInput, mode);
  if (!config.secretKey) return null;
  return `Basic ${Buffer.from(`${config.secretKey}:`).toString("base64")}`;
};

export const getTossStoreHealth = () => ({
  biocom: {
    shopId: Boolean(trimOrNull(env.TOSS_SHOP_ID_BIOCOM ?? env.TOSS_SHOP_ID)),
    liveKey: Boolean(trimOrNull(env.TOSS_LIVE_SECRET_KEY_BIOCOM ?? env.TOSS_LIVE_SECRET_KEY)),
    testKey: Boolean(trimOrNull(env.TOSS_TEST_SECRET_KEY_BIOCOM ?? env.TOSS_TEST_SECRET_KEY)),
    ready: getTossStoreConfig("biocom", "live").ready,
  },
  coffee: {
    shopId: Boolean(trimOrNull(env.TOSS_SHOP_ID_COFFEE)),
    liveKey: Boolean(trimOrNull(env.TOSS_LIVE_SECRET_KEY_COFFEE)),
    testKey: Boolean(trimOrNull(env.TOSS_TEST_SECRET_KEY_COFFEE)),
    ready: getTossStoreConfig("coffee", "live").ready,
  },
});
