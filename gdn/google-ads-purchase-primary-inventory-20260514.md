# Google Ads · PURCHASE primary action inventory (read-only · 2026-05-14)

## 목적
Google Ads customer 214-999-0943 의 **PURCHASE category conversion action 11개** (primary 8 + secondary 3) 를 read-only 정리. **본 sprint mutate 0**. 정리 순서 초안만.

## 한 줄 결론

PURCHASE primary 8개 중 **UA Transaction 4개 (sunset since 2023-07-01) 는 dead source** — 학습 신호로 부적합. GA4 imported 3개는 cross-site / custom event 신호 quality audit 필요. 구매완료 (WEBPAGE) 1개만 현재 active.

## primary 8개 inventory

| id | name | type | window | 우려 | 권장 |
|---|---|---|---|---|---|
| 782218494 | Transactions (A_view) | UA Transaction | 30d | **UA sunset 2023-07** | deprecate |
| 916482221 | Transactions (바이오컴펫_main - 필터적용) | UA Transaction | 30d | UA sunset | deprecate |
| 916483619 | 더클린커피 웹 (web) purchase | GA4 purchase | 30d | **cross-site (커피)** | secondary 강등 |
| 917303941 | 바이오컴펫_와이즈 - GA4 (web) purchase | GA4 purchase | 30d | cross-site (바이오컴펫) | campaign 매핑 검토 |
| 917325117 | Transactions (전체 웹사이트 데이터) | UA Transaction | 30d | UA sunset | deprecate |
| 922178603 | [G4] biocom.kr (web) in_app_purchase | GA4 custom | 90d | custom event 신호 quality | audit 후 강등 검토 |
| 945320590 | Transactions (전체 웹사이트 데이터) | UA Transaction | 30d | UA sunset, 917325117 과 중복 가능성 | deprecate |
| **7130249515** | **구매완료** | **WEBPAGE** | **7d** | active primary. NPay click trigger 와 직접 연결 가능성 | **현재 유지** |

## secondary 3개 inventory

| id | name | type | window | 우려 | 권장 |
|---|---|---|---|---|---|
| 6630514046 | [G4] biocom.kr (web) 결제완료 | GA4 custom | 90d | 신호 quality audit 필요 | 유지 (BI 와 비교 baseline) |
| 7564830949 | TechSol - NPAY구매 50739 | WEBPAGE | 90d | 이름과 달리 NPay click/intent — ₩1.7억~1.9억 부풀림 (이전 sprint) | **유지** (이전 sprint decision) |
| 7609289411 | BI confirmed_purchase_offline | UPLOAD_CLICKS | 30d | 어제 신규. 향후 primary 후보. 현재 upload 0 | **유지** (fill-rate 개선 후 canary) |

## 정리 순서 초안 (실행 금지 · Red Lane 별도 sprint)

| step | action | 영향 | rollback |
|---|---|---|---|
| 1 | UA 4개 (782218494, 916482221, 917325117, 945320590) primary_for_goal=false 또는 status=REMOVED | dead 신호 4개 제거 — 입찰 모델 정리 | primary_for_goal=true 복원 |
| 2 | GA4 imported 외부 site (916483619 커피, 917303941 바이오컴펫_와이즈) campaign 매핑 audit → biocom 학습에 포함되면 secondary 강등 | biocom 학습이 biocom 신호만 사용 | primary 복원 |
| 3 | 922178603 GA4 in_app_purchase 신호 quality audit + secondary 강등 검토 | GA4 신호 정리 | — |
| 4 | BI confirmed_purchase_offline (7609289411) primary 승격 (fill-rate 50%+ + canary 통과 후) | 직접 upload 신호로 입찰 학습 | — |
| 5 | 구매완료 (7130249515) secondary 강등 검토 | NPay click trigger 분리 | — |

## risk 요약

- **UA 4개**: UA 2023-07 sunset 이므로 실제 데이터 흐름 없음 — 학습 신호로는 stale dead. 정리 우선순위 가장 높음.
- **GA4 cross-site 2개**: 커피 + 바이오컴펫 신호가 biocom main 학습에 포함되면 입찰 모델 혼선 가능.
- **GA4 custom 1개**: in_app_purchase 가 실제 결제완료와 일치하는지 audit 필요.
- **WEBPAGE 구매완료**: 7d window, NPay click 과 연결 가능성. BI 안정화 후 정리.

## invariants held (본 sprint)

| invariant | value |
|---|---|
| primary_for_goal_change_count | 0 |
| status_remove_count | 0 |
| campaign_mutate | 0 |
| campaign_budget_mutate | 0 |
| google_ads_upload_send | 0 |

본 inventory 는 **read-only 정본**. 실제 정리 (step 1~5) 는 **별도 Red Lane sprint** 에서 TJ 명시 승인 후 진행.

## 참고

- 본 root-cause 산출: [google-ads-click-id-capture-root-cause-20260514.md](google-ads-click-id-capture-root-cause-20260514.md)
- approval packet: [google-ads-click-id-capture-fix-approval-20260514.md](google-ads-click-id-capture-fix-approval-20260514.md)
- 어제 post-check (BI action): [google-ads-bi-confirmed-purchase-offline-postcheck-20260514.md](google-ads-bi-confirmed-purchase-offline-postcheck-20260514.md)
- 어제 no-send dry-run: [google-ads-confirmed-purchase-no-send-quality-20260514.md](google-ads-confirmed-purchase-no-send-quality-20260514.md)
- TechSol audit: [techsol-gads-npay-click-conversion-audit-20260510.md](techsol-gads-npay-click-conversion-audit-20260510.md)
