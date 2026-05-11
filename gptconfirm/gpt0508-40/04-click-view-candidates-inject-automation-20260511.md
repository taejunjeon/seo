# click_view candidates inject 자동화 (gpt0508-40 작업4)

작성 시각: 2026-05-11 13:05:00 KST
실행 상태: helper + fixture **6/6 PASS** (212ms)
자신감: 88%

## 5줄 결론

1. R2 ledger row sessionKey + 시간 윈도우 기준으로 로컬 SQLite `paid_click_intent_ledger` 에서 두 가지 candidate 객체 (`PaidClickIntentCandidate`, `GoogleAdsClickViewCandidate`) 를 자동 생성하는 read-only injector `injectClickViewCandidatesFromPaidIntent` 신설.
2. fixture 6/6 PASS — ga_session_id 매칭 / client_id fallback / empty click_id 제외 / default 1h 윈도우 / explicit 6h 윈도우 / sessionKeys 비어있을 때 warning.
3. **operational DB read 0, external API call 0** — 본 injector 는 로컬 SQLite 만 SELECT.
4. limit default 500 / max 2000 으로 후보 폭주 방지.
5. Google Ads click_view 30d snapshot 은 다음 sprint 확장 — BQ/Ads Query 결과 prep table 추가 후 본 injector 가 union 으로 SELECT 하도록.

## 1. helper signature

```ts
injectClickViewCandidatesFromPaidIntent({
  site,
  sessionKeys: [{ ga_session_id?, client_id?, local_session_id_hash? }],
  window?: { minCapturedAtIso, maxCapturedAtIso },  // default 직전 1시간
  limit?,  // default 500, max 2000
}) → {
  total_rows_scanned,
  paid_click_intent_candidates: PaidClickIntentCandidate[],   // bridge helper 입력
  click_view_candidates: GoogleAdsClickViewCandidate[],       // click_view exact lookup 입력
  warnings,
}
```

## 2. fixture 6/6 PASS

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | ga_session_id `sess-111` (1h window) → `intent-A` gclid match + click_view 후보 1건 | PASS |
| 2 | client_id `cli-bb` fallback → `intent-B` gbraid match | PASS |
| 3 | click_id_value 빈 `intent-EMPTY` 제외 | PASS |
| 4 | default 1h 윈도우가 3시간 전 `intent-OLD` 제외 | PASS |
| 5 | explicit 6h 윈도우가 `intent-OLD` 포함 | PASS |
| 6 | sessionKeys 빈 배열 → 0 candidate + warning | PASS |

## 3. 설계 결정

- match key 우선순위: `ga_session_id IN (…) OR client_id IN (…)`
- click_id_type 가 `gclid`/`gbraid`/`wbraid` 인 row 만 click_view_candidate 로 변환 (ttclid/nclick_id 는 별도 routing)
- campaignId 자리는 paid_click_intent_ledger 에 없어 null. campaignName 자리에 utm_campaign 을 보조 정보로 추가
- raw click_id_value 는 candidate 안에 transient 로 forward. caller 가 forward 시 sha256Hex 변환 책임
- limit default 500 / max 2000

## 4. invariants

| invariant | 결과 |
|---|---|
| send_candidate / actual_send_candidate / upload_candidate | false / false / 0 |
| operational DB write / read | 0 / 0 |
| external API call | 0 |
| raw_pii_logged_in_output | false |
| data_scope | 로컬 SQLite `paid_click_intent_ledger` only |

## 5. 다음 sprint 확장 후보

- Google Ads click_view 30d snapshot 을 BQ / Ads Query 로 prep table 에 저장 → injector 가 union SELECT
- `wbraid` 는 이미 enable. `ttclid` 는 별도 TikTok lookup 모듈로 분기 예정
- paid_click_intent_ledger 에도 `local_session_id_hash` 컬럼 추가 시 R2 ledger row 의 local_session_id_hash 비교 match 도 추가

## 6. 다음 액션

### Claude Code가 할 일

1. 작업 5: builder dry-run v2 — injector + bridge + enricher 를 묶어 R2 ledger 11 row 분포 측정.
2. 작업 6 peak canary 직전: injector 호출 결과를 enricher.deps.clickViewCandidates 로 forward 하는 route 통합 dry-run 추가.

### TJ님이 할 일

작업 6 peak canary 시점에 본인 Google 광고 1~2 클릭 → checkout 시도 (취소 OK) 로 paid_click_intent_ledger 가 새 row 를 잡으면 injector live 효과 측정.

## 7. Verdict

`INJECTOR_PASS_FIXTURE_PASS_LIVE_NEEDS_PAID_INTENT_ROWS`

산출 JSON: `data/click-view-candidates-inject-automation-20260511.json`
