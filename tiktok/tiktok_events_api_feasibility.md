# TikTok Events API Feasibility & Dedup Readiness

작성 시각: 2026-05-03 KST
Sprint name: TikTok Events API Feasibility & Dedup Readiness
Lane: Green Lane, feasibility/read-only/documentation only
DB 기준:
- 운영DB: 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users`, 이번 sprint write 없음.
- TJ 관리 Attribution VM: `att.ainativeos.net` 서버와 SQLite, 이번 sprint read-only API 조회만 수행.
- 로컬 개발 DB: `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`, 이번 sprint write 없음.

## 1. Auditor Verdict

판정: 조건부 도입 가능, production send는 아직 Red Lane 유지.

자신감: 82%

이유:
- TikTok 공식 문서 기준으로 Pixel과 Events API를 같이 쓰는 것은 권장되는 구조지만, 같은 conversion을 중복 전송할 경우 `event_id` dedup 설계가 필수다.
- 바이오컴은 이미 browser TikTok Pixel `Purchase`가 발화되고 있고, pending 가상계좌 `Purchase`는 Guard가 `PlaceAnOrder`로 낮춘다.
- 현재 TJ 관리 Attribution VM 이벤트 로그는 Guard가 본 raw `eventId=o...`를 저장한다. 반면 TikTok Pixel Helper에 보이는 최종 browser `event_id`는 `Purchase_o...` 또는 `PlaceAnOrder_PlaceAnOrder_o...` 형태다.
- 서버 이벤트를 production으로 보내려면, 서버가 VM raw event_id가 아니라 TikTok이 실제 dedup에 쓰는 최종 browser event_id를 정확히 재현해야 한다.

이번 sprint 결과:
- Production TikTok Events API send: 하지 않음.
- Test Events send: 하지 않음.
- GTM Production publish 변경: 하지 않음.
- Purchase Guard 변경: 하지 않음.
- GA4/Meta/Google 전송: 하지 않음.
- 운영DB write: 하지 않음.
- 문서와 read-only 확인만 수행.

## 2. Official Source Baseline

공식 근거:
- [TikTok Help - About Events API](https://ads.tiktok.com/help/article/events-api?lang=en): 웹 연결에서는 기존 Pixel과 Events API를 함께 쓰고 Event Deduplication을 적용하는 구성을 권장한다.
- [TikTok Help - About Event Deduplication](https://ads.tiktok.com/help/article/event-deduplication): Pixel과 Events API가 같은 event를 중복 보고할 때 `event_id`를 양쪽에 공유해야 dedup이 가능하다. 동일 `event`와 `event_id`는 48시간 window 기준이며, Pixel+Events API overlap은 첫 이벤트 후 5분 이후부터 48시간 내 merge/dedup 조건이 있다.
- [TikTok Help - Standard Events and Parameters](https://ads.tiktok.com/help/article/standard-events-parameters): `AddPaymentInfo`, `InitiateCheckout`, `Purchase`가 표준 event code로 확인된다.
- [TikTok Help - Updated Standard Events](https://ads.tiktok.com/help/article/how-to-adopt-tiktoks-updated-standard-events?lang=en): `PlaceAnOrder`는 soft-deprecated event로 2027년까지 지원되지만 신규 설계에서는 더 적합한 event 사용을 권장한다. `CompletePayment`는 `Purchase`로 rename된 계열이다.
- [TikTok Help - Tealium Events API guide](https://ads.tiktok.com/help/article/tiktok-tealium-eapi-implementation-guide?lang=en): Test Events tab에서 `test_event_code`를 가져와 test event를 production data에 포함하지 않는 방식으로 검증할 수 있다.

## 3. Current Browser Pixel Event ID Rules

확인 원천:
- 코드: `tiktok/tiktok_purchase_guard_enforce_v1.js`
- 코드: `backend/src/tiktokPixelEvents.ts`
- 문서/캡처: `tiktok/tiktok0329_claude1.md`, `tiktok/fetchresult.md`, `tiktok/firsttouch_vm_deploy_approval.md`
- read-only API: `https://att.ainativeos.net/api/attribution/tiktok-pixel-events?siteSource=biocom_imweb&limit=30`

