import test from "node:test";
import assert from "node:assert/strict";

test("categorizeTrafficSource: filters false positives and labels Bing separately", async () => {
  process.env.GA4_PROPERTY_ID ??= "test";
  // NOTE: ga4.ts imports env.ts at module-load time. Avoid static imports so tests don't
  // accidentally lock in missing env values for other test files.
  const { categorizeTrafficSource } = await import("../src/ga4");
  const { matchAiReferrer } = await import("../src/config/ai-referrers");

  // False positives that used to slip through with CONTAINS("openai") / broad patterns
  assert.equal(categorizeTrafficSource("mychatgpt"), "organic");
  assert.equal(categorizeTrafficSource("mychatgpt.com"), "organic");
  assert.equal(categorizeTrafficSource("notchatgpt.com"), "organic");
  assert.equal(categorizeTrafficSource("mygeminigame.com"), "organic");

  // AI referrals (should include www subdomain variants)
  assert.equal(categorizeTrafficSource("chatgpt.com"), "ai_referral");
  assert.equal(categorizeTrafficSource("www.chatgpt.com"), "ai_referral");
  assert.equal(categorizeTrafficSource("gemini.google.com"), "ai_referral");
  assert.equal(categorizeTrafficSource("copilot.microsoft.com"), "ai_referral");
  assert.equal(categorizeTrafficSource("search.brave.com"), "ai_referral");

  // Legacy search (must not be mixed into AI referrals)
  assert.equal(categorizeTrafficSource("bing.com"), "search_legacy");
  assert.equal(categorizeTrafficSource("www.bing.com"), "search_legacy");

  // Label matching (top-sources helper)
  assert.deepEqual(matchAiReferrer("chatgpt.com"), { matched: true, label: "ChatGPT" });
  assert.deepEqual(matchAiReferrer("www.chatgpt.com"), { matched: true, label: "ChatGPT" });
  assert.deepEqual(matchAiReferrer("notchatgpt.com"), { matched: false, label: null });
});
