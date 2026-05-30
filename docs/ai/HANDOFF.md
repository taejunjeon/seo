작성 시각: 2026-05-30 17:05 KST
기준일: 2026-05-30
문서 성격: Claude Code 인수인계 문서

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
  required_context_docs:
    - project/!google-npay-bridge-core-mission-okr-20260530.md
    - project/google-npay-bridge-v12-approval-plan-20260530.md
    - project/google-ads-offline-diagnostics-identifier-too-old-20260529.md
    - project/google-ads-validate-only-16-and-batch5-result-20260529.md
    - project/google-ads-limited-send-245000-and-reflection-monitor-20260529.md
  lane: Green for this document, Yellow already used for approved VM Cloud backend deploy
  allowed_actions:
    - read-only repository inspection
    - local documentation update
    - local test/typecheck/audit
    - read-only VM Cloud inspection
    - dry-run matching analysis
  forbidden_actions:
    - Google Ads conversion send without fresh explicit approval
    - GTM Production publish without fresh explicit approval
    - production DB write/import
    - actual payment test without fresh explicit approval
    - secret exposure
  source_window_freshness_confidence:
    source: local repo + VM Cloud backend smoke + prior Google Ads/VM read-only checks
    window: mainly 2026-05-20 through 2026-05-30 KST
    freshness: VM Cloud backend smoke was checked 2026-05-30 16:49 KST
    confidence: high for implemented code/deploy state, medium for live funnel counters until rechecked