핵심 구조:
- Imweb/TikTok wrapper는 `TIKTOK_PIXEL.track(event_name, parameters)` 호출 시 `parameters.event_id`가 있으면 최종 Pixel event_id를 `event_name + "_" + event_id` 형태로 만든다.
- Purchase Guard는 `TIKTOK_PIXEL.track` 앞에서 intercept하므로 raw `eventId=o...`를 먼저 본다.
- Guard event log는 raw `eventId=o...`를 TJ 관리 Attribution VM에 저장한다.
- TikTok Pixel Helper는 최종 전송 event_id를 보여주므로 `Purchase_o...`처럼 prefix가 붙어 보인다.

| 이벤트 | 현재 browser 발화/관측 | Guard/VM raw event_id | Pixel Helper 최종 event_id | order_code 기반 여부 | 서버 dedup 후보 |
| --- | --- | --- | --- | --- | --- |
| `Purchase` | 카드 confirmed 주문에서 허용됨 | `o{order_code}` | `Purchase_o{order_code}` | 예 | 가능. 단 서버도 event name `Purchase`, event_id `Purchase_o{order_code}`로 맞춰야 함 |
| `CompletePayment` | Guard가 들어오면 `Purchase`로 normalize | raw order code 또는 `Purchase_o...` 가능 | 현재 운영 관측은 `Purchase_o...` | 예 | production 신규 설계는 `Purchase` 기준. `CompletePayment`는 Test Events에서만 호환 확인 |
| `PlaceAnOrder` | pending 가상계좌에서 `Purchase` 차단 후 대체 발송 | 원본 raw `o{order_code}`를 `original_event_id`로 보존 | 관측값 `PlaceAnOrder_PlaceAnOrder_o{order_code}` | 예, double prefix 주의 | production send 후보 아님. soft-deprecated이고 pending Guard와 충돌 위험 |
| `InitiateCheckout` | 2026-04-16 Events Manager 테스트 기준 수신 기록 있음 | VM Guard 로그 대상 아님 | `InitiateCheckout_o{order_code}` 관측 기록 | 예로 추정 | 아직 불충분. browser capture 보강 전 dedup 불가 |
| `AddPaymentInfo` | 현재 track 호출/Pixel Helper 확인 없음 | 없음 | 없음 | 미확인 | dedup 불가 |

해석:
- `Purchase`는 event_id 공유 가능성이 가장 높다. 다만 서버가 VM에 저장된 raw `o...`를 그대로 보내면 browser `Purchase_o...`와 dedup되지 않을 가능성이 높다.
- `PlaceAnOrder`는 현재 pending 가상계좌를 purchase에서 분리하기 위한 browser-only 대체 신호다. 이 이벤트를 서버로 추가 전송하면 pending 주문 intent가 더 강하게 TikTok에 들어가므로 ROAS 정합성 목적과 충돌할 수 있다.
- `InitiateCheckout`, `AddPaymentInfo`는 서버 전송보다 먼저 browser event_id capture가 필요하다.

## 4. Pixel Event Name to Server Event Name Mapping

원칙:
- dedup 목적이면 browser event name과 server event name을 동일하게 둔다.
- TikTok 공식 최신 표준명은 `Purchase`다. `CompletePayment`는 legacy/renamed 계열이므로 신규 production server event에는 쓰지 않는다.
- `PlaceAnOrder`는 soft-deprecated라 신규 server 설계에서는 기본 제외한다.

| Browser Pixel event | Server Events API event 후보 | 판정 | 이유 |
| --- | --- | --- | --- |
| `Purchase` | `Purchase` | 1순위 후보 | 공식 표준 event이며 현재 Pixel Helper 최종 event와 일치 |
| `CompletePayment` | `Purchase` | legacy 호환 확인용 | Guard도 `CompletePayment`를 `Purchase`로 normalize한다 |
| `PlaceAnOrder` | `PlaceAnOrder` | production 제외 | soft-deprecated, pending Guard의 낮춤 이벤트라 최적화 신호로 부적합 |
| `InitiateCheckout` | `InitiateCheckout` | capture 후 후보 | 공식 표준 event이나 현재 event_id capture가 부족 |
| `AddPaymentInfo` | `AddPaymentInfo` | capture 후 후보 | 공식 표준 event이나 현재 발화 확인이 부족 |

