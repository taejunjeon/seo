# Current Handoff

작성 시각: 2026-05-17 17:48 KST

## 현재 목표

GA4와 VM Cloud가 같은 사람/주문 흐름으로 이어지는지 row-level safe bridge로 확인하고, 더클린커피 channel별 구매자 vs 이탈자 truth table과 GA4 중간 이벤트 GTM Preview 승인안, 바이오컴 key capture 보강/Plan B 승인안을 마무리한다.

## 완료한 것

- VM Cloud SQLite와 GA4 BigQuery를 read-only로 조회하고, raw id 없이 safe session hash 기준 row-level dry-run을 실행했다.
- 더클린커피는 confirmed purchase 326세션 중 GA4 joined 316세션(96.93%), dropped checkout 378세션 중 joined 357세션(94.44%)으로 Green 행동 비교 가능으로 판단했다.
- 바이오컴은 confirmed purchase joined 112/380(29.47%), dropped checkout joined 205/715(28.67%)로 key capture 보강 또는 승인된 raw-id Plan B가 필요하다고 판단했다.
- 더클린커피 GA4 중간 이벤트 보강 설계를 작성했다. 핵심은 `view_cart`, `begin_checkout`, `add_payment_info` 보강이고, `purchase`는 새로 발화하지 않는다.
- gpt-5.5 pro web 피드백을 받아 문서에 반영했다. 특히 `dropped_checkout` 오염 가능성, `add_payment_info` 엄격 조건, GA4 purchase가 매출 정본이 아니라는 점을 보강했다.
- 더클린커피 channel별 구매자 vs 이탈자 truth table을 생성했다. YouTube 구매율 59.46%, Meta 구매율 55.22%, Naver paid/brand 구매율 22.03%로 집계됐다.
- 바이오컴 key capture 보강안과 raw-id Plan B 승인안을 작성했다. 현재 권장 순서는 Green coverage 분해 -> Yellow hash-only capture smoke -> Red raw-id Plan B다.
- 더클린커피 GA4 중간 이벤트 GTM Preview 승인안을 작성했다. 범위는 `view_cart`, `begin_checkout`, `add_payment_info` Preview-only이며 `purchase` 변경/게시/전송은 금지다.
- 산출물: `project/ga4-vm-row-level-safe-bridge-dry-run-20260517.md`, `project/coffee-channel-cohort-truth-table-20260517.md`, `project/biocom-key-capture-and-raw-id-plan-b-approval-20260517.md`, `project/coffee-ga4-middle-event-gtm-preview-approval-20260517.md`.

## 다음 명령

1. 최종 검증(typecheck/json/wiki/harness/diff/raw scan)을 실행한다.
2. 필요 시 더클린커피 GTM Preview-only Yellow 승인 여부를 TJ님에게 받는다.
3. 바이오컴 key capture coverage 분해 리포트를 Green으로 진행한다.

## 절대 건드리면 안 되는 것

- 운영DB write/import.
- VM Cloud schema migration 또는 deploy/restart.
- Meta/GA4/Google Ads/TikTok/Naver send/upload.
- GTM publish.
- raw order/payment/member/click/email/phone 값의 대화·문서·git 출력.