```

## 10초 요약

최종 목표는 Google Ads가 입찰 학습에 쓰는 구매 신호를 `NPay 버튼 클릭`이 아니라 `실제 결제완료 주문`으로 바꾸는 것이다.

현재 가장 큰 병목은 보고서 UI가 아니다. 진짜 병목은 **네이버 외부 결제창을 지난 뒤 실제 결제완료 주문을 원래 NPay 버튼 클릭 row와 안정적으로 다시 붙이지 못하는 것**이다.

2026-05-30 16:49 KST 기준 VM Cloud backend에는 NPay bridge v1.2 수집 보강이 배포됐고 smoke도 통과했다. 아직 GTM Production에는 v1.2 태그를 게시하지 않았으므로, 실제 운영 유저 데이터 개선 효과는 시작 전이다.

## 최종 목표

1. Google Ads 예산 판단용 구매 신호를 실제 결제완료 주문 기준으로 교체한다.
2. NPay 버튼 클릭/결제진입은 구매가 아니라 보조 신호로만 남긴다.
3. NPay 외부 결제창에서 완료된 주문을 원래 버튼 클릭 row와 다시 붙인다.
4. Google Ads에 전송하는 주문은 아래 조건을 모두 만족해야 한다.
   - 실제 결제완료 confirmed 주문이다.
   - 취소/환불/가상계좌 미입금이 아니다.
   - 주문 금액이 주문 원장 기준으로 확인된다.
   - gclid/gbraid/wbraid 중 하나가 실제 Google 광고 클릭에서 온 값이다.
   - TEST/SMOKE/GTM synthetic click id가 아니다.
   - 같은 주문/전환 액션으로 이미 보낸 적이 없다.

## 현재 완료된 작업

### Google Ads 구매 신호 정리

- 기존 `구매완료` 액션은 NPay 버튼 클릭/결제진입 보조 신호로 낮췄다.
- `TechSol - NPAY구매 50739`는 중복 보조 신호로 판단되어 삭제/사용 중지 흐름을 진행했다.
- `BI confirmed_purchase_offline`을 실제 결제완료 전용 Primary 전환으로 준비하고 운영 사용을 시작했다.
- Google Ads API 사용자 OAuth 기반 조회/전송 흐름을 로컬/VM Cloud에서 사용할 수 있게 했다.

### 실제 결제완료 전용 전송 장부

- VM Cloud SQLite에 Google Ads 전송 장부를 두고 중복 전송을 막는 구조를 만들었다.
- 직전 인수인계 기준 상태:
  - sent: 19건 / 4,119,827원
  - failed: 1건 / 293,206원
  - Google Ads 리포트에서 확인되는 값: 10건 / 1,815,827원
  - 아직 리포트에서 확인되지 않은 값: 9건 / 2,304,000원
- 실패 293,206원 row는 Google Ads 진단상 `식별자 또는 iOS URL 매개변수가 너무 오래됨` 계열이다. 쉽게 말하면 Google Ads가 인정하는 클릭-전환 기간보다 클릭이 오래되어 전환으로 못 붙인 것이다.

### NPay bridge v1.1 운영 게시

- GTM에 `BI NPay Bridge v1.1` 태그를 운영 게시했다.
- 버튼 클릭, bridge URL, checkout URL, 로그인/결제 단계 후보 라벨을 VM Cloud 쪽에 남기도록 보강했다.
- 라벨 의미:
  - `button_clicked`: 바이오컴 페이지에서 NPay 버튼 클릭은 확정.
  - `bridge_opened`: 네이버 결제 bridge URL 진입은 확정.
  - `login_gate_possible`: 네이버 로그인 화면에 걸린 가능성.
  - `checkout_opened_possible`: 네이버 결제서 화면까지 열린 가능성.
  - `completed`: 실제 주문 원장과 붙으면 확정.
  - `entered_not_completed`: bridge는 열렸지만 결제완료 주문이 없으면 이탈 후보.

### NPay bridge v1.2 backend 배포

- 2026-05-30 16:49 KST에 VM Cloud backend 배포와 smoke를 완료했다.
- 서버가 받을 수 있게 된 새 단서:
  - `npay_checkout_bridge_id_hash`
  - `imweb_order_code_hash`
  - `channel_order_no_hash`
  - `local_session_id_hash`
  - `cart_fingerprint_hash`
  - 장바구니/금액 단서
  - 단계별 시각 단서
- smoke 결과:
  - v1.2 컬럼 8개가 VM Cloud SQLite에 생성됨.
  - test smoke row 2건이 저장됨.
  - TEST click id는 `gclid/gbraid/wbraid` 컬럼에 저장되지 않음.
  - raw payload에는 TEST click id, raw bridge id, raw order id가 남지 않음.
- 아직 하지 않은 것:
  - GTM Production에 v1.2 태그 게시하지 않음.
  - Google Ads 전송하지 않음.
  - 실제 결제 테스트하지 않음.
  - 운영DB write/import 하지 않음.

### Google click id 보호

- `gclid`, `gbraid`, `wbraid`를 Google click id evidence로 본다.
  - `gclid`: 일반 웹 Google 광고 클릭 ID.
  - `gbraid`: iOS/개인정보 제한 환경에서 쓰이는 Google click id 계열.
  - `wbraid`: 웹-앱/개인정보 제한 환경에서 쓰이는 Google click id 계열.
- TEST/SMOKE/GTM click id가 실제 광고 클릭처럼 저장되거나 전송 후보가 되는 것을 막는 sanitizer를 추가했다.

### 보고서/화면

- 로컬 보고서:
  - `http://localhost:7010/ads/google-roas-report`
  - 상세 분리 화면: `http://localhost:7010/ads/google-roas-report/details`
- 운영 보고서:
  - `https://biocom.ainativeos.net/ads/google-roas-report`
- 보고서에는 Google Ads 주장 구매, 내부 confirmed 구매, NPay bridge, Google Ads 전송 후보/장부, click id 보존 상태를 분리해 보여주는 카드들이 추가되어 있다.

## 현재 중요한 숫자

숫자는 반드시 source/window/freshness/confidence와 같이 읽어야 한다.

### NPay 최신 48시간 병목

