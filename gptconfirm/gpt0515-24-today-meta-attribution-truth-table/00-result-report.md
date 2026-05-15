---
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
  required_context_docs:
    - gptconfirm/gpt0515-23-funnel-health-vm-deploy/00-result-report.md
  lane: Green
  allowed_actions:
    - VM Cloud read-only query
    - Meta Ads Insights read-only API query
    - frontend/backend source read-only check
    - gptconfirm report package
  forbidden_actions:
    - Meta send/backfill
    - VM deploy/restart
    - 운영DB write/import
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    site: biocom
    pixel_id: "1283400029487161"
    window: "2026-05-15 00:00-23:24 KST"
    freshness: "fresh, queried 2026-05-15 23:16-23:24 KST"
    confidence: "high for CAPI receipt, medium for same-day Ads Manager attribution because Meta same-day lag remains possible"
---

# gpt0515-24 Today Meta Attribution Truth Table

작성 시각: 2026-05-15 23:24 KST

## 10초 요약

오늘 Meta 머신러닝 신호는 완전히 끊긴 상태가 아니다. VM Cloud 기준 바이오컴 실제 결제완료 61건 중 56건이 Server CAPI Purchase로 Meta에 전송됐고, 56건 모두 `events_received=1`이다.

다만 Meta Ads Manager의 today 구매 귀속은 아직 0건이다. 이 화면의 0건은 “Meta가 CAPI를 못 받았다”가 아니라 “광고 플랫폼이 오늘 전환으로 아직 귀속 표시하지 않았다”에 가깝다.

Claude frontend에서 보이는 today ROAS 1.97x/13건 계열 카드는 Ads Manager 구매가 아니라 VM Cloud 내부 귀속 주문과 Meta spend를 섞은 내부 ROAS이다. 현재 live API 재조회값은 2.08x / 19건이다.

## 판정

- `A. TODAY_CAPI_HEALTHY_ADS_LAG`: 현재 우선 판정.
- `D. FRONTEND_ROAS_SOURCE_MISLABELED`: 확인됨. frontend label은 Ads Manager처럼 보이지만 실제 호출은 `/api/ads/roas` 내부 귀속 ROAS이다.
- `E. INSUFFICIENT_WAIT_12H_RECHECK`: 유지. 2026-05-16 오전에 today/yesterday 재조회가 필요하다.
- `B. TODAY_CAPI_HEALTHY_ADS_ATTRIBUTION_BROKEN`: 아직 확정하지 않는다. 12-24시간 뒤에도 2026-05-15 귀속 구매가 0이면 이 판정으로 올린다.

## 핵심 숫자

| 항목 | 오늘 결과 | source | 의미 |
|---|---:|---|---|
| 실제 결제완료 | 61건 / 17,494,197원 | VM Cloud SQLite `attribution_ledger` | 오늘 결제완료로 닫힌 주문 |
| Meta 강한 증거 결제완료 | 24건 / 9,157,467원 | VM Cloud SQLite `attribution_ledger` | fbclid/fbc 또는 Meta/Facebook/Instagram UTM/source evidence 있음 |
| Meta CAPI 전송 성공 | 56건 / 16,028,197원 | VM Cloud `meta-capi-sends.jsonl` | Meta가 서버 구매 이벤트를 받은 건 |
| Meta CAPI events_received | 56 | Meta Graph response log | 56건 모두 Meta 응답에서 수신 확인 |
| Ads Manager today purchase | 0건 / 0원 | Meta Ads Insights API | 광고 플랫폼이 오늘 귀속 구매로 아직 표시하지 않음 |
| Frontend today ROAS 카드 | 2.08x / 19건 | `/api/ads/roas` | Ads Manager가 아니라 내부 귀속 ROAS |

## 오늘 Meta가 아닌 다른 유입이 CAPI로 들어갔을 가능성

오늘 바이오컴 CAPI 56건 중 `strong_meta_ad_evidence`는 21건이다. 나머지 35건, 즉 62.5%는 Meta 광고 유입이라고 단정할 증거가 없다.

이 말은 “잘못 보냈다”가 아니다. Server CAPI는 실제 결제완료 구매를 Pixel에 보내는 통로라서, Meta 유입이 아닌 구매도 전송될 수 있다. Meta는 이 중 fbc/fbp/fbclid/external_id 등을 보고 자기 광고 기여 여부를 판단한다.

따라서 내부 화면에서는 다음처럼 분리해야 한다.

- `CAPI received`: Meta가 받은 실제 구매 신호.
- `strong Meta evidence`: Meta 광고 유입으로 볼 수 있는 강한 후보.
- `Ads Manager attributed`: Meta가 광고 성과로 귀속 표시한 구매.

## 아직 안 된 것

- Ads Manager today 구매 0건이 단순 same-day lag인지, attribution 연결 문제인지 확정하지 않았다.
- missing queue 5건 / 1,466,000원은 전송하지 않았다.
- Meta 운영 send/backfill은 0건이다.

## 금지선 준수

- Meta send/backfill: 0
- VM deploy/restart: 0
- 운영DB write/import: 0
- GTM publish: 0
- raw identifier output: 0

## 다음 판단

2026-05-16 오전에 같은 API로 `date_preset=yesterday`를 재조회한다. 그때 2026-05-15 purchase가 계속 0이면 단순 지연보다 Ads attribution 연결 문제로 올려야 한다.
