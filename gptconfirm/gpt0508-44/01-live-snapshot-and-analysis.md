# 01 live snapshot + 분석 (gpt0508-44)

작성 시각: 2026-05-11 18:45:00 KST
범위: 작업 1 (snapshot) + 작업 2 (internal/test filter) + 작업 5 (paid_search sanity) + 작업 4 (frontend) 통합

## 1. snapshot script + 1차 실행

| 항목 | 값 |
|---|---|
| script 경로 | `backend/scripts/site-landing-live-snapshot-20260511.ts` |
| mode | read-only, no-write, no-send |
| 윈도우 | 6h / 24h / 72h |
| 첫 실행 시각 | 2026-05-11 18:13 KST (deploy 후 30분) |
| 출력 | `data/site-landing-live-snapshot-20260511-h{6,24,72}.json` |
| 지표 수 | 18 |

## 2. 1차 실행 결과 (24h 윈도우)

| 지표 | 값 |
|---|---|
| total_rows | 12 |
| unique_session_count | 12 |
| source_evidence_present_rate | **1.0** |
| paid_search | 7 |
| organic_search | 2 |
| referral | 2 |
| direct (포함 self_internal) | 1 |
| unknown | 0 |
| utm_campaign top | `googleads_shopping_supplements_dangdang` 4 / `googleads_shopping_supplements_youngdays` 3 / `b2026051144755feeb63db` 3 / `1` 1 |
| source_breakdown top | google.com 7 / thecleancoffee.com 2 / pay.naver.com 1 / orders.pay.naver.com 1 / biocom.kr 1 |
| hash_only_rate | 1.0 (7 click 중 raw 0) |
| raw_click_count | **0** |
| internal_or_test_traffic_count | 4 (filter v2 적용 후) |
| sample_too_small_warning | true (< 50) |
| gtm_verdict_provisional | INSUFFICIENT_SAMPLE_HOLD |

## 3. internal/test traffic filter (작업 2)

| 규칙 | 패턴 |
|---|---|
| test prefix | `^test`, `^debug`, `^claude`, `^staging` |
| short numeric | `^\d{1,3}$` |
| imweb 자동 ID | `^b\d{8}[a-z0-9]{10,30}$` |
| admin path | receiver 자체가 미수신 (`/admin/*`, `/auth/*`, `/login*`) |

적용 결과: 12 row 중 8 likely_real_customer / 4 likely_internal_test.

| utm_campaign | count | tag | 이유 |
|---|---:|---|---|
| `googleads_shopping_supplements_dangdang` | 4 | real | google ads 실 캠페인 |
| `googleads_shopping_supplements_youngdays` | 3 | real | google ads 실 캠페인 |
| `b2026051144755feeb63db` | 3 | internal_test | imweb 자동 ID |
| `1` | 1 | internal_test | short numeric |

## 4. paid_search campaign sanity (작업 5)

| campaign | count | source_type | channel report? | budget? |
|---|---:|---|---|---|
| `googleads_shopping_supplements_dangdang` | 4 | utm_campaign | ✅ | ❌ |
| `googleads_shopping_supplements_youngdays` | 3 | utm_campaign | ✅ | ❌ |
| `b2026051144755feeb63db` | 3 | inferred (imweb auto id) | ❌ | ❌ |
| `1` | 1 | unknown | ❌ | ❌ |

Google Ads upload / send / conversion action 변경 / campaign_id exact match 시도 모두 0.

## 5. frontend 개선 (작업 4)

- `biocom.ainativeos.net/ads/site-landing` 페이지에 작은 표본 안내 배너 추가 (68 → 73 LOC).
- `summary.total < 50` 일 때 노란 알림 "표본 N 건은 작은 표본 — 비율 해석 보류" 노출.
- 50 건 도달 시 자동 사라짐.
- frontend `npm run build` PASS, pm2 restart 후 200 OK 검증.

## 6. 금지선 준수 상세표 (gptconfirm 문서 only)

| invariant | 결과 |
|---|---|
| send_candidate / actual_send_candidate / upload_candidate | false / false / 0 |
| GA4 / Meta / TikTok / Naver 운영 전송 | 0 |
| Google Ads confirmed_purchase upload | 0 |
| Google Ads conversion action 변경 | 0 |
| GTM Production publish | 0 |
| imweb footer / header 직접 수정 | 0 |
| 운영DB write | 0 |
| raw email/phone/order_no/payment/member_code 저장 또는 logging | 0 |
| raw click_id log/frontend/export/external 노출 | 0 |
| NPay click → actual purchase 승격 | 0 |
| exact evidence 없는 row → Google Ads campaign_id 귀속 | 0 |
| time-window-only → 예산 판단 | 0 |
| ORDER_BRIDGE_RAW_BODY_LOGGING / PLATFORM_SEND_ENABLED | false / false |
| Telegram 발송 | 0 (TJ standing skip — 00 §결론 통합) |

## 7. 검증 상세

| 검증 | 결과 |
|---|---|
| backend npx tsc (snapshot script + 기존) | PASS |
| frontend npx tsc (page.tsx 73 LOC) | PASS |
| VM `npm run build` (frontend) | PASS |
| pm2 restart seo-frontend | PASS, 200 OK |
| snapshot script execution 3 윈도우 | 모두 exit 0, JSON 정상 |
| raw PII pattern regex scan (summary 응답) | 0 hit |
| raw click_id storage_mode 검증 (DB) | hash 7 / raw 0 |
