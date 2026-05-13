# Google Ads · GTM Preview verification (backend code audit 대체 · 2026-05-14)

## 목적

TJ 승인 범위에 따라 **Y-5 GTM Preview only — Production publish 금지**. GTM Preview 는 TJ UI 작업이라 Codex 직접 수행 불가. 대신 backend snippet 정독으로 capture timing / allowlist / field mapping 점검.

## 첫 줄 결론

backend snippet code 에서 **2개 핵심 결함** 발견. RC-2 (landing gclid 0) / RC-3 (checkout→payment retention 4.3%) / RC-6 (gbraid/wbraid 거의 0) 모두 동일 mechanism 으로 설명됨. 진짜 fix 는 Y-3 server gclid echo + Y-4 snippet patch + R-1 GTM publish (TJ 승인 후).

## 5개 root cause 분류 (Preview 검증 대상 vs backend 검증 대상)

| Cause | 검증 방법 | 결과 |
|---|---|---|
| A. query param read timing 문제 | GTM Preview 필요 (TJ UI) | TJ 추가 점검 필요 |
| B. **allowlist 누락 (gbraid/wbraid)** | backend code audit ✅ | **F1 확정 — snippet 코드에 gbraid/wbraid 자체 없음** |
| C. redirect 에서 query strip | GTM Preview + 결제 URL 흐름 (TJ UI) | TJ 추가 점검 필요 |
| D. trigger firing location 문제 | GTM Preview (TJ UI) | TJ 추가 점검 필요 |
| E. **receiver field mapping 문제** | backend code audit ✅ | **F2 확정 — payment_success gclid source 가 lastTouch+URL 만** |

## 핵심 발견

### F1 — imwebAttributionSnippet 에 gbraid/wbraid 완전 누락

**file**: `backend/src/imwebAttributionSnippet.ts`
**evidence**: `grep -c "gbraid" imwebAttributionSnippet.ts → 0`. snippet 안에 `gclid` 만 capture, `fbclid` 와 `ttclid` 까지는 있으나 `gbraid` 와 `wbraid` 변수 자체 없음.

```js
// 현재 코드 (line 283 부근)
gclid: firstNonEmpty([trim(lastTouch.gclid), getSearchParam(['gclid'])]),
fbclid: firstNonEmpty([trim(lastTouch.fbclid), getSearchParam(['fbclid'])]),
ttclid: firstNonEmpty([trim(lastTouch.ttclid), getSearchParam(['ttclid'])]),
// gbraid 없음
// wbraid 없음
```

**함의**: iOS App campaign / cookieless restricted 광고에서 들어오는 `gbraid` / `wbraid` query param 은 어느 단계에서도 attribution_ledger 에 fill 안 됨. RC-6 (gbraid/wbraid 거의 0) 의 원인 확정.

**recommended fix (Y-4 일부)**:
```js
gbraid: firstNonEmpty([trim(lastTouch.gbraid), getSearchParam(['gbraid'])]),
wbraid: firstNonEmpty([trim(lastTouch.wbraid), getSearchParam(['wbraid'])]),
```

또한 attribution_ledger schema 에 `gbraid TEXT, wbraid TEXT` 컬럼 추가 필요 (현재는 gclid 컬럼만, 데이터 모델 단계 부재).

### F2 — payment_success 시점 gclid source 가 lastTouch + URL query 만

**file**: `backend/src/imwebAttributionSnippet.ts` line 283
**evidence**:
```js
gclid: firstNonEmpty([
  trim(lastTouch.gclid),      // localStorage `_p1s1a_last_touch`
  getSearchParam(['gclid'])   // 현재 페이지 URL query
])
```

**함의**: 다음 두 경우 0 fill:
1. localStorage `_p1s1a_last_touch` 이 비어있거나 expired (e.g. NPay redirect 시 sessionStorage 손실 + localStorage 자체 timeout)
2. 결제 success URL 에 gclid query param 첨부 안 됨 (Imweb / NPay 결제완료 URL 은 통상 query param 안 첨부)

NPay 결제 flow:
- 사용자 광고 클릭 → biocom.kr landing (gclid query 받음, localStorage 저장)
- 상품 선택 → NPay button 클릭 → **외부 NPay 결제창 (pay.naver.com) 으로 redirect**
- NPay 결제완료 → biocom.kr 로 return (paymentKey + orderId 만 query param)
- biocom.kr 결제완료 페이지 → snippet fire → lastTouch.gclid 읽기 시도

