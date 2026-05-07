# TJ 승인 큐

작성 시각: 2026-05-07 12:42 KST
최신 업데이트: 2026-05-07 14:58 KST
상태: active
Owner: total / approval
Next document: none
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
  lane: Green 승인 큐 정리
  allowed_actions:
    - 현재 승인 필요 여부 정리
    - future approval 후보 기록
  forbidden_actions:
    - 승인 전 운영 DB/ledger write
    - 승인 전 GTM publish
    - 승인 전 platform send
  source_window_freshness_confidence:
    source: "total/!total-current.md + data/!coffeedata.md + coffee closure docs"
    window: "2026-05-07 KST"
    freshness: "Mode B 실행 완료, 24h/72h monitoring 대기 + Coffee NPay closure decision approved"
    confidence: 0.9
```

## 10초 결론

현재 TJ님이 **지금 확인할 open approval은 없다**.

[[confirm0507-1]]은 승인 완료됐다. 더클린커피 NPay 과거 매칭 Sprint는 “자동 복구 전송 없이 종결하고 future intent/A-6로 넘김”으로 닫는다.

## 현재 승인 상태

| 항목 | 상태 | 해석 |
|---|---|---|
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