- source: VM Cloud NPay intent 원장 + imweb_orders.
- window: 2026-05-28 00:00~2026-05-30 00:00 KST.
- freshness: 2026-05-30 12:57 KST 조회 기준.
- confidence: medium. v1.2 운영 태그 게시 전 숫자다.

확인된 값:

- NPay 버튼 클릭: 221건.
- Google-like intent: 164건.
- Google-like 중 Google click id 보존: 163건.
- bridge URL/hash 있음: 111건.
- 실제 NPay 결제완료: 15건.
- A급 강한 연결: 3건.
- ambiguous completed: 12건.
- entered_not_completed: 108건.
- Google-like completed order: 1건 / 35,000원.
- Meta completed order: 2건 / 360,900원.
- 즉시 Google Ads 전송 후보: 0건.

핵심 해석:

- 버튼 클릭과 click id 저장은 꽤 잘 된다.
- 문제는 결제완료 주문을 원래 클릭 row와 1:1로 확정하는 부분이다.
- v1.2는 이 연결 단서를 보강하기 위한 backend 기반이다.

### Google Ads 반영 상태

- source: Google Ads API + VM Cloud SQLite upload ledger.
- window: 2026-04-30~2026-05-29 또는 2026-03-01~2026-05-29 재조회.
- freshness: 2026-05-30 인수인계 전 조회 기준.
- confidence: high for aggregate, medium for row-level unmatched until next requery.

확인된 값:

- `BI confirmed_purchase_offline` Google Ads 리포트:
  - 최근 7일: 4건 / 564,000원
  - 최근 30일: 10건 / 1,815,827원
  - 더 넓은 2026-03-01~2026-05-29: 동일하게 10건 / 1,815,827원
- VM Cloud upload ledger:
  - sent 19건 / 4,119,827원
  - failed 1건 / 293,206원
- 현재 해석:
  - 10건은 Google Ads 리포트에 보인다.
  - 9건은 아직 보이지 않는다.
  - 보이지 않는 9건은 단순 지연, 클릭 날짜 조회축 불일치, click-through window 초과, 중복/스팸 필터 중 무엇인지 row별 확인이 필요하다.

### Google Ads 오프라인 전환 진단

- source: Google Ads API `offline_conversion_upload_client_summary`, `offline_conversion_upload_conversion_action_summary`.
- conversion action: `BI confirmed_purchase_offline` / ID `7609289411`.
- 확인된 요약:
  - status: `EXCELLENT`
  - totalEventCount: 15
  - successfulEventCount: 14
  - successRate: 0.9333
  - alert: `EXPIRED_EVENT` 약 0.07
- 쉬운 해석:
  - Google Ads API 자체는 대부분 정상 수신하고 있다.
  - 일부 row는 클릭이 너무 오래되어 Google Ads가 전환으로 인정하지 못한다.

## 수정한 파일 목록과 변경 이유

다음 에이전트는 절대 `git reset`, `git checkout --`, 광범위한 `git add -A`를 하지 말고 파일 단위로 의도를 확인해야 한다.

### 이번 v1.2 직접 변경 파일

- `backend/src/npayIntentLog.ts`
  - 이유: NPay 버튼 클릭 row에 bridge/order/session/cart 단서를 hash로 저장하고 raw payload에서 원문 식별자를 제거하기 위해 수정.
  - 주의: 기존 테이블 migration 순서가 중요하다. 새 컬럼 인덱스는 `ensureColumn` 이후 생성해야 한다.
- `backend/src/npayRoasDryRun.ts`
  - 이유: v1.2 단서를 dry-run 후보표와 보고서에서 읽을 수 있도록 확장.
- `backend/tests/npay-intent-v12.test.ts`
  - 이유: raw order/bridge/click id가 저장되지 않고 hash만 남는지 검증.
- `imweb/biocom-npay-bridge-gtm-v1-2-preview.js`
  - 이유: GTM Preview용 v1.2 태그 초안.