## 5. Send Candidate Table

| 이벤트 후보 | Production send 후보 | Shadow mode 후보 | 조건 | 현재 결론 |
| --- | --- | --- | --- | --- |
| confirmed `Purchase` | Red Lane에서만 가능 | 예 | 결제 상태 confirmed, TikTok evidence 있음, final browser event_id 재현 가능, dedup Test Events 통과 | 가장 유력하지만 아직 production 금지 |
| pending 가상계좌 `Purchase` | 아니오 | 예, block record만 | payment status pending 또는 virtual account issued | 절대 purchase류로 보내지 않음 |
| canceled/overdue order | 아니오 | 예, block record만 | 운영DB/VM/동기화 기준 canceled 또는 overdue | TikTok conversion으로 보내지 않음 |
| `InitiateCheckout` | 아직 아니오 | 예 | browser event_id capture, TikTok evidence, PII 없음 | 향후 퍼널 진단용 가능 |
| `AddPaymentInfo` | 아직 아니오 | 예 | browser 발화 확인 후 | 현재는 미확인 |
| `PlaceAnOrder` | 아니오 | 제한적 예 | pending intent 감사 로그로만 | soft-deprecated, optimization send 금지 |
| `marketing_intent` | 아니오 | 이미 내부 저장 | TikTok UTM/ttclid/referrer evidence | TikTok 이벤트로 보내지 않음 |

## 6. Do Not Send Rules

Hard Fail:
- pending 가상계좌 주문을 `Purchase`, `CompletePayment`, 또는 purchase류 server event로 보내지 않는다.
- TikTok evidence가 없는 confirmed order를 TikTok Events API로 보내지 않는다.
- `marketing_intent` 자체를 TikTok Events API event로 보내지 않는다.
- VM raw event_id `o...`를 server dedup event_id로 그대로 쓰지 않는다. browser final event_id와 불일치할 수 있다.
- `test_event_code`를 production 환경에 남기지 않는다.
- GA4/Meta/Google 전환 전송과 묶어서 진행하지 않는다.
- 개발팀 관리 운영DB PostgreSQL에는 write하지 않는다.

TikTok evidence 인정 후보:
- `ttclid`
- TikTok paid UTM: `utm_source=tiktok` 또는 동등 evidence
- TikTok referrer
- TJ 관리 Attribution VM의 `marketing_intent` row와 같은 browser/session/order 연결
- 기존 `/ads/tiktok` strict confirmed 조건을 만족하는 order-level 연결

## 7. Dedup Feasibility

Dedup 가능:
- confirmed `Purchase`: 가능성 높음.
- 필요 server event_id: `Purchase_{order_code}`
- 필요 event name: `Purchase`
- 필요 pixel/event source: `D5G8FTBC77UAODHQ0KOG`

Dedup 불확실:
- `PlaceAnOrder`: 현재 final event_id가 `PlaceAnOrder_PlaceAnOrder_{order_code}`로 관측되어 double prefix가 있다. production send 대상이 아니므로 굳이 맞출 필요가 낮다.
- `InitiateCheckout`: 과거 event_id는 `InitiateCheckout_{order_code}`로 관측됐지만 현재 발화 위치와 안정성이 부족하다.

Dedup 불가:
- `AddPaymentInfo`: browser event_id가 없다.
- TikTok evidence 없는 order: attribution 목적에 맞지 않아 send 대상이 아니다.

중요 위험:
- TikTok dedup은 첫 번째 이벤트를 기준으로 보존/merge한다. browser가 잘못된 purchase를 먼저 보낸 상태에서 server가 나중에 확정 purchase를 보내면, dedup이 오히려 잘못된 신호를 유지할 수 있다.
- 현재 Guard가 pending 가상계좌 `Purchase`를 차단하고 있어 이 위험은 많이 줄었지만, `unknown` fail-open 구매가 있을 수 있으므로 server send 전에는 `allowOnUnknown` 정책도 별도 검토해야 한다.

