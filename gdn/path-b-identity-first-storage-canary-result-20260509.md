# Path B identity-first storage canary result

작성 시각: 2026-05-09 22:34 KST

## 한 줄 결론

1시간 order-complete-only canary에서 hash-only row가 2건 추가됐고, 둘 다 `identity_only_quarantine`으로 안전하게 격리됐다.

## 사람이 이해하는 의미

주문완료 화면에서 주문번호와 로그인 identity는 hash-only 원장에 들어왔다. 다만 광고 click id는 없었으므로 Google Ads 전송 후보가 아니라 격리 보관 row로만 분류했다.

## 실행 범위

- Site: `biocom`.
- 실행 방식: order-complete-only limited Production publish 1h.
- VM Cloud write flag: 1시간 한정 ON 후 OFF.
- Row cap: 200.
- 저장 방식: hash-only.
- 외부 전송: Path B 기준 0.
- 기존 GTM tag pause/delete: 없음.

## 시간

- GTM canary publish: 2026-05-09 21:17:31 KST.
- VM Cloud write flag ON: 2026-05-09 21:17:54 KST.
- Scheduled canary until: 2026-05-09 22:17:53 KST.
- Cleanup and rollback verification: 2026-05-09 22:30:06 KST.

## 숫자

- Baseline row_count: 2.
- Final row_count: 4.
- Canary row delta: 2.
- Row cap: 200.
- Canary status:
  - `full_bridge`: 0.
  - `identity_only_quarantine`: 2.
  - `session_only_quarantine`: 0.
  - `click_missing_hold`: 0.
  - `ambiguous`: 0.
  - `do_not_send`: 0.
- Raw stored count: 0.
- Path B platform send count: 0.

## 해석

`identity_only_quarantine` 2건은 실패가 아니다. 현재 전략은 click id가 없는 주문완료 row도 버리지 않고, `send_candidate=false` 상태로 격리해 후속 dry-run에서 판단하는 것이다.

## 주의

기존 `payment-decision` GET query raw logging은 여전히 P1 hardening backlog다. 이번 Path B endpoint 자체는 canary stage를 PM2 log에 남기지 않았고, raw payload 저장도 0이었다.

## 판정

PASS_WITH_QUARANTINE. 저장 안전성은 PASS, Google Ads 전송은 계속 HOLD.
