# Biocom Meta Purchase test-only smoke result - 2026-05-15

작성 시각: 2026-05-15 00:32 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docs/report/text-report-template.md
  project_harness_read:
    - capivm/biocom-purchase-test-only-smoke-approval-20260515.md
    - gdn/biocom-purchase-only-drop-and-backfill-reconciliation-20260514.md
  lane: Approved controlled Meta Test Events send, no operational Purchase send
  allowed_actions:
    - Meta CAPI Purchase test event max 1 with test_event_code
    - Meta pixel stats read-only pre/post check
    - result documentation
  forbidden_actions:
    - Meta Purchase send without test_event_code
    - browser Purchase fire without test-only guarantee
    - campaign/ad set/budget mutate
    - Google Ads/GA4/TikTok/Naver send or upload
    - 운영DB write/import
    - VM Cloud schema migration
    - GTM publish
    - Imweb header/footer save
    - raw order/payment/click/member/email/phone output
  source_window_freshness_confidence:
    source: "Meta Graph CAPI response + Meta pixel stats read-only snapshot"
    window: "2026-05-15 00:22:35 KST server test-only send"
    freshness: "2026-05-15 00:32 KST"
    confidence: 0.84
```

## 10초 요약

Meta가 바이오컴 구매 테스트 신호를 받을 수 있는지 운영 구매 수를 늘리지 않고 확인했다.

서버에서 `Purchase` 테스트 이벤트 1건만 보냈고, Meta 응답은 HTTP 200 / `events_received=1`이었다. 즉시 사전/사후 비교에서 운영 `Purchase` 수 증가는 0이었다. 브라우저 `Purchase`는 test-only 보장이 아직 없어서 실행하지 않았다.

## 결과

- 판정: `SERVER_ONLY_TEST_PASS`
- 대상: 바이오컴 Pixel/Dataset `1283400029487161`
- 테스트 코드: 문서에는 원문 저장 안 함. `TEST*****`로만 기록.
- 전송량: server CAPI test `Purchase` 1건.
- Meta 응답: HTTP 200, `events_received=1`, error/message 0.
- 운영 구매 수 즉시 증가: 0.
- 실제 주문/결제 사용: 0.
- browser/server dedup smoke: 보류. 브라우저 `Purchase`가 test-only로 분리된다는 보장이 아직 없다.

## 왜 중요한가

이번 확인으로 서버 CAPI 경로 자체가 막힌 것은 아니라는 점이 더 강해졌다. 문제는 운영 구매 집계와 브라우저 구매 이벤트, 그리고 VM Cloud confirmed bridge의 연결 품질로 좁혀진다.

따라서 아임웹 footer에 Pixel `Purchase`를 바로 추가하는 것은 여전히 금지다. FBE/browser Pixel과 직접 삽입 Pixel이 중복되면 Meta 구매 수가 두 번 잡힐 수 있다.

## 금지선 준수

- 운영 Meta `Purchase` send: 0
- 승인된 Meta Test Events send: 1
- Google Ads/GA4/TikTok/Naver send/upload: 0
- campaign/ad set/budget 변경: 0
- 운영DB write/import: 0
- VM Cloud schema migration: 0
- GTM publish: 0
- Imweb header/footer 저장: 0
- raw order/payment/click/member/email/phone 출력: 0

## 다음 판단

1. 브라우저 `Purchase` dedup smoke는 test-only 브라우저 발화 경로가 확보될 때만 진행한다.
2. 전체 Pixel 직접 삽입은 중복 위험 때문에 진행하지 않는다.
3. Meta 구매 누락을 줄이는 실무 우선순위는 VM Cloud pending row를 결제완료 정본과 안전하게 연결하는 bridge 보강이다.