상세 규칙은 `tiktok/tiktok_events_api_dedup_rules.md`에 분리했다.

## 8. Test Events Only Plan

목표:
- production data나 optimization 신호에 반영하지 않고, TikTok Events Manager Test Events 화면에서 payload 형식과 event_id/dedup 가능성을 확인한다.

필요 조건:
- TikTok Events Manager에서 발급한 `test_event_code`
- TikTok Events API 권한이 있는 access token
- Pixel/Event Source ID 또는 pixel code: 현재 browser Pixel Helper 기준 `D5G8FTBC77UAODHQ0KOG`
- 테스트 주문 1건 또는 smoke-only synthetic order. production send와 구분되는 event_id 사용
- test code가 env/코드에 영구 저장되지 않는 runbook

Yellow Lane gate:
- Test Events only는 실제 TikTok endpoint를 호출하므로 Green Lane이 아니다.
- 별도 승인 sprint에서만 진행한다.
- 실행 전 `send_mode=test_events_only`, `production_send=false`, `test_event_code_required=true` 같은 explicit guard가 있어야 한다.

상세 runbook은 `tiktok/tiktok_events_api_test_events_runbook.md`에 분리했다.

## 9. Shadow Mode Payload Design

목표:
- TikTok으로 보내지 않고 TJ 관리 Attribution VM SQLite에만 “보낼 수 있었던 후보”를 저장한다.
- production send 전 누락/중복/오탐을 7일 이상 검증한다.

저장 위치:
- TJ 관리 Attribution VM SQLite 전용 후보 원장.
- 운영DB PostgreSQL write 금지.
- 로컬 개발 DB write는 별도 로컬 테스트에서만 허용.

권장 record shape:

```json
{
  "site": "biocom",
  "touchpoint": "tiktok_events_api_shadow",
  "send_candidate": false,
  "send_mode": "shadow_only",
  "event_name": "Purchase",
  "browser_event_name": "Purchase",
  "raw_order_code": "o20260502example",
  "server_event_id_candidate": "Purchase_o20260502example",
  "browser_event_id_observed": "Purchase_o20260502example",
  "dedup_ready": true,
  "dedup_block_reason": "",
  "payment_status": "confirmed",
  "payment_decision_branch": "allow_purchase",
  "tiktok_evidence_type": "ttclid",
  "tiktok_evidence_value_present": true,
  "value": 11900,
  "currency": "KRW",
  "pixel_code": "D5G8FTBC77UAODHQ0KOG",
  "pii_in_payload": false,
  "do_not_send_reason": "shadow_mode_only",
  "created_at": "2026-05-03T00:00:00+09:00"
}
```

block_reason 예시:
- `pending_virtual_account`
- `canceled_or_overdue`
- `no_tiktok_evidence`
- `missing_browser_event_id`
- `event_name_mismatch`
- `pixel_code_mismatch`
- `pii_detected`
- `test_event_code_present_in_production_env`

## 10. Credentials and Token Needs

필요 정보:
- TikTok Events API access token
- Pixel/Event Source ID 또는 pixel code: `D5G8FTBC77UAODHQ0KOG`
- TikTok advertiser/account 권한
- Test Events only 단계의 `test_event_code`
- Events API 권한이 현재 발급 토큰에 포함되어 있는지 확인

현재 코드에서 보이는 기존 TikTok credential:
- `backend/src/tiktokAdsDailySync.ts`, `backend/src/tiktokAdsAutoSync.ts`는 `TIKTOK_BUSINESS_ACCESS_TOKEN`과 `TIKTOK_ADVERTISER_ID`를 사용해 TikTok Ads reporting 데이터를 수집한다.
- 이 토큰이 Events API send 권한까지 가진다는 증거는 아니다. Ads reporting API 권한과 Events API event track 권한은 실행 전 별도 확인해야 한다.
- 루트 `/Users/vibetj/coding/seo/.env`는 현재 없었다. 실제 env는 backend/VM 배포 위치에서 확인해야 하며, secret 값은 출력하지 않는다.