- `project/google-npay-bridge-v12-approval-plan-20260530.md`
  - 이유: 승인안과 실제 배포/smoke 결과 기록.
- `project/!google-npay-bridge-core-mission-okr-20260530.md`
  - 이유: 핵심 목표와 진척률을 v1.2 배포 상태로 갱신.

### 기존 Google Ads 실제 구매 전송 관련 파일

- `backend/src/routes/googleAds.ts`
  - 이유: Google Ads 대시보드 API, 실제 결제완료 후보 생성, private payload preview, 전송 장부, limited upload, offline diagnostic, click-age 판단.
- `backend/scripts/google-ads-confirmed-purchase-auto-send.sh`
  - 이유: VM Cloud에서 10분마다 최근 24시간 후보를 제한 전송하는 cron 스크립트. 현재 설계상 limit 5.
- `backend/src/googleClickIdSanitizer.ts`
  - 이유: TEST/SMOKE/GTM click id가 실제 Google Ads 전송 후보가 되지 않도록 차단.
- `backend/tests/google-click-id-sanitizer.test.ts`
  - 이유: sanitizer 검증.

### 기존 NPay 연결 관련 파일

- `backend/scripts/npay-bridge-v11-gtm-preview.ts`
  - 이유: GTM Preview workspace에 NPay bridge v1.1 태그를 구성하기 위한 스크립트.
- `backend/scripts/npay-bridge-v11-gtm-preview-install-smoke.ts`
  - 이유: Preview 설치와 smoke 확인 자동화.
- `backend/scripts/npay-intent-row-level-check.ts`
  - 이유: `NPAY_INTENT_ADMIN_TOKEN`으로 VM Cloud row-level 저장 여부를 확인.
- `imweb/biocom-npay-bridge-gtm-v1-1-preview.js`
  - 이유: GTM에 들어간 NPay bridge v1.1 태그 원본.

### 보고서 프론트엔드

- `frontend/src/app/ads/google-roas-report/page.tsx`
  - 이유: Google ROAS 정합성, BI confirmed 전송 상태, NPay bridge 병목, click id 보존 상태 표시.
- `frontend/src/app/ads/google-roas-report/details/page.tsx`
  - 이유: 정보량이 많아진 보고서를 상세 화면으로 분리.
- `frontend/src/app/ads/google-roas-report/page.module.css`
  - 이유: 카드/퍼널/상세 섹션 UI 스타일.

## 통과한 테스트와 실행 명령어

이번 v1.2 배포 직전/직후 확인:

```bash
cd /Users/vibetj/coding/seo/backend
npm run typecheck
```

