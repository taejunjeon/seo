import fs from "node:fs";
import path from "node:path";

type FunnelEventName =
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Lead"
  | "Search";

type CliOptions = {
  testCode: string;
  outputJson: string;
  outputMd: string;
};

const repoRoot = path.resolve(__dirname, "../..");
const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const kstDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const defaultJson = path.join(repoRoot, "data", `meta-funnel-capi-test-events-payload-preview-${kstDate.replace(/\//g, "-")}.json`);
const defaultMd = path.join(repoRoot, "capivm", `meta-funnel-capi-test-events-payload-preview-${kstDate.replace(/\//g, "-")}.md`);

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    testCode: process.env.META_EVENT_CODE_BIOCOM?.trim() || "",
    outputJson: defaultJson,
    outputMd: defaultMd,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];

    if (current === "--test-code" && next) {
      options.testCode = next.trim();
      i += 1;
      continue;
    }

    if (current === "--output-json" && next) {
      options.outputJson = path.resolve(next);
      i += 1;
      continue;
    }

    if (current === "--output-md" && next) {
      options.outputMd = path.resolve(next);
      i += 1;
      continue;
    }

    if (current === "--help") {
      console.error(`Usage:
npm exec tsx scripts/meta-funnel-capi-test-events-payload-preview.ts -- --test-code TEST12345`);
      process.exit(0);
    }
  }

  return options;
};

const maskTestCode = (value: string) => {
  if (!value) return "";
  if (value.length <= 4) return "*".repeat(value.length);
  return `${value.slice(0, 4)}${"*".repeat(value.length - 4)}`;
};

const validateTestCode = (value: string) => {
  if (!value) return;
  if (!/^[A-Za-z0-9_-]{3,120}$/.test(value)) {
    throw new Error("test code has unexpected characters; refusing to generate preview");
  }
};

const eventUrls: Record<FunnelEventName, string> = {
  ViewContent: "https://biocom.kr/HealthFood/?idx=386",
  AddToCart: "https://biocom.kr/HealthFood/?idx=386",
  InitiateCheckout: "https://biocom.kr/shop_cart/",
  AddPaymentInfo: "https://biocom.kr/shop_payment/",
  Lead: "https://biocom.kr/site_join/",
  Search: "https://biocom.kr/?keyword=%EB%A9%94%ED%83%80%EB%93%9C%EB%A6%BC",
};

const events: FunnelEventName[] = [
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Lead",
  "Search",
];

const buildPayload = (eventName: FunnelEventName) => ({
  eventName,
  eventId: `biocom_meta_funnel_test_${eventName}_${runId}`,
  pixelId: "1283400029487161",
  eventSourceUrl: eventUrls[eventName],
  contentIds: ["gtm_first_smoke_product_386"],
  contentType: "product",
  value: eventName === "Lead" || eventName === "Search" ? undefined : 0,
  currency: "KRW",
  testEventCode: "<TJ_PROVIDED_TEST_EVENT_CODE>",
});

const mdEscape = (value: unknown) =>
  String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");

const mdTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(mdEscape).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
].join("\n");

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  validateTestCode(options.testCode);

  const payloads = events.map(buildPayload);
  const result = {
    ok: true,
    generatedAt: new Date().toISOString(),
    mode: "no-send-payload-preview",
    site: "biocom",
    pixelId: "1283400029487161",
    endpoint: "https://att.ainativeos.net/api/meta/capi/track",
    noSendVerified: true,
    noWriteVerified: true,
    noDeployVerified: true,
    noPublishVerified: true,
    noPlatformSendVerified: true,
    networkSendExecuted: false,
    testEventCode: {
      present: Boolean(options.testCode),
      masked: maskTestCode(options.testCode),
      length: options.testCode.length,
      rawValueWritten: false,
    },
    preferredClientWiring: "GTM Custom HTML tag in fresh Preview workspace, not Imweb header/footer",
    blockedUntilApproval: [
      "actual Meta Test Events server-side smoke",
      "GTM Preview workspace creation or edit",
      "GTM Production publish",
      "Imweb header/footer edit",
      "production funnel CAPI send without test_event_code",
    ],
    payloads,
  };

  fs.mkdirSync(path.dirname(options.outputJson), { recursive: true });
  fs.writeFileSync(options.outputJson, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  const md = `# Meta funnel CAPI Test Events payload preview

작성 시각: ${new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date()).replace(",", "")} KST
대상: biocom Meta Pixel \`1283400029487161\`
문서 성격: Green Lane no-send payload preview
관련 문서: [[meta-funnel-capi-readiness-20260508]], [[../total/!total-current]]
Do not use for: Meta Test Events 실제 호출, 운영 CAPI 전송, GTM Preview/Publish, Imweb header/footer 수정

\`\`\`yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - capivm/meta-funnel-capi-readiness-20260508.md
    - capivm/meta-funnel-capi-test-events-smoke-plan-20260505.md
    - total/!total-current.md
  lane: Green no-send payload preview
  allowed_actions:
    - test_event_code 존재 여부 확인
    - payload preview 생성
    - GTM-first wiring 설계 보강
  forbidden_actions:
    - Meta Test Events 실제 호출
    - 운영 CAPI 전송
    - GTM Preview workspace 생성/수정
    - GTM Production publish
    - Imweb header/footer 수정
  source_window_freshness_confidence:
    source: "capivm/meta-funnel-capi-readiness-20260508.md + backend/src/routes/meta.ts + TJ 제공 test_event_code"
    window: "2026-05-08 KST"
    freshness: "payload preview generated ${new Date().toISOString()}"
    confidence: 0.88
\`\`\`

## 10초 결론

TJ님이 제공한 Meta Test Events code는 현재 세션에 존재한다. 이 파일에는 원문값을 저장하지 않고 마스킹과 길이만 남긴다.

이번 작업은 실제 Meta 호출이 아니다. \`/api/meta/capi/track\`로 네트워크 요청을 보내지 않았고, GTM/Imweb/운영 서버도 바꾸지 않았다.

## Test Code 확인

${mdTable(["항목", "값"], [
    ["present", result.testEventCode.present ? "YES" : "NO"],
    ["masked", result.testEventCode.masked],
    ["length", result.testEventCode.length],
    ["raw value written", "NO"],
  ])}

## Payload Preview

${mdTable(["event", "eventId", "eventSourceUrl", "testEventCode"], payloads.map((payload) => [
    payload.eventName,
    payload.eventId,
    payload.eventSourceUrl,
    payload.testEventCode,
  ]))}

## 권장 wiring

1. 아임웹 header/footer 변경보다 GTM Custom HTML tag를 우선한다.
2. 실제 적용은 fresh Preview workspace에서만 시작한다.
3. Production publish 전에는 Test Events 탭에서 Browser/Server event_id dedup을 확인한다.
4. \`test_event_code\` 없는 funnel event 운영 송출은 별도 승인 전 금지한다.

## Auditor verdict

\`\`\`text
Auditor verdict: PASS_WITH_NOTES
Project: meta-funnel-capi
Lane: Green
Mode: no-send payload preview

No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Notes:
- TJ provided a test code in the chat, but the raw value was not written to this file.
- Actual Test Events smoke remains Yellow because it calls Meta.
\`\`\`
`;

  fs.mkdirSync(path.dirname(options.outputMd), { recursive: true });
  fs.writeFileSync(options.outputMd, md, "utf8");

  console.log(JSON.stringify({
    ok: true,
    outputJson: options.outputJson,
    outputMd: options.outputMd,
    testEventCodePresent: Boolean(options.testCode),
    testEventCodeMasked: maskTestCode(options.testCode),
    networkSendExecuted: false,
  }, null, 2));
};

main();
