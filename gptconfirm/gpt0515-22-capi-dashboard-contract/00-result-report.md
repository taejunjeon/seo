# gpt0515-22 CAPI Dashboard Data Contract Patch

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
  required_context_docs:
    - gptconfirm/gpt0515-21-meta-capi-roas-reconciliation/00-result-report.md
  lane: Green local code patch + read-only VM Cloud audit. VM Cloud deploy/restart is Yellow and not executed.
  allowed_actions:
    - local backend code patch
    - local fixture test
    - backend typecheck
    - VM Cloud read-only CAPI log and SQLite aggregate
    - gptconfirm package creation
  forbidden_actions:
    - Meta operating Purchase send or backfill
    - Google/GA4/TikTok/Naver send/upload
    - VM Cloud deploy/restart
    - operational DB write/import
    - GTM publish
    - raw identifier report/chat/telegram/git output
  source_window_freshness_confidence:
    capi_last_24h:
      source: VM Cloud meta-capi-sends.jsonl + VM Cloud attribution_ledger
      site: biocom
      pixel_id: "1283400029487161"
      as_of_kst: "2026-05-15 17:49"
      confidence: high for send success; medium for channel-origin inference
```

## 이번에 가능해진 것

/total과 funnel-health가 바이오컴과 더클린커피의 Meta CAPI Purchase를 섞어 보여주지 않도록 contract를 고쳤다. 이제 `site=biocom`은 바이오컴 Pixel `1283400029487161`만, `site=thecleancoffee`는 더클린커피 Pixel `1186437633687388`만 집계한다. 전체 합산은 `site=all_sites` 모드에서만 허용한다.

## 24시간 CAPI 52건 중 Meta 아닌 유입 가능성

최근 24시간 바이오컴 Pixel CAPI Purchase 52건은 전송 자체는 52/52 성공이다. 다만 “Meta 광고 유입이라고 볼 강한 증거”는 19건(36.5%)이고, 나머지 33건(63.5%)은 Meta 유입이라고 단정할 수 없거나 다른 유입 증거가 있다.

주의: 63.5%는 “확정 비Meta”가 아니라 “Meta 광고 증거가 약함/없음”이다. fbp는 52건 모두 있으나 fbp는 Meta 픽셀 사용자 쿠키라서 Meta 광고 유입 증거로 단독 사용하면 안 된다. 강한 증거는 fbc/fbclid/Meta UTM/source다.

세부 집계:
- strong Meta evidence: 19건 / 36.5%
- non-Meta or unproven Meta: 33건 / 63.5%
- known non-Meta evidence: 16건 / 30.8%
- Google evidence: 5건
- Naver evidence: 4건
- other UTM no Meta: 7건
- no ledger match: 0건
- fbp present: 52건
- fbc present: 19건
- fbclid present: 16건
- gclid present: 5건

## CAPI 숫자 수정 전/후

기존 문제는 `/total`의 CAPI success 651이 바이오컴 353 + 더클린커피 298을 합친 all-pixel 값이었다는 점이다. 패치 후 바이오컴 7일 CAPI success는 바이오컴 Pixel 기준 약 353으로 표시되어야 한다.

## missing queue

요청 기준에는 confirmed-but-CAPI-missing queue가 12건으로 기록돼 있었지만, 최신 read-only 재조회 기준으로는 15건 / 2,754,484원이다.

분류:
- `backfill_ready`: 7건 / 1,159,999원
- `legacy_missing_payment_key`: 8건 / 1,594,485원
- `no_send_guard`: 0건
- `duplicate_or_already_sent`: 0건
- `needs_toss_or_imweb_confirm`: 0건

이번 sprint에서는 분류만 했고 Meta 전송은 하지 않았다.

## 변경 파일

- `backend/src/funnelHealth.ts`
- `backend/tests/funnel-health.test.ts`

## 검증

- backend typecheck: PASS
- focused fixture: PASS (`npx tsx --test tests/funnel-health.test.ts`)
- external send/upload: 0
- 운영DB write/import: 0
- VM Cloud deploy/restart: 0
- raw identifier report output: 0

## 결론

Server CAPI는 살아 있지만, 최근 24시간 CAPI 52건 중 약 63.5%는 Meta 광고 유입이라고 단정하면 안 된다. 프론트는 “CAPI 성공”과 “Meta 광고 귀속 품질”을 분리해서 보여줘야 한다.
