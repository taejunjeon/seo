# KR7 Meta CAPI / GA4 / 외부 전송 준비 계획

작성 시각: 2026-05-17 00:41 KST
기준일: 2026-05-17
상태: active plan
Owner: data / tracking / attribution
연결 문서: [[../data/!channelfunnel]]
Do not use for: Meta CAPI Purchase 운영 전송, GA4 Measurement Protocol purchase 전송, Google Ads conversion upload, TikTok Events API 전송, Naver send/upload, GTM Production publish, 운영DB write/import

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!channelfunnel.md
    - plans.md.md
    - data/!data_inventory.md
  lane: Green planning / read-only / dry-run / approval packet
  allowed_actions:
    - 문서 작성과 수정
    - VM Cloud CAPI send log read-only audit
    - VM Cloud attribution_ledger read-only audit
    - 운영DB PAYMENT_COMPLETE read-only cross-check
    - payload preview / no-send dry-run
    - Events Manager UI 확인 체크리스트 작성
    - Red approval packet 작성
  forbidden_actions:
    - Meta CAPI Purchase 운영 전송
    - GA4 Measurement Protocol purchase 전송
    - Google Ads conversion upload
    - TikTok/Naver send/upload
    - GTM Production publish
    - 운영DB write/import
    - VM Cloud schema migration
    - raw order/payment/click/member/email/phone 출력
  source_window_freshness_confidence:
    source: "VM Cloud attribution_ledger + Meta CAPI send log + 운영DB PAYMENT_COMPLETE read-only cross-check"
    window: "2026-05-14 ~ 2026-05-17 KST incident/recovery window, 이후 7d/30d 확장"
    freshness: "계획 문서 작성 시점 2026-05-17 00:41 KST. 숫자는 실행 시점에 live read-only로 재계산 필요"
    confidence: 0.86
