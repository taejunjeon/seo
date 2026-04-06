import assert from "node:assert/strict";
import test from "node:test";

test("toss config: renamed biocom vars and coffee api aliases are resolved", async () => {
  const trackedKeys = [
    "TOSS_SHOP_ID",
    "TOSS_SHOP_ID_BIOCOM",
    "TOSS_SHOP_ID_COFFEE",
    "TOSS_LIVE_SECRET_KEY",
    "TOSS_LIVE_SECRET_KEY_BIOCOM",
    "TOSS_LIVE_SECRET_KEY_COFFEE",
    "TOSS_LIVE_SECRET_KEY_COFFEE_API",
    "TOSS_TEST_CLIENT_KEY",
    "TOSS_TEST_CLIENT_KEY_BIOCOM",
    "TOSS_TEST_CLIENT_KEY_COFFEE",
    "TOSS_TEST_CLIENT_KEY_COFFEE_API",
    "TOSS_TEST_SECRET_KEY",
    "TOSS_TEST_SECRET_KEY_BIOCOM",
    "TOSS_TEST_SECRET_KEY_COFFEE",
    "TOSS_TEST_SECRET_KEY_COFFEE_API",
    "TOSS_LIVE_CLIENT_KEY",
    "TOSS_LIVE_CLIENT_KEY_BIOCOM",
    "TOSS_LIVE_CLIENT_KEY_COFFEE",
    "TOSS_LIVE_CLIENT_KEY_COFFEE_API",
  ] as const;

  const previous = new Map<string, string | undefined>(
    trackedKeys.map((key) => [key, process.env[key]]),
  );

  try {
    for (const key of trackedKeys) {
      delete process.env[key];
    }

    process.env.TOSS_SHOP_ID_BIOCOM = "iw_biocomo8tx";
    process.env.TOSS_SHOP_ID_COFFEE = "iw_thecleaz5j";
    process.env.TOSS_LIVE_SECRET_KEY_BIOCOM = "bio-live-secret";
    process.env.TOSS_TEST_CLIENT_KEY_BIOCOM = "bio-test-client";
    process.env.TOSS_TEST_SECRET_KEY_BIOCOM = "bio-test-secret";
    process.env.TOSS_LIVE_SECRET_KEY_COFFEE_API = "coffee-live-secret";
    process.env.TOSS_TEST_CLIENT_KEY_COFFEE_API = "coffee-test-client";
    process.env.TOSS_TEST_SECRET_KEY_COFFEE_API = "coffee-test-secret";
    process.env.TOSS_LIVE_CLIENT_KEY_COFFEE_API = "coffee-live-client";

    const { env } = await import(`../src/env.ts?case=${Date.now()}`);
    const {
      getTossStoreConfig,
      inferTossStoreFromPaymentKey,
      normalizeTossStore,
    } = await import(`../src/tossConfig.ts?case=${Date.now()}`);

    assert.equal(env.TOSS_SHOP_ID, "iw_biocomo8tx");
    assert.equal(env.TOSS_LIVE_SECRET_KEY, "bio-live-secret");
    assert.equal(env.TOSS_TEST_CLIENT_KEY, "bio-test-client");
    assert.equal(env.TOSS_TEST_SECRET_KEY, "bio-test-secret");

    assert.equal(getTossStoreConfig("biocom", "live").secretKey, "bio-live-secret");
    assert.equal(getTossStoreConfig("coffee", "live").secretKey, "coffee-live-secret");
    assert.equal(getTossStoreConfig("coffee", "live").clientKey, "coffee-live-client");
    assert.equal(getTossStoreConfig("coffee", "test").ready, true);
    assert.equal(normalizeTossStore("thecleancoffee"), "coffee");
    assert.equal(inferTossStoreFromPaymentKey("iw_th202604060001"), "coffee");
    assert.equal(inferTossStoreFromPaymentKey("iw_bi202604060001"), "biocom");
  } finally {
    for (const key of trackedKeys) {
      const value = previous.get(key);
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