결과: 통과.

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx --test tests/npay-intent-v12.test.ts tests/npay-roas-dry-run.test.ts
```

결과: 7개 테스트 통과.

```bash
cd /Users/vibetj/coding/seo
python3 scripts/harness-preflight-check.py --strict
```

결과: 통과.

```bash
cd /Users/vibetj/coding/seo
git diff --check
```

결과: 통과.

```bash
curl -fsS --max-time 20 https://att.ainativeos.net/health
```

결과: `status=ok`.

VM Cloud remote:

```bash
cd /home/biocomkr_sns/seo/repo/backend
npm run build
pm2 restart seo-backend --update-env
```

결과: build 통과, `seo-backend` online.

## 아직 남은 작업

### P0. v1.2 GTM Preview smoke

무엇을 해야 하나:

- GTM Preview workspace에서 `imweb/biocom-npay-bridge-gtm-v1-2-preview.js`를 실제 바이오컴 상품 페이지에 적용해 NPay 버튼 클릭 1건을 만든다.
- VM Cloud row가 `gtm_npay_bridge_v1_2` source로 들어오고, v1.2 hash 필드가 채워지는지 본다.

왜 필요한가:

- backend는 준비됐지만, 실제 브라우저/GTM 태그가 새 필드를 제대로 보내는지는 아직 검증 전이다.

성공 기준:

- `npay_checkout_bridge_id_hash`, `local_session_id_hash`, `cart_fingerprint_hash` 중 핵심 필드가 64자리 hash로 들어온다.
- raw payload에는 raw bridge URL token, raw order id, raw click id가 없다.
- GTM Production publish는 하지 않는다.

### P1. v1.2 운영 게시 승인안 또는 수정안 작성

무엇을 해야 하나:

- Preview 결과를 보고 Production publish 가능/수정 필요를 판단한다.

성공 기준:

- TJ님이 Google Tag Manager에서 어떤 workspace, 어떤 태그, 어떤 변경사항을 게시할지 한 화면 기준으로 이해할 수 있다.
- 게시하면 생기는 효과와 안 하면 남는 문제가 같이 적힌다.

### P1. 최신 48시간 NPay 미연결 주문 재분류

무엇을 해야 하나:

- `ambiguous completed`, `purchase_without_intent`, `entered_not_completed`를 v1.2 기준으로 다시 분류할 준비를 한다.

성공 기준:

- 미연결 주문마다 `bridge id 없음`, `세션 없음`, `금액 조합 문제`, `여러 후보`, `시간차 문제`, `상품/장바구니 문제` 중 최소 1개 사유가 붙는다.

### P2. Google Ads 전송 장부 row별 상태 닫기

무엇을 해야 하나:

- sent 19건 중 리포트 반영 10건, 미반영 9건, failed 1건을 row별로 다시 닫는다.

성공 기준:

- 각 row가 `reflected`, `waiting`, `expired_click`, `wrong_date_axis`, `filtered_or_duplicate`, `unknown` 중 하나로 분류된다.

## 다음 Claude Code가 바로 실행해야 할 첫 번째 작업

첫 작업은 보고서 UI 수정이 아니다.

바로 실행할 작업:

1. `project/google-npay-bridge-v12-approval-plan-20260530.md`를 읽는다.
2. `backend/src/npayIntentLog.ts`와 `imweb/biocom-npay-bridge-gtm-v1-2-preview.js`를 비교한다.
3. GTM Preview smoke에 필요한 태그/트리거/변수 목록을 화면 기준으로 정리한다.
4. 가능하면 GTM Preview workspace에서 v1.2 태그를 구성한다.
5. 접근/2FA/UI 권한으로 막히면 TJ님에게 요청할 정확한 화면과 클릭 순서를 적는다.

절대 첫 작업으로 하지 말 것:

- Google Ads 추가 전송.
- GTM Production publish.
- 실제 결제 테스트.
- 운영DB write.
- 프론트 보고서만 먼저 꾸미기.

## 주의해야 할 보안/권한/운영 리스크

### 원문 식별자 노출 금지

아래 값은 문서/대화/보고서/API 응답에 원문으로 출력하지 않는다.

- raw order code
- raw channel order no
- raw payment code/key
- raw NPay bridge URL token
- raw gclid/gbraid/wbraid
- member code
- phone/email

서버 내부 transient request body로 받는 것은 가능하지만, 저장은 HMAC/hash 또는 presence flag로 제한한다.

### Red Lane 금지선

아래는 TJ님이 다시 명시 승인하기 전 실행 금지다.

- Google Ads conversion upload.
- GTM Production publish.
- 실제 결제 테스트.
- 운영DB write/import.
- 영구 env flag ON.
- 자동 dispatcher 운영 전환 확대.

### VM Cloud와 운영DB 구분

- VM Cloud: TJ님 관리 Cloudflare/SQLite 수집 보조 원장. 대표 도메인 `att.ainativeos.net`.
- 운영DB: 개발팀 관리 PostgreSQL dashboard DB.
- 이 작업의 주 source는 VM Cloud SQLite지만, 주문 정본과 sync freshness를 항상 따로 표시해야 한다.

### 배포/권한

- VM Cloud repo: `/home/biocomkr_sns/seo/repo`
- backend: `/home/biocomkr_sns/seo/repo/backend`
- node path: `/home/biocomkr_sns/seo/node/bin`
- PM2 app: `seo-backend`
- remote ssh pattern:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94
sudo -u biocomkr_sns bash -lc 'export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; ...'
```

