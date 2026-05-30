작성 시각: 2026-05-30 17:15 KST
문서 성격: Claude Code 시작 프롬프트

## Claude Code에 그대로 붙여넣을 프롬프트

TJ님의 Google Ads / NPay ROAS 정합성 프로젝트를 이어받아 주세요.

먼저 아래 문서를 순서대로 읽고, 절대 기존 dirty worktree를 되돌리지 마세요.

1. `/Users/vibetj/coding/seo/AGENTS.md`
2. `/Users/vibetj/coding/seo/docurule.md`
3. `/Users/vibetj/coding/seo/harness/common/HARNESS_GUIDELINES.md`
4. `/Users/vibetj/coding/seo/harness/common/AUTONOMY_POLICY.md`
5. `/Users/vibetj/coding/seo/harness/common/REPORTING_TEMPLATE.md`
6. `/Users/vibetj/coding/seo/harness/npay-recovery/README.md`
7. `/Users/vibetj/coding/seo/harness/npay-recovery/RULES.md`
8. `/Users/vibetj/coding/seo/docs/ai/HANDOFF.md`
9. `/Users/vibetj/coding/seo/docs/ai/DECISIONS.md`
10. `/Users/vibetj/coding/seo/project/!google-npay-bridge-core-mission-okr-20260530.md`
11. `/Users/vibetj/coding/seo/project/google-npay-bridge-v12-approval-plan-20260530.md`

## 대화/보고 방식

- 한국어로 답변하고 사용자는 항상 `TJ님`으로 부르세요.
- 기술어를 먼저 던지지 말고, 사람이 이해하는 행동과 결정으로 설명한 뒤 괄호로 기술명을 붙이세요.
- 핵심 목표를 흐리지 마세요. 보고서 UI가 아니라 NPay 외부 결제창 이후 실제 결제완료 주문을 원래 버튼 클릭 row와 안정적으로 붙이는 것이 핵심입니다.
- 모든 숫자는 source, window, freshness, confidence를 같이 말하세요.
- 다음 할일은 `TJ님이 할 일`과 `Codex/Claude Code가 할 일`로 나누고, 무엇을/왜/어떻게/누가/성공 기준/실패 시 확인점/승인 필요 여부/의존성/추천 점수%를 포함하세요.

## 최종 목표

Google Ads가 입찰 학습에 쓰는 구매 신호를 `NPay 버튼 클릭`이 아니라 `실제 결제완료 주문`으로 바꾸는 것입니다.

현재 진짜 병목은 네이버 외부 결제창을 지난 뒤 실제 결제완료 주문을 원래 버튼 클릭 row와 안정적으로 다시 붙이지 못하는 것입니다.

## 현재 상태

- VM Cloud backend에는 NPay bridge v1.2 receiver/additive schema가 배포되어 있습니다.
- v1.2 backend smoke는 통과했습니다.
- GTM Production에는 v1.2 태그가 아직 게시되지 않았습니다.
- GTM Production에는 v1.1이 게시되어 있습니다.
- Google Ads `BI confirmed_purchase_offline`은 실제 결제완료 전용 Primary 전환으로 사용 중입니다.
- Google Ads 전송 장부 기준 sent 19건 / failed 1건이 있으며, 리포트 반영은 일부만 확인됐습니다.
- 이번 인수인계 작업 자체에서는 Google Ads 전송, GTM Production publish, 실제 결제 테스트, 운영DB write를 하지 않았습니다.

## 반드시 지켜야 할 금지선

TJ님이 새로 명시 승인하기 전에는 아래를 하지 마세요.

- Google Ads conversion upload/send.
- GTM Production publish.
- 실제 결제 테스트.
- 운영DB write/import.
- 영구 env flag ON.
- 자동 dispatcher 확대.
- raw order id, payment id, member id, gclid/gbraid/wbraid, NPay bridge token을 문서/대화/보고서/API 응답에 원문으로 노출.

## 바로 실행할 첫 작업

첫 작업은 프론트 보고서 꾸미기가 아닙니다.

1. `/Users/vibetj/coding/seo/project/google-npay-bridge-v12-approval-plan-20260530.md`를 읽고 v1.2의 목적과 stop condition을 확인하세요.
2. `/Users/vibetj/coding/seo/backend/src/npayIntentLog.ts`와 `/Users/vibetj/coding/seo/imweb/biocom-npay-bridge-gtm-v1-2-preview.js`를 비교해서 GTM Preview smoke에 필요한 필드가 맞는지 확인하세요.
3. 가능하면 fresh GTM Preview workspace에서 v1.2 태그를 Preview 전용으로 구성하고, Production publish는 하지 마세요.
4. 접근 권한/2FA/UI 권한으로 막히면 TJ님에게 `어느 화면에서 무엇을 눌러야 하는지`만 정확하게 요청하세요.
5. Preview smoke 후 VM Cloud row-level 저장을 확인하세요.

## Preview smoke 성공 기준

성공으로 보려면 아래를 모두 만족해야 합니다.

- VM Cloud `npay_intent_log`에 `source=gtm_npay_bridge_v1_2` row가 들어옵니다.
- `environment=preview`로 들어옵니다.
- `npay_checkout_bridge_id_hash`, `local_session_id_hash`, `cart_fingerprint_hash` 중 핵심 hash 필드가 64자리로 채워집니다.
- TEST/SMOKE/GTM click id는 `gclid`, `gbraid`, `wbraid` 컬럼에 저장되지 않습니다.
- raw payload에는 raw bridge URL token, raw order id, raw click id가 없습니다.

## 먼저 돌릴 검증 명령

```bash
cd /Users/vibetj/coding/seo
git status --short
python3 scripts/harness-preflight-check.py --strict
git diff --check
```

```bash
cd /Users/vibetj/coding/seo/backend
npm run typecheck
npx tsx --test tests/npay-intent-v12.test.ts tests/npay-roas-dry-run.test.ts
```

VM Cloud backend 상태 확인은 read-only로만 먼저 합니다.

```bash
curl -fsS --max-time 20 https://att.ainativeos.net/health
```

## 다음 분석 방향

Preview smoke가 끝나면 최신 48시간 기준으로 아래를 다시 나눠 보세요.

- NPay 버튼 클릭 수.
- bridge/checkout까지 간 수.
- 실제 NPay 결제완료 수.
- 실제 결제완료 중 원래 버튼 클릭 row와 A급으로 붙는 수.
- Google click id가 있는 결제완료 수.
- Google Ads 전송 가능한 수.
- 미연결 주문의 사유: bridge id 없음, 세션 없음, 금액 조합 문제, 여러 후보, 시간차 문제, 상품/장바구니 문제, source 유실.

## 보고할 때 꼭 말할 결론 형태

TJ님에게는 이렇게 말해야 합니다.

`무엇이 가능해졌나 → 왜 중요한가 → 실제 숫자/검증 → 아직 안 된 것 → 다음 행동`

예시:

> NPay 버튼 클릭 row에 결제창/주문 연결 단서를 더 남길 준비는 끝났습니다. 중요한 이유는 Google Ads에 보낼 실제 결제완료 후보를 늘리려면 버튼 클릭과 최종 주문을 더 정확히 붙여야 하기 때문입니다. backend v1.2 smoke는 통과했지만 GTM Production에는 아직 v1.2가 게시되지 않아 실제 유저 개선 효과는 시작 전입니다. 다음은 Preview에서 실제 버튼 클릭 1건으로 hash 필드가 들어오는지 확인하는 것입니다.
