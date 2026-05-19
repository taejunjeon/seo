# TJ 승인 큐

작성 시각: 2026-05-07 12:42 KST
최신 업데이트: 2026-05-19 15:47 KST
상태: active
Owner: total / approval
Next document: confirm/confirm0519-1.md
Do not use for: 이미 승인되지 않은 운영 배포, DB write, 플랫폼 전송 실행

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - total/!total-current.md
  lane: Green 승인 큐 정리 / frontend confirmation tracking
  allowed_actions:
    - 현재 승인 필요 여부 정리
    - future approval 후보 기록
    - frontend confirmation 후보 기록
  forbidden_actions:
    - 승인 전 운영 DB/ledger write
    - 승인 전 GTM publish
    - 승인 전 platform send
  source_window_freshness_confidence:
    source: "confirm/confirm0519-1.md + meta/meta-utm-diagnostics-frontend-20260519.md + local frontend/backend smoke"
    window: "2026-05-12 ~ 2026-05-18 KST for Meta UTM data, confirmation queue updated 2026-05-19 KST"
    freshness: "Meta UTM local cache 2026-05-19 01:55 KST + confirmation queue updated 2026-05-19 01:50 KST"
    confidence: 0.9
```

## 10초 결론

현재 TJ님이 승인해야 할 open confirmation은 **1건**이다.

[[confirm0519-1]]은 Meta UTM 진단 프론트엔드 화면 확인용 컨펌이다. 2026-05-19 02:54 KST 1차 운영 배포는 완료됐고, 2026-05-19 15:47 KST에 `매칭율%`, Section C 미맵핑, 미맵핑 주문 카드가 추가됐다. 이 추가 변경은 로컬 검증 완료 상태이며, 운영 반영은 TJ님 배포 승인 후 진행한다.

[[confirm0507-1]]은 승인 완료됐다. 더클린커피 NPay 과거 매칭 Sprint는 “자동 복구 전송 없이 종결하고 future intent/A-6로 넘김”으로 닫는다.

## 현재 승인 상태

| 항목 | 상태 | 해석 |
|---|---|---|
| Meta UTM 진단 프론트엔드 화면 | 1차 운영 배포 완료 / 매칭율% 추가 변경은 배포 승인 필요 | [[confirm0519-1]]에 `매칭율%`, Section C 미맵핑, 미맵핑 주문 카드 변경과 로컬 캡처를 추가했다. 운영 반영 전 TJ님이 `confirm/meta-utm-match-rate-local-20260519.png` 기준으로 화면 방향을 확인한다 |
| paid_click_intent Mode B | 승인 완료 / 실행 완료 | backend no-write receiver route, smoke, GTM publish, live smoke까지 완료 |
| 24h/72h monitoring | 승인 불필요 | read-only monitoring 이므로 Codex가 정시에 실행 |
| Coffee NPay 과거 매칭 종결 | 승인 완료 / closed | [[confirm0507-1]]에서 YES 승인됨. Phase2를 100% / 100%로 닫고, 과거 자동 복구 전송 금지를 고정 |
| minimal paid_click_intent ledger write | future approval | 24h/72h monitoring PASS 이후 검토 |
| Google Ads 전환 변경 | future Red approval | 현재 금지 유지 |
| conversion upload | future Red approval | 현재 금지 유지 |
| confirmed purchase dispatcher 운영 전송 | future Red approval | 현재 금지 유지 |
| 운영 DB/ledger write | future Red approval | 현재 금지 유지 |

## 다음에 승인 문서가 생기는 조건

다음 승인 문서가 추가로 필요한 조건은 아래 중 하나다.

1. 24h/72h monitoring이 PASS되고, `minimal paid_click_intent ledger write`를 실제로 열지 결정해야 할 때.
2. Google Ads에 실제 결제완료 주문만 구매로 알려주는 새 전환 통로를 만들지 결정해야 할 때.
3. GA4/Meta/Google Ads/TikTok/Naver 중 하나로 실제 전환 이벤트를 보내야 할 때.
4. 운영 DB 또는 Attribution VM ledger에 write가 필요한 때.

최근 닫힌 [[confirm0507-1]]은 위 Red approval이 아니라 Coffee 문서 종결 결정이었다.

## 운영 원칙

- 승인 문서는 `confirmMMDD-N.md` 형식으로 만든다.
- 같은 날짜 첫 번째 승인 문서는 `confirm0507-1.md`다.
- approval 문서는 `무엇을 승인하는지`, `왜 필요한지`, `어느 화면/명령/API가 바뀌는지`, `성공 기준`, `실패 시 롤백`, `Codex가 대신 못 하는 이유`를 포함해야 한다.