주의:

- 원격 `biocomkr_sns` 기본 PATH에는 `node`/`git`이 안 잡힐 수 있다.
- 빌드/pm2 실행 시 `/home/biocomkr_sns/seo/node/bin`을 PATH에 명시한다.
- repo 파일 권한 때문에 일반 사용자 `ls`가 막힐 수 있다. 필요한 확인은 `sudo -u biocomkr_sns`로 한다.

### 테스트 row

- v1.2 backend smoke 과정에서 VM Cloud SQLite에 preview/test row 2건이 들어갔다.
- 둘 다 `source=gtm_npay_bridge_v1_2`, `environment=preview`.
- TEST click id는 정상 컬럼에는 저장되지 않았다.

## Slack, GitHub, VM, 환경변수 등 외부 의존성

### Slack / Telegram

- Slack 연동은 이 작업에서 사용하지 않았다.
- Telegram 알림은 기본 생략 원칙이다. 이전에 “이번만 보내지마” 요청이 있었으므로 별도 발송하지 않는다.

### GitHub

- 이번 handoff 시점에 커밋/푸시는 하지 않았다.
- 다음 에이전트는 먼저 `git status --short`로 dirty 상태를 확인해야 한다.
- `docs/ai/`는 untracked 상태일 수 있다. 무조건 stage하지 말고 필요한 문서만 선별한다.

### VM Cloud

- 대표 도메인: `https://att.ainativeos.net`
- health: `https://att.ainativeos.net/health`
- backend app: `seo-backend`
- SQLite path는 backend env에 따라 다르지만 현재 smoke 확인은 `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`에서 했다.

### Google Ads

- OAuth client는 로컬 `.env` 290~291행에 넣었다고 TJ님이 말했다.
- Google Ads 전환 action:
  - name: `BI confirmed_purchase_offline`
  - id: `7609289411`
  - type: `UPLOAD_CLICKS`
- 이 action은 Primary 전환으로 사용 중이다.

### GTM

- v1.1은 Production publish 완료.
- v1.2는 Preview 초안만 있음.
- Default Workspace 사용 금지.
- live latest 기준 fresh workspace 사용.
- Production publish는 Red Lane이다.

### 환경변수

실제 값을 문서에 쓰지 않는다.

관련 이름:

- `NPAY_INTENT_ADMIN_TOKEN`
- `NPAY_BRIDGE_HMAC_SECRET`
- `ORDER_BRIDGE_IDENTITY_HASH_SECRET`
- `NPAY_INTENT_HASH_SALT`
- `ATTRIBUTION_HASH_SALT`
- Google Ads OAuth 관련 env
- Google Ads developer token/customer id 관련 env

## 현재 git 상태 메모

마지막 확인 기준 주요 변경:

```text
M backend/src/npayIntentLog.ts
M backend/src/npayRoasDryRun.ts
M project/!google-npay-bridge-core-mission-okr-20260530.md
?? backend/tests/npay-intent-v12.test.ts
?? docs/ai/
?? imweb/biocom-npay-bridge-gtm-v1-2-preview.js
?? project/google-npay-bridge-v12-approval-plan-20260530.md
```

주의:

- `docs/ai/` 전체를 무조건 추가하지 말고 문서별로 확인한다.
- 배포는 이미 VM Cloud backend에 반영됐지만 로컬 git commit은 아직 없다.

## Claude Code용 짧은 실행 지시

아래 파일을 그대로 Claude Code 첫 프롬프트로 써도 된다.

- `docs/ai/CLAUDE_CODE_PROMPT.md`
