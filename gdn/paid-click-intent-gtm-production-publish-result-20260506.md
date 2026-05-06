# paid_click_intent v1 GTM Production publish 결과

작성 시각: 2026-05-07 00:05 KST
대상: biocom GTM `GTM-W2Z6PHN`
문서 성격: Red Mode B GTM Production publish 결과 문서
Status: published / live smoke passed / 24h monitoring pending
Supersedes: [[paid-click-intent-gtm-production-publish-approval-20260506]]
Depends on:
- [[paid-click-intent-production-receiver-deploy-result-20260506]]
- [[../capivm/vm-ssh-access-recovery-runbook-20260506]]
Do not use for: Google Ads conversion action 생성/변경, conversion upload, GA4/Meta/Google Ads purchase 전송, 운영 DB/ledger write

## 10초 결론

`paid_click_intent v1` receiver-enabled GTM Production publish를 완료했다. 새 live version은 `142 (paid_click_intent_v1_receiver_20260506T150218Z)`다.

운영 페이지 smoke에서 TEST gclid가 browser storage에 저장됐고, `att.ainativeos.net` no-write receiver가 200으로 응답했다. 응답은 `would_store=false`, `would_send=false`, `no_platform_send_verified=true`, `live_candidate_after_approval=false`를 유지했다.

이 publish는 Google Ads 구매 전환을 보낸 것이 아니다. 목적은 Google click id 보존 payload가 실제 브라우저에서 안전하게 들어오는지 확인하는 것이다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase4 | [[#Phase4-Sprint6]] | paid_click_intent GTM 운영 게시 | Codex | 100% / 80% | [[#Phase4-Sprint6\|이동]] |

## 다음 할일

| 순서 | Phase/Sprint | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 상세 | 컨펌 필요 |
|---:|---|---|---|---|---|---|---|---|
| 1 | [[#Phase4-Sprint6]] | 진행 중 | Codex | 24h/72h 모니터링을 한다 | publish 직후 smoke는 통과했지만 실제 고객 트래픽에서 오류율과 receiver 2xx를 봐야 한다 | GTM live version, receiver 2xx/4xx/5xx, JS error, 외부 전송 0건, 결제 흐름 이상 여부를 확인한다 | [[#Phase4-Sprint6]] | NO, read-only |
| 2 | [[#Phase4-Sprint6]] | 모니터링 후 | Codex | minimal paid_click_intent ledger write 승인안을 작성할지 판단한다 | no-write receiver는 payload 검증일 뿐 주문 원장 fill-rate를 직접 개선하지 않는다 | 24h/72h 결과가 안정적이면 저장 필드와 보관기간을 제한한 승인안을 작성한다 | [[#Phase4-Sprint6]] | YES, 운영 write |

## publish 결과

| 항목 | 값 |
|---|---|
| 이전 live version | `141 (pause_aw308433248_upde_20260505)` |
| 새 live version | `142 (paid_click_intent_v1_receiver_20260506T150218Z)` |
| workspace | `159 (codex_paid_click_intent_prod_20260506T150218Z)` |
| tag | `[279] codex_paid_click_intent_v1_receiver_no_send` |
| trigger | `[278] codex_paid_click_intent_v1_all_pages_guarded` |
| receiver URL | `https://att.ainativeos.net/api/attribution/paid-click-intent/no-send` |
| compiler error | false |
| live version match | true |
| result JSON | `data/paid-click-intent-gtm-production-publish-20260506T150218Z.json` |

## tag 동작 범위

이 tag는 All Pages trigger로 실행된다. 하지만 모든 페이지에서 무조건 receiver POST를 보내는 구조는 아니다.

조건:

- `gclid`, `gbraid`, `wbraid` 중 하나가 있으면 browser storage에 저장한다.
- Google UTM만 있는 경우도 storage 후보로 보관한다.
- receiver POST는 Google click id가 있을 때만 보낸다.
- 같은 stage/session/click id 조합은 sessionStorage 기준 dedupe한다.
- admin, login, logout, internal, API 계열 path는 client-side에서 skip한다.
- receiver에서도 PII, value, order/payment, oversized, internal path를 다시 차단한다.

## live smoke

테스트 URL:

```text
https://biocom.kr/?gclid=TEST_GCLID_LIVE_20260506&utm_source=google&utm_medium=cpc&utm_campaign=codex_live_smoke_20260506
```

브라우저 확인 결과:

```text
GTM loaded: true
installed: paid_click_intent_v1_20260506
localStorage bi_paid_click_intent_v1 contains TEST_GCLID_LIVE_20260506
sessionStorage bi_paid_click_intent_v1 contains TEST_GCLID_LIVE_20260506
receiver status: 200
```

receiver 응답:

```text
ok=true
would_store=false
would_send=false
no_write_verified=true
no_platform_send_verified=true
has_google_click_id=true
test_click_id=true
live_candidate_after_approval=false
block_reasons=read_only_phase, approval_required, test_click_id_rejected_for_live
```

관측된 network failure:

- Google Ads/Google consent 관련 `set_partitioned_cookie`, `ccm/collect` 요청 일부가 Playwright에서 `net::ERR_ABORTED`로 보였다.
- 이 요청은 기존 Google tag 동작에서 발생한 것으로, 새 receiver route 실패는 아니다.
- 새 receiver request는 200으로 성공했다.

## 변경하지 않은 것

- Google Ads conversion action을 만들거나 바꾸지 않았다.
- conversion upload를 하지 않았다.
- GA4/Meta/Google Ads/TikTok/Naver purchase 전송을 하지 않았다.
- confirmed purchase dispatcher 운영 전송을 하지 않았다.
- 운영 DB/ledger write를 하지 않았다.
- 광고 예산이나 캠페인 상태를 바꾸지 않았다.

## 롤백 기준

아래 중 하나라도 보이면 rollback 후보다.

- 결제 버튼, NPay 버튼, 장바구니, 결제완료 페이지 동작 이상.
- 새 JS error 급증.
- receiver가 아닌 외부 플랫폼 전송 발생.
- PII/value/order/payment field가 payload에 포함됨.
- `TEST_`, `DEBUG_`, `PREVIEW_` click id가 live candidate로 통과함.
- Google Ads/GA4/Meta 전환 수가 publish 직후 비정상 증가.

롤백 방법:

1. tag `[279] codex_paid_click_intent_v1_receiver_no_send` pause 후 publish.
2. 직전 GTM live version `141 (pause_aw308433248_upde_20260505)`로 rollback.
3. receiver endpoint 차단. 단, storage만 남는 경우에는 tag pause가 우선이다.

## 현재 영향

이제 실제 고객 트래픽에서 Google click id가 browser storage와 no-write receiver까지 들어오는지 볼 수 있다. 하지만 no-write 단계이므로 주문 원장이나 Attribution VM fill-rate가 자동으로 개선되지는 않는다.

다음 판단은 24h/72h 모니터링 결과를 기준으로 한다.

#### Phase4-Sprint6

**이름**: paid_click_intent GTM 운영 게시

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 Google click id 보존 tag를 운영에 올리고, 실제 브라우저에서 no-write receiver까지 안전하게 도달하는지 확인하는 것이다.

완료한 것:

- GTM live version `141` 확인.
- 중복 tag 0개 확인.
- fresh workspace `159` 생성.
- tag `[279]`, trigger `[278]` 생성.
- version `142` 생성 및 publish.
- live smoke 통과.

남은 것:

- 24h/72h 모니터링.
- 안정적이면 minimal ledger write 승인안 작성.
