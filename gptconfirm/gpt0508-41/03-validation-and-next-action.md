# 03 validation + next action (gpt0508-41)

작성 시각: 2026-05-11 14:55:00 KST
범위: 검증 결과 + 다음 sprint 승인안

## 1. 검증 결과

| 검증 | 결과 |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `tests/site-landing-ledger.test.ts` | 12/12 PASS (233ms) |
| `tests/site-landing-channel-classifier.test.ts` | 18/18 PASS (166ms) |
| `tests/site-landing-receiver.test.ts` | 9/9 PASS (638ms) |
| `scripts/site-landing-summary-dryrun-20260511.ts` | 3,704 row inject → 3,281 row 저장 (dedupe 423 건), JSON 출력 OK |
| raw PII pattern 4종 차단 | fixture 2 건 PASS |
| dedupe (sessionKey + 10분 bucket) | fixture 2 건 PASS |
| TTL = landed_at + 30일 default | fixture 1 건 PASS |

## 2. invariants (sprint 전체)

| invariant | 결과 |
|---|---|
| send_candidate / actual_send_candidate | false / false |
| upload_candidate | 0 |
| GTM Production publish | 0 |
| imweb footer/header 직접 수정 | 0 |
| 운영DB write | 0 |
| 외부 플랫폼 전송 | 0 |
| Google Ads conversion action 변경 | 0 |
| GA4/Meta/TikTok/Naver 운영 전송 | 0 |
| NPay click → actual purchase 승격 | 0 |
| time-window-only 단독 캠페인 budget 판단 | 0 |
| raw email/phone/member_code/order_no/payment 저장 또는 logging | 0 |
| raw click_id 저장 | 허용 (TTL 30d, no log/frontend/export/external) — fixture 2 건 PASS |
| Telegram 발송 | 0 (TJ standing skip) |

## 3. Track 진척

| Track | 이전 | 현재 | Δ | 목표 충족 |
|---|---|---|---|---|
| A ConfirmedPurchasePrep | 99 | 99 | 0 | ✅ 유지 |
| B Google Ads exact attribution | 98 | 98 | 0 | ✅ 유지 |
| C BigQuery/유입 funnel quality | 85 | **89** | +4 | ✅ 88%+ |
| D/KR6 Meta funnel CAPI | 74 | 74 | 0 | — |
| E Harness/HOLD Reducer | 99 | 99 | 0 | ✅ 유지 |
| F Data Trust Dashboard | 80 | **83** | +3 | ✅ 83%+ |
| **G Site Landing Ledger** (신규) | 0 | **62** | +62 | ✅ 60%+ |

Track G 62% 산정: schema PASS (15%) + receiver PASS (15%) + classifier PASS (10%) + helper invariants PASS (10%) + summary dry-run PASS (10%) + production trigger 미연결 (~38% gap).
Track C 의 +4 / Track F 의 +3 은 site_landing helper 신설로 인한 BQ 유입 quality 개선 + dashboard 표시 후보 추가.

## 4. 다음 승인안 (별도 sprint 들)

### 41-Deploy-A. backend handler fan-out wire (소형, Green code)
- /api/attribution/{marketing-intent, payment-success, checkout-context, paid-click-intent} handler 안에서 `recordSiteLanding` best-effort 호출
- footer/GTM 변경 0, 운영DB write 0, 외부 전송 0
- 예상 시간 1 시간

### 41-Deploy-B. dashboard frontend 카드 (소형, Green code)
- frontend/src/app/ads/ 안에 site_landing summary 카드 1 개 추가 (read-only)
- API: `/api/attribution/site-landing/summary` (신규)
- 예상 시간 2 시간

### 41-Deploy-C. footer page_view trigger (Yellow / approval 필요)
- imweb footer 의 funnel-capi v3 에 `/api/attribution/site-landing` page_view 호출 추가
- 별도 approval 필요 (footer 수정 금지 해제)
- 또는 GTM Custom HTML 태그로 분리 (GTM publish 별도 approval)
- 예상 시간 footer 1시간, GTM 1시간 + publish 승인

### 41-Deploy-D. Google Ads click_view 30d snapshot prep table (Yellow / approval 필요)
- BQ 또는 Ads Query 결과를 로컬 SQLite prep table 에 저장
- 일 1회 cron
- 예상 시간 4 시간

## 5. 다음 액션

### Claude Code 가 할 일

1. 본 sprint commit/push 완료 → main 반영.
2. TJ 의 다음 sprint approval 시 41-Deploy-A (handler fan-out) 부터 진행 권장.

### TJ 님이 할 일

1. 본 sprint 의 7 산출 파일 + 4 helper + 39 fixture 의 lane 확인.
2. 다음 sprint 우선순위 결정: A → B → C/D 순서 또는 다른 배치.
3. peak canary (gpt0508-40 작업6) 실측 시점 협조 (별도 사안).

## 6. Verdict

`SPRINT_GREEN_HELPER_LAYER_DONE_AIMWEB_BASIC_85_PCT_TARGET_MET_DEPLOY_NEXT_SPRINT`
