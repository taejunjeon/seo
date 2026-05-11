# googleAdsClickViewExactLookup helper (gpt0508-39 작업3)

작성 시각: 2026-05-11 10:52:00 KST
실행 상태: helper + fixture **5/5 PASS**
자신감: 90% (gpt0508-38 canary 2 row 입력 0이라 live 매칭 결과는 다음 canary 대기)

## 한 줄 결론

R2 ledger의 `click_id_hash`를 Google Ads click_view 후보 또는 paid_click_intent_log의 raw click_id와 transient HMAC 비교로 매칭하는 helper 추가. **raw gclid/gbraid/wbraid 응답 절대 노출 0**. gpt0508-38 canary 2 row가 click_id_hash 부재라 live 매칭은 다음 canary가 click_id_hash 보유 row를 누적할 때 측정.

## 1. helper signature

```ts
lookupGoogleAdsClickViewExact({
  ledgerClickHashes: ReadonlyArray<string>,
  hmacSecret: string,
  clickViewCandidates?: ReadonlyArray<{rawClickId, clickIdType, campaignId, campaignName, clickTimeIso}>,
  paidClickIntentCandidates?: ...,
}): Promise<{
  ok, total_ledger_hashes, candidates_scanned, matches, source_blocked,
  rows: Array<{
    ledger_click_id_hash, click_view_exact_match, campaign_id, campaign_name_safe,
    click_id_type, match_source, reason,
  }>,
  warnings,
}>
```

## 2. fixture 5/5 PASS

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | ledger click_hash matches gclid → campaign_id exact | PASS |
| 2 | ledger click_hash matches gbraid → campaign_id exact | PASS |
| 3 | ledger click_hash no match → `click_view_not_found` | PASS |
| 4 | no candidates injected → `source_blocked` all | PASS |
| 5 | raw gclid/gbraid 응답 노출 0 | PASS |

## 3. 동작 절차

1. caller가 Google Ads click_view API 호출 또는 paid_click_intent_log read-only 조회로 raw click_id 후보 fetch (transient)
2. helper 내부에서 transient `sha256(rawClickId)` (orderBridgeIdentityHmac.ts와 일치 방식)
3. ledger click_id_hash와 동일 hash 가진 row만 매칭
4. 응답에 campaign_id / click_id_type / match_source만 — raw click_id는 함수 종료 후 폐기

## 4. live dry-run (gpt0508-38 canary 2 row)

| 지표 | 값 |
|---|---|
| 입력 ledger_click_hashes | 0 (둘 다 click_id_hash 부재) |
| 자동 동작 | ledgerClickHashes empty → 빈 row + warnings 반환 |
| 추가 매칭 대기 | 다음 canary (gclid 보유 결제 누적 후) |

## 5. match_source 정의

| source | 의미 |
|---|---|
| `google_ads_click_view` | Google Ads click_view API 후보에서 매칭 |
| `paid_click_intent_hash` | paid_click_intent_log 후보에서 매칭 |
| `fallback_blocked` | 후보 inject 0 또는 매칭 실패 |

## 6. 검증

| 항목 | 결과 |
|---|---|
| typecheck | PASS |
| fixture | PASS 5/5 |
| raw click_id 응답 노출 | 0 |
| Google Ads API write | 0 |

## 7. 다음 액션

### Claude Code가 할 일

1. (다음 sprint) caller 자동화 — Google Ads click_view 30d 데이터에서 raw click_id 후보를 read-only로 가져오는 helper 추가
2. (다음 sprint) 또는 paid_click_intent_log read-only 조회로 raw click_id 후보 inject

### TJ님이 할 일

본 helper에 추가 액션 없음.

## 8. Verdict

`HELPER_PASS_FIXTURE_PASS_WAIT_FOR_CLICK_HASH_NEXT_CANARY`

산출 JSON: `data/google-ads-click-view-exact-lookup-helper-20260511.json`