이번 sprint에서 확인하지 않은 것:
- 실제 token 권한 검증. 이유: token 검증은 TikTok API 호출 또는 권한 endpoint 접근이 필요할 수 있고, 이번 Green Lane 범위는 no-send/no-platform-call feasibility다.
- `.env` 값 출력. 이유: secret 노출 방지.

## 11. Production Send Prerequisites

Production send 전 필수 조건:
1. canonical event_id builder 구현: raw order code `o...`와 final browser id `Purchase_o...`를 분리해서 저장한다.
2. shadow mode 7일 이상 운영: `send_candidate=false`로 후보/차단/불일치 사유를 누적한다.
3. confirmed purchase만 후보: pending/canceled/overdue/unknown은 server purchase로 보내지 않는다.
4. TikTok evidence 필수: no TikTok evidence confirmed order는 TikTok Events API로 보내지 않는다.
5. Test Events only Yellow Lane 통과: `test_event_code`로 Events Manager Test Events에서 server event 수신과 event_id를 확인한다.
6. dedup 진단 통과: Pixel과 server event가 같은 event/event_id로 인식되는지 Events Manager Diagnostics/Test Events에서 확인한다.
7. rollback switch: `TIKTOK_EVENTS_API_SEND_ENABLED=false`가 기본값이고, production send는 별도 Red Lane 승인 없이는 켜지지 않는다.
8. PII guard: raw email/phone/name/address/order memo 등 민감정보가 payload에 들어가지 않아야 한다. 필요 match key는 별도 정책과 hashing 규칙 승인 후만 허용한다.

## 12. Lane Classification

| 작업 | Lane | 이번 sprint 상태 |
| --- | --- | --- |
| Feasibility 문서화 | Green | 완료 |
| Dedup 규칙 문서화 | Green | 완료 |
| Test Events runbook 작성 | Green | 완료 |
| Shadow payload 설계 | Green | 완료 |
| TikTok Events API Test Events only 호출 | Yellow | 미실행, 별도 승인 필요 |
| Shadow mode VM receiver/table 구현 | Yellow | 미실행, 별도 승인 필요 |
| Production Events API send | Red | 금지 유지 |
| GTM Production publish 변경 | Red | 금지 유지 |
| Purchase Guard 변경 | Red | 금지 유지 |
| 운영DB PostgreSQL write | Red | 금지 유지 |

## 13. Next Sprint Proposal

제안 이름: TikTok Events API Shadow Candidate Ledger

권장 자신감: 78%

상세 설계:
- `tiktok/tiktok_events_api_shadow_ledger_design.md`
- 승인 요청 초안: `tiktok/tiktok_events_api_shadow_ledger_approval.md`

왜 하는가:
- 현재는 “보낼 수 있는 서버 이벤트인지”를 주문별로 판단할 근거가 문서와 분산 로그에 있다.
- production send 전에 TJ 관리 Attribution VM에 shadow 후보 원장을 만들면, 실제 send 없이 7일 동안 중복/불일치/차단 사유를 검증할 수 있다.

허용 범위:
- TJ 관리 Attribution VM에 shadow-only 후보 저장 schema 또는 existing ledger 확장안 작성
- 로컬 구현 및 테스트
- VM 배포는 별도 Yellow 승인 후 진행
- production send는 계속 off

금지 범위:
- TikTok Events API production send
- Test Events send
- 운영DB write
- Purchase Guard 변경
- firstTouch strict 승격

성공 기준:
- 최근 confirmed TikTok 주문에서 `server_event_id_candidate=Purchase_{order_code}`가 생성된다.
- pending/canceled/no-evidence 주문은 `send_candidate=false`와 block_reason이 남는다.
- `/ads/tiktok` strict confirmed 숫자와 shadow candidate 숫자가 설명 가능한 수준으로 맞는다.

실패 시 해석:
- browser final event_id를 안정적으로 재현하지 못하면 Events API production send는 보류한다.
- TikTok evidence가 약하면 server send는 광고 최적화 신호가 아니라 오염 신호가 될 수 있으므로 보류한다.
