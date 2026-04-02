import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMemberHash,
  getChannelTalkConfigStatus,
  verifyChannelTalkAccess,
  type ChannelTalkConfigInput,
} from "../src/channeltalk";

const makeConfig = (overrides: Partial<ChannelTalkConfigInput> = {}): ChannelTalkConfigInput => ({
  pluginKey: "",
  accessKey: "",
  accessSecret: "",
  memberHashSecret: "",
  marketingEnabled: false,
  accessKeyAliasUsed: false,
  ...overrides,
});

test("ChannelTalk: config status reports missing requirements and alias usage", () => {
  const status = getChannelTalkConfigStatus(
    makeConfig({
      accessKey: "access-key",
      accessKeyAliasUsed: true,
    }),
  );

  assert.equal(status.accessKeyConfigured, true);
  assert.equal(status.accessSecretConfigured, false);
  assert.equal(status.accessKeyAliasUsed, true);
  assert.deepEqual(status.missingForSdk, ["CHANNELTALK_PLUGIN_KEY"]);
  assert.deepEqual(status.missingForOpenApi, ["CHANNELTALK_ACCESS_SECRET"]);
});

test("ChannelTalk: buildMemberHash returns deterministic sha256 hmac", () => {
  const hash = buildMemberHash(
    "customer:123",
    makeConfig({
      memberHashSecret: "secret",
    }),
  );

  assert.equal(hash, "d8636e0a17171215d0ad90b3d27b79718ef49fe5a19b78bbd3ea44d086d31170");
});

test("ChannelTalk: verifyChannelTalkAccess stops early when secret is missing", async () => {
  const probe = await verifyChannelTalkAccess(
    makeConfig({
      accessKey: "access-key-only",
    }),
  );

  assert.deepEqual(probe, {
    ok: false,
    reason: "missing_credentials",
    missing: ["CHANNELTALK_ACCESS_SECRET"],
    message: "ChannelTalk Open API requires access key and access secret.",
  });
});

test("ChannelTalk: verifyChannelTalkAccess parses successful channel response", async () => {
  const probe = await verifyChannelTalkAccess(
    makeConfig({
      accessKey: "access-key",
      accessSecret: "access-secret",
    }),
    async () =>
      new Response(
        JSON.stringify({
          channel: {
            id: "channel-123",
            name: "BioCom Channel",
            defaultPluginId: "plugin-123",
            enableMemberHash: true,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
  );

  assert.deepEqual(probe, {
    ok: true,
    status: 200,
    channelId: "channel-123",
    channelName: "BioCom Channel",
    defaultPluginId: "plugin-123",
    memberHashEnabledOnChannel: true,
  });
});