```

## 10초 요약

KR7의 목적은 **실제 구매 신호를 Meta, GA4, Google Ads 같은 외부 플랫폼에 보내기 전에 오염을 막는 안전장치를 완성하는 것**이다. 지금은 Server CAPI 경로가 살아 있고 일부 운영 판단에 쓸 수 있지만, Events Manager UI 검증, Test Events smoke, 환불/취소 보정, GA4/외부 전송 준비는 아직 완전히 닫히지 않았다. 따라서 KR7은 `전송 준비`와 `실제 전송 실행`을 분리하고, Red 승인 전에는 어떤 플랫폼에도 purchase를 확장 전송하지 않는다.

## Objective

실제 결제완료 주문만 외부 플랫폼에 안전하게 알려줄 수 있도록, no-send, 중복 방지, dedup, 환불/취소 guard, Events Manager 검증, Test Events smoke, payload 최소화 기준을 완성한다.

쉽게 말하면:

> 결제완료가 아닌 주문, 중복 주문, 환불된 주문, 결제 페이지 진입 신호가 Meta/GA4/Google Ads의 구매로 들어가지 않게 막고, 실제 결제완료만 보낼 준비를 끝낸다.

## Key Results

1. **No-send guard**: `payment_page_seen`, pending, unknown, 0원, 취소/환불, value mismatch row는 purchase 전송 후보가 될 수 없다.
2. **Dedup guard**: 같은 결제/주문 safe key는 한 번만 전송 후보가 된다. duplicate event_id 추정값은 0을 유지한다.
3. **Value guard**: purchase value는 운영DB 결제완료 금액 또는 Imweb/Toss confirmed total 기준으로만 사용한다. VM line/item 값은 보조값이다.
4. **Events Manager 검증**: Meta Events Manager에서 Pixel, Dataset, event name, server/browser source, event match quality, recent activity를 확인한다.
5. **Test Events smoke**: test_event_code 기반 smoke는 운영 Purchase count를 늘리지 않고 1건 이하로만 수행한다.
6. **Refund/cancel guard**: 취소/환불 row는 purchase send 대상에서 제외하고, 환불 보정 이벤트가 필요하면 별도 Red approval로 분리한다.
7. **외부 전송 분리**: Meta CAPI, GA4 Measurement Protocol, Google Ads upload, TikTok/Naver send는 각각 별도 Red approval 없이는 실행하지 않는다.

## 현재 상태

완성도: **65%**

잘 된 것:

- Meta CAPI guard와 dedup contract 일부가 준비됐다.
- VM Cloud 기준 최근 CAPI success/failed/duplicate를 볼 수 있다.
- Coffee GA4/Meta/Google/TikTok/Naver 실제 purchase 전송은 0 유지 원칙이 정착됐다.
- Browser Purchase가 0이어도 Server CAPI가 살아 있으면 치명 장애로 보지 않는 판단 기준이 생겼다.

아직 안 된 것:

- Meta Events Manager UI 검증이 매일 같은 기준으로 닫히지 않았다.
- Test Events smoke가 정기 체크리스트로 고정되지 않았다.
- refund/cancel event 수신과 보정 정책이 닫히지 않았다.
- GA4 Measurement Protocol purchase, Google Ads confirmed_purchase, TikTok/Naver send는 준비 문서와 no-send dry-run까지만 허용된 상태다.
- 실제 purchase 전송 확대는 Red 승인 전 금지다.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#KR7-Sprint1]] | Meta CAPI 전송 후보와 누락 큐를 안전하게 분류한다 | 결제완료인데 Meta로 안 간 주문과 보내면 안 되는 주문을 구분해야 한다 | VM Cloud CAPI send log와 결제완료 원장을 safe_ref 기준으로 read-only 대조한다 | 일부 구현됨 | 75% | missing queue가 backfill_ready/no_send_guard/duplicate/value_mismatch/source_gap으로 닫힘 | Codex: 5/14~5/15 누락분 재분류 | NO, Green |
| P0 | [[#KR7-Sprint2]] | no-send/dedup/value guard를 전송 전 필수 조건으로 고정한다 | 중복 구매나 잘못된 금액이 플랫폼 ROAS를 오염시키면 안 된다 | fixture, dry-run, action queue 표시 기준을 만든다 | 진행 중 | 70% | duplicate 0, value mismatch no-send, 0원/취소/환불 no-send PASS | Codex: guard checklist와 dry-run 갱신 | NO, Green |
| P0 | [[#KR7-Sprint3]] | Meta Events Manager UI 검증 체크리스트를 만든다 | CAPI success가 Meta UI에서 어떻게 보이는지 확인해야 학습 신호 신뢰도를 판단할 수 있다 | Pixel/Dataset/event source/event match quality/recent activity 확인 절차를 정한다 | 대기 | 40% | TJ님이 같은 화면에서 5분 안에 상태를 확인할 수 있음 | Codex: 체크리스트 작성 / TJ: UI 캡처 확인 | PARTIAL, UI는 TJ |
| P1 | [[#KR7-Sprint4]] | Test Events smoke를 운영 count 증가 없이 수행할 수 있게 한다 | 실제 운영 구매 수를 늘리지 않고 browser/server 수신 가능성을 확인해야 한다 | test_event_code, 1건 이하, eventID 고정, 운영 count delta 0 조건으로 설계한다 | 설계 일부 있음 | 55% | test-only send 1건 이하, events_received=1, 운영 Purchase count 증가 0 | Codex: smoke runbook / TJ: test code 입력 필요 시 제공 | YES, Red 실행 전 |
| P1 | [[#KR7-Sprint5]] | refund/cancel guard와 보정 이벤트 정책을 닫는다 | 환불된 구매가 계속 ROAS에 남으면 예산 판단이 틀어진다 | 운영DB/Imweb/Toss cancel/refund source를 정하고 no-send 또는 보정 이벤트로 분리한다 | 미완 | 25% | 환불/취소 row는 purchase 후보 0, 보정 이벤트는 별도 승인안으로 분리 | Codex: source audit + approval packet | NO for audit, Red for send |
| P2 | [[#KR7-Sprint6]] | GA4/Google Ads/TikTok/Naver 외부 전송 준비를 각각 분리한다 | 플랫폼마다 전송 조건과 위험이 달라 한 승인으로 묶으면 안 된다 | no-send dry-run, payload preview, dedup key, rollback plan을 플랫폼별로 작성한다 | 미완 | 20% | 플랫폼별 Red approval packet이 분리됨 | Codex: approval packet 작성 | NO for docs, Red for execution |

## 다음 할일

### Auto Green

#### A1. 5/14~5/15 Meta CAPI 누락분 재분류
- 무엇을 하는가: Meta evidence가 있는데 같은 safe key로 성공한 Meta CAPI Purchase send log가 없는 row를 재분류한다.
- 왜 하는가: incident 구간에 빠진 구매 신호를 복구할지 판단해야 한다.
- 어떻게 하는가: VM Cloud attribution ledger와 Meta CAPI send log를 read-only로 대조한다. raw id는 쓰지 않고 safe_ref만 남긴다.
- 성공 기준: 각 row가 `backfill_ready`, `no_send_guard`, `duplicate_or_already_sent`, `value_mismatch`, `source_gap` 중 하나로 분류된다.
- 실패 시 확인점: CAPI log retention, safe key 생성 방식, source window 불일치.
- 담당: Codex.
- 승인 필요 여부: NO, Green.
- 추천 점수: 90%.
- 의존성: 없음.

#### A2. KR7 guard checklist를 `/conversion-funnel` action queue 기준과 맞춘다
- 무엇을 하는가: 화면의 Critical/High/Medium/Watch 분류에 KR7 guard 기준을 연결한다.
- 왜 하는가: 전송 준비 상태가 문서에만 있고 화면에 없으면 운영자가 매일 확인할 수 없다.
- 어떻게 하는가: action queue 항목을 `CAPI 누락`, `중복 위험`, `환불/취소 미반영`, `Events Manager 확인 필요`, `Test Events 미검증`으로 나눈다.
- 성공 기준: 각 항목에 source, window, freshness, confidence, recommended_fix가 붙는다.
- 실패 시 확인점: funnel-health API data contract, frontend 표시 범위.
- 담당: Codex.
- 승인 필요 여부: 표시 설계는 NO, 배포는 YES Yellow.
- 추천 점수: 85%.
- 의존성: A1 결과 일부 필요.

#### A3. refund/cancel source inventory를 만든다
- 무엇을 하는가: 환불/취소 판단에 쓸 primary/cross-check/fallback source를 정한다.
- 왜 하는가: purchase send 전에는 환불/취소 상태를 반드시 제외해야 한다.
- 어떻게 하는가: 운영DB, VM Cloud imweb_orders, Toss status, Imweb v2 API를 source priority로 정리한다.
- 성공 기준: 환불/취소 row가 purchase 후보 0으로 빠지는 dry-run 기준이 생긴다.
- 실패 시 확인점: 운영DB sync 지연, Imweb status blank, Toss status 접근권한.
- 담당: Codex.
- 승인 필요 여부: NO, Green.
- 추천 점수: 82%.
- 의존성: `data/!data_inventory.md` 최신성.

### Approval Needed

#### B1. Meta Events Manager UI 확인
- 무엇을 확인하는가: Pixel `1283400029487161`에서 Purchase, server/browser source, event match quality, recent activity, data source restriction 경고를 확인한다.
- 왜 필요한가: VM Cloud에서는 events_received=1이어도 Meta UI에서 제한/지연/필터 때문에 다르게 보일 수 있다.
- 어떻게 하는가: Meta Events Manager → 데이터 세트 → 바이오컴 Pixel → 이벤트 개요/진단/Event match quality/데이터 신선도 화면을 확인한다.
- 성공 기준: Server CAPI Purchase가 최근 수신되고, duplicate나 blocked warning이 Critical로 뜨지 않는다.
- 실패 시 다음 확인점: data source restriction, event source mismatch, purchase action key mismatch, same-day lag.
- 담당: TJ님. Codex가 대신 못 하는 이유: Meta UI 로그인/권한/2FA가 필요하다.
- 승인 필요 여부: UI 확인만이라 승인 아님.
- 추천 점수: 78%.
- 의존성: 없음.

#### B2. Test Events smoke 실행 승인
- 무엇을 승인하는가: 운영 구매 수를 늘리지 않는 test_event_code 기반 Meta CAPI/browser smoke 1건 이하.
- 왜 필요한가: 실제 운영 구매를 만들지 않고 수신 경로가 살아 있는지 확인하기 위해서다.
- 어떻게 하는가: test_event_code를 사용하고, eventID를 고정하고, 운영 Purchase count delta 0을 pre/post로 확인한다.
- 성공 기준: Test Events에서 이벤트가 보이고, 운영 이벤트 수는 늘지 않는다.
- 실패 시 다음 확인점: test_event_code 누락, wrong Pixel/Dataset, browser blocker, CORS.
- 담당: Codex + TJ님. TJ님은 test_event_code 제공 또는 UI 확인만 필요할 수 있다.
- 승인 필요 여부: YES, Red에 준하는 제한 smoke 승인.
- 추천 점수: 68%.
- 의존성: A2 guard checklist.

### Blocked/Parked

#### C1. 실제 purchase 전송 확대는 Red 승인 전 금지
- 무엇을 보류하는가: Meta CAPI 대량 backfill, GA4 Measurement Protocol purchase, Google Ads conversion upload, TikTok/Naver purchase send.
- 왜 보류하는가: 실제 플랫폼 전환값을 바꾸는 작업이다.
- 재개 조건: payload preview, duplicate guard, value guard, refund/cancel guard, rollback plan, post-send verification이 준비되고 TJ님이 명시 승인한다.
- 실패 시 해석: 승인 없이 실행되면 플랫폼 ROAS와 입찰 학습 신호가 오염될 수 있다.
- 담당: TJ님 승인 + Codex 실행.
- 승인 필요 여부: YES, Red.
- 추천 점수: 현재 실행은 30%, 준비 작업은 90%.
- 의존성: A1~A3, B1~B2.

## 상세 Sprint 설명

### KR7-Sprint1

**이름**: Meta CAPI 누락 큐 triage

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 결제완료인데 Meta CAPI 성공 기록이 없는 row를 send 가능/금지/보류로 나누는 것이다. 이 sprint는 실제 send가 아니라 후보 검토표를 만드는 Green 작업이다.

100% 조건:
- safe_ref 기준 모든 누락 row가 분류된다.
- raw order/payment/click/member/email/phone은 문서에 나오지 않는다.
- backfill_ready는 duplicate 0, value guard pass, confirmed source가 있어야 한다.

현재 진척률: 75%.

### KR7-Sprint2

**이름**: no-send / dedup / value guard 고정

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 purchase 전송 전 반드시 통과해야 하는 안전 조건을 코드/문서/화면에서 같은 말로 고정하는 것이다. 특히 `payment_page_seen`과 `payment_success`를 섞지 않고, 환불/취소/0원/중복/value mismatch를 모두 no-send로 둔다.

100% 조건:
- `payment_page_seen` purchase 후보 0.
- duplicate event_id 0.
- 0원/취소/환불/value mismatch no-send.
- 다중 line 주문도 order total 기준으로 value guard가 통과한다.

현재 진척률: 70%.

### KR7-Sprint3

**이름**: Meta Events Manager UI 검증

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 VM Cloud CAPI send log와 Meta UI가 같은 의미로 보이는지 확인하는 것이다. Codex는 API/log read-only로 볼 수 있지만, Meta UI 화면은 TJ님 권한이 필요할 수 있다.

100% 조건:
- Pixel/Dataset이 맞다.
- Purchase server event가 최근 수신된다.
- event match quality, data freshness, restriction warning이 기록된다.
- UI 지연과 실제 수신 단절을 분리한다.

현재 진척률: 40%.

### KR7-Sprint4

**이름**: Test Events smoke

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 운영 Purchase count를 늘리지 않고 browser/server 수신 경로가 살아 있는지 확인하는 것이다. test_event_code 없는 Purchase send는 금지한다.

100% 조건:
- test_event_code 기반 1건 이하 smoke.
- events_received=1.
- 운영 Purchase count delta 0.
- raw id 출력 0.

현재 진척률: 55%.

### KR7-Sprint5

**이름**: refund/cancel guard

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 취소/환불된 구매가 플랫폼 구매 신호에 남지 않게 하는 것이다. 보정 이벤트가 필요하면 purchase 전송과 별도 Red approval로 분리한다.

100% 조건:
- 취소/환불 row purchase 후보 0.
- refund/cancel source priority 확정.
- 보정 이벤트가 필요한 경우 payload preview와 rollback plan 작성.

현재 진척률: 25%.

### KR7-Sprint6

**이름**: 플랫폼별 외부 전송 approval packet

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 Meta, GA4, Google Ads, TikTok, Naver를 한 승인으로 묶지 않고 플랫폼별로 분리하는 것이다. 각 플랫폼은 dedup 방식, value 기준, rollback 방식이 다르다.

100% 조건:
- 플랫폼별 no-send dry-run이 있다.
- payload preview가 있다.
- rollback/post-send verification이 있다.
- TJ님이 실제로 무엇을 승인하는지 이해할 수 있다.

현재 진척률: 20%.

## Source / Window / Freshness / Confidence

| 항목 | 값 |
|---|---|
| primary source | VM Cloud attribution_ledger + Meta CAPI send log |
| cross-check | 운영DB PAYMENT_COMPLETE read-only, Imweb/Toss confirmed status where available |
| window | 2026-05-14~2026-05-17 KST incident/recovery window, 이후 7d/30d |
| freshness | 문서 작성 시점 2026-05-17 00:41 KST. 실행 시 live read-only 재계산 필요 |
| confidence | 0.86 |

## 금지선

| 항목 | 상태 |
|---|---|
| Meta CAPI Purchase 운영 전송 | 금지, Red 승인 전 0 |
| GA4 Measurement Protocol purchase 전송 | 금지, Red 승인 전 0 |
| Google Ads conversion upload | 금지, Red 승인 전 0 |
| TikTok/Naver send/upload | 금지, Red 승인 전 0 |
| GTM Production publish | 금지 |
| 운영DB write/import | 금지 |
| raw identifier report/chat/git 출력 | 금지 |

## Auditor Verdict

PASS_WITH_NOTES.

이 문서는 KR7 전송 준비를 정리하는 Green 계획 문서다. 실제 플랫폼 전송, 운영DB write, GTM publish, VM Cloud schema migration은 포함하지 않는다. 다음 Green 작업은 누락 큐 triage와 refund/cancel source inventory이며, 실제 send는 별도 Red approval 전까지 금지한다.