이 흐름에서 lastTouch.gclid 가 살아있으려면:
- localStorage 가 30분 이상 보존되어야 함
- NPay return URL 이 동일 origin (biocom.kr) 이어야 함 (sessionStorage 가 살아남음)
- redirect 횟수가 너무 많지 않아야 함

실제로 retention 4.3% 라는 건 위 조건이 95.7% 의 경우에서 깨진다는 뜻.

**recommended fix (Y-3 server gclid echo + Y-4 NPay return URL)**:
1. **Y-3**: server route 에서 client_id + ga_session_id 매칭으로 npay_intent_log.gclid (capture 87%) 를 payment_success 시점에 attribution_ledger 에 fill
2. **Y-4**: NPay return URL 생성 시 gclid query param 재첨부. 또는 결제 시작 시 NPay 결제창 URL 에 gclid 포함시켜 NPay 가 그대로 return URL 에 echo

### F3 — siteLandingChannelClassifier 는 gbraid/wbraid 분류 가능하나 source 비어있음

**file**: `backend/src/siteLandingChannelClassifier.ts` line 175

```ts
if (clickIdType === "gclid" || clickIdType === "gbraid" || clickIdType === "wbraid") {
  return "paid_search";  // 분류 가능
}
```

**함의**: 분류 코드는 정상이지만 입력 데이터 (clickIdType) 가 attribution_ledger 또는 npay_intent_log 에 fill 안 됨 (F1 결과). 데이터 모델 단계 컬럼 부재.

## TJ UI Preview 직접 점검 필요 항목

backend audit 으로 검증 불가한 5개 항목 — TJ Chrome 확장 GTM Preview 모드에서 직접 확인 필요:

| # | 점검 항목 | 방법 | 기대값 |
|---|---|---|---|
| 1 | landing 시점 dataLayer 에 gclid/gbraid/wbraid 들어오는가 | GTM Preview Console → dataLayer push 확인 | 광고 클릭 후 첫 page load 시 push 됨 |
| 2 | marketing_intent trigger 가 query param read 전에 fire 되는가 | GTM Preview → tag fire order 확인 | query param read 후 fire |
| 3 | receiver tag 의 query allowlist 에 gbraid/wbraid 포함되는가 | GTM Preview → tag config 확인 | gclid + gbraid + wbraid + fbclid + ttclid 모두 포함 |
| 4 | redirect / hash 변경에서 query strip 되는가 | GTM Preview → 광고 클릭부터 landing 까지 URL trace | gclid 가 유지되어야 함 |
| 5 | NPay 결제 return URL 에 gclid 재첨부되는가 | NPay 결제 flow 직접 시뮬레이션 | gclid 가 return URL query 에 있음 (현재는 없을 가능성) |

## R-1 GTM Production publish 필요 여부 제안

**필요함** — 사유:

1. F1 (gbraid/wbraid 누락) 해결 시 GTM tag 의 query allowlist 도 같이 수정 필요
2. F2 (payment_success gclid source) 의 server echo 가 작동하려면 GTM 의 page event marketing_intent fire 시 client_id 와 ga_session_id 가 정확히 push 되어야 함
3. TJ Preview 점검 결과에 따라 R-1 publish 범위 (10% → 50% → 100%) 결정

본 sprint 에서 publish 실행 **금지**. R-1 별도 Red Lane sprint 로 분리.

## invariants held

| invariant | value |
|---|---|
| gtm_preview_mode | accessed=0 (Codex UI 접근 불가) |
| gtm_production_publish | 0 |
| backend_deploy / backend_restart | 0 / 0 |
| snippet_patch_deploy | 0 |
| external_send_count | 0 |
| raw_identifier_leak | false |

## 다음 액션 (Codex / TJ 분리)

| Owner | Action |
|---|---|
| **TJ** | 위 5개 Preview 점검 (GTM Preview 모드 + 광고 URL 클릭 시뮬레이션) |
| **TJ** | Y-3/Y-4 snippet 패치 승인 여부 결정 |
| **TJ** | R-1 GTM Production publish 별도 sprint 승인 여부 |
| **Codex** | Y-3/Y-4 승인 시 design + smoke test (실행은 Red 승인 후) |
