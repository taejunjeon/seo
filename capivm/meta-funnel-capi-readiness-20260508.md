# Meta funnel CAPI readiness — biocom 기준 점검

작성 시각: 2026-05-08 01:15 KST
대상: biocom Meta Pixel `1283400029487161` (운영 Purchase CAPI 송출 중)
문서 성격: Green Lane read-only 점검 + Test Events 실행 승인안 초안
관련 문서: [[!capiplan]], [[../meta/capimeta]], [[capi]], [[../footer/funnel_capi_0415]], [[../data/coffee-funnel-capi-cross-site-applicability-20260501]]
Status: 1차 readiness, Test Events smoke 별 승인 필요
Do not use for: Meta Events Manager 운영 카운트 증가, Pixel 변경, 광고 캠페인 변경, GTM Production publish

```yaml
harness_preflight:
  lane: Green readiness 점검 / Yellow Test Events smoke 실행 승인 초안
  allowed_actions_now:
    - 코드/log read-only 점검
    - Test Events smoke 계획 작성
    - 승인안 초안
  allowed_actions_after_approval:
    - test_event_code 지정 smoke 호출 (Meta Events Manager Test Events 탭에서만 노출, 운영 카운트 미반영)
    - browser/server same event_id dedup 검증
    - smoke 결과 문서화
  forbidden_actions_until_explicit_separate_approval:
    - 운영 funnel event (ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo) test_event_code 없는 송출
    - GTM 또는 imweb body 변경으로 client → server 호출 활성화
    - Pixel ID 또는 Conversions API token 변경
    - 광고 캠페인 변경
  source_window_freshness_confidence:
    source: "backend/src/routes/meta.ts + backend/src/metaCapi.ts + 운영 VM meta-capi-sends.jsonl"
    window: "2026-05-07 운영 log + 2026-05-08 코드 read"
    freshness: "본 sprint 직접 측정"
    confidence: 0.92
```

## 5줄 결론

1. Meta **Purchase CAPI는 운영 송출 중** (3,359 lines, 최근 200건 production / 200 OK, pixel `1283400029487161`).
2. **Funnel 이벤트 (ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo/Lead/Search) 6종은 server endpoint 준비 완료** (whitelist + pixel + origin + rate limit + test_event_code 지원). 그러나 **클라이언트 호출이 없어 실제 운영 송출 0건**.
3. enableServerCapi 같은 별도 flag 없음 — endpoint는 호출되면 즉시 송출 (단, test_event_code 지정 시 Test Events 탭에만 노출).
4. **운영 ON 전 필수 절차**: Test Events smoke (test_event_code 지정) → browser/server 같은 event_id dedup 검증 → Events Manager Diagnostics 확인 → 후 GTM/imweb body 클라이언트 wiring 별 승인.
5. AddPaymentInfo wrap race (clean-coffee 사이트의 `funnel-capi v3` 와 클라이언트 firing 충돌) 검토는 별도 sprint. biocom에선 클라이언트 fire 자체가 없어 race 발생 불가.

## 2026-05-08 Green follow-up

TJ님이 Meta Test Events code를 전달했다. 원문값은 파일에 저장하지 않고 `TEST*****`로만 마스킹했다.

이번 follow-up에서 실제 Meta 호출은 하지 않았다. `/api/meta/capi/track` network send, GTM Preview/Publish, Imweb header/footer 수정, 운영 CAPI 전송은 모두 0건이다.

GTM-first 경로를 우선한다. 아임웹 header/footer 직접 수정은 운영 사이트 전역 코드 영향이 크므로 후순위다. 현재 권장 경로는 `fresh GTM Preview workspace -> Custom HTML tag 테스트 -> Tag Assistant와 Meta Test Events 확인 -> Production publish 별도 Red 승인` 순서다.

정본 연결은 [[../total/!total-current]]로 고정한다. [[../data/!datacheckplan]]은 Meta CAPI/ROAS 이력과 배경 문서로 남긴다.

새 산출물:

- [[meta-funnel-capi-gtm-first-plan-20260508]]
- [[meta-funnel-capi-test-events-payload-preview-2026-05-08]]
- `../data/meta-funnel-capi-test-events-payload-preview-2026-05-08.json`

## 1. 서버 측 준비 상태 (코드 read-only)

| 항목 | 위치 | 상태 |
|---|---|---|
| Endpoint | `POST /api/meta/capi/track` (`backend/src/routes/meta.ts:1483`) | ✅ 동작 |
| Allowed events | `FUNNEL_ALLOWED_EVENT_NAMES = {ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo, Lead, Search}` | ✅ 6종 |
| Origin whitelist | `FUNNEL_ALLOWED_ORIGINS = {biocom.kr, www.biocom.kr, thecleancoffee.com, www.thecleancoffee.com, thecleancoffee.imweb.me, localhost:7010}` | ✅ |
| Pixel ID whitelist | `META_PIXEL_ID_BIOCOM`, `META_PIXEL_ID_COFFEE`, `META_PIXEL_ID_AIBIO` env 등록값만 | ✅ |
| Rate limit | IP 당 30s window / 300 req | ✅ |
| Required event_id | 필수 (`event_id_required` 400 reject) | ✅ |
| `test_event_code` 지원 | request body 에 포함 시 Meta Test Events 탭으로 라우팅 | ✅ |
| `event_source_url`, `client_ip_address`, `client_user_agent`, `fbp`, `fbc` | user_data에 포함 | ✅ |
| `content_ids`, `content_type`, `value`, `currency` | custom_data 옵션 | ✅ |
| `enableServerCapi` 같은 별도 ON/OFF flag | 없음 (endpoint는 호출되면 즉시 송출, test_event_code로만 분리) | ⚠️ |

→ **server는 production-ready**. test_event_code 지정 안 하면 운영 카운트 즉시 증가.

## 2. 운영 송출 현황 (log 기준)

`/home/biocomkr_sns/seo/shared/backend-logs/meta-capi-sends.jsonl`:

| 항목 | 값 |
|---|---|
| 총 라인 수 | 3,359 |
| 파일 마지막 수정 | 2026-05-07 15:33 UTC |
| 최근 50건 event_name | **Purchase 50건** (다른 event 없음) |
| 최근 50건 test_event_code | **production 50건** (test_event_code null = 운영 카운트 반영) |
| 최근 50건 response_status | **2xx 50건** (Meta 정상 응답) |
| ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo 송출 | **0건** |

→ **Purchase는 운영 송출 정상 동작**. **Funnel 이벤트는 클라이언트 호출이 없어 실제 송출 0건**.

## 3. 클라이언트 측 (GTM / imweb body) 호출 현황

`/api/meta/capi/track` 으로 POST 보내는 클라이언트 코드가 없음 (또는 활성화 안 됨). 이는:

- biocom imweb body 코드 (`coffee/!imwebcoffee_code_latest_0501.md` 와 유사하게 biocom용도 별도)에서 `funnel-capi v3` 와 같은 클라이언트 wrapper가 있어야 함.
- GTM 에 ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo trigger + Custom HTML tag 또는 Custom Image tag 로 `/api/meta/capi/track` 호출 wiring 추가해야 함.
- 또는 Meta Pixel JS SDK의 `fbq('trackCustom', ...)` 직후 server-side mirror 호출.

현재 biocom GTM live v142 (paid_click_intent_v1_receiver_20260506T150218Z)는 paid_click_intent receiver 만 wire 됐고, Meta funnel CAPI 호출 코드는 없음. 별도 변경 필요.

## 4. AddPaymentInfo wrap race

문서 `data/coffee-funnel-capi-cross-site-applicability-20260501.md` 가 thecleancoffee.com의 funnel-capi v3 race 이슈를 다룸. biocom 에선:

- 클라이언트 fire 자체가 없으므로 race 발생 불가.
- Test Events smoke 시작 시점에 동일 event_id 가 browser/server 양쪽에서 fire 되는지 검증 필요.

→ biocom 측 AddPaymentInfo race 위험은 클라이언트 wiring 추가 시 검증 단계에서 같이 측정.

## 5. Test Events smoke 계획

### 단계 0 — 사전 (TJ 영역)

- Meta Events Manager → Pixel `1283400029487161` → Test Events 탭에서 `test_event_code` 발급 (예: `TEST12345`).
- 발급된 test_event_code 를 본 agent에 전달.

### 단계 1 — 본 agent 측 직접 호출 (server-side smoke)

```bash
curl -X POST -H "Content-Type: application/json" -H "Origin: https://biocom.kr" \
  -d '{
    "eventName": "ViewContent",
    "eventId": "vc_smoke_'"$(date +%s)"'",
    "pixelId": "1283400029487161",
    "eventSourceUrl": "https://biocom.kr/HealthFood/",
    "contentIds": ["test_product_smoke"],
    "contentType": "product",
    "testEventCode": "<TEST_CODE_FROM_TJ>"
  }' \
  https://att.ainativeos.net/api/meta/capi/track
```

ViewContent / AddToCart / InitiateCheckout / AddPaymentInfo / Lead / Search 6종 각 1회 호출.

### 단계 2 — 검증

- Meta Events Manager Test Events 탭에서 6종 event 수신 확인.
- response_status 2xx, fbtrace_id 존재.
- 운영 카운트 (Diagnostics → Production) 미증가 확인.

### 단계 3 — Browser/Server dedup smoke (옵션)

- Meta Pixel JS `fbq('track', 'ViewContent', ..., {eventID: 'vc_dedup_test_001'})` 클라이언트에서 fire.
- 동일 `eventID`로 server-side smoke 호출.
- Test Events 탭에서 1건 (deduplicated) 응답 확인. event_id 일치.

→ biocom client wiring 추가 전 readiness 단계 마무리.

### 단계 4 — 운영 wiring (별 Yellow 승인)

- imweb body 또는 GTM 변경.
- ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo client trigger → server-side mirror 호출 활성화.
- 활성화 직전 final smoke + 1h canary + 24h 모니터링 (Meta Events Manager Production 카운트 추세).

## 6. 운영 ON 시 잠재 위험

| 위험 | 영향 | 완화 |
|---|---|---|
| 클라이언트가 `test_event_code` 없이 호출 | Production 카운트 즉시 증가, Pixel 학습 영향 가능 | 클라이언트 wrapper에 `test_event_code` 필수화 또는 별 endpoint 분리 |
| event_id mismatch | dedup 실패 → Pixel + CAPI 양쪽 카운트 (2배) | Test Events smoke 단계 3에서 검증 |
| Pixel quality drop | Diagnostics 점수 하락 | EMQ (Event Match Quality) 점수 추적 |
| Funnel 이벤트 spike | 광고 자동입찰 학습 신호 변경 | sample rate 적용 또는 점진 ON |
| AddPaymentInfo wrap race | 동일 event 2번 fire | Test Events smoke 단계 3에서 dedup 검증 |
| Pixel + CAPI 동시 fire 시 fbp/fbc 누락 | EMQ 하락 | fbp/fbc cookie raw → server forward 검증 |

## 7. 본 agent 자율 가능 / TJ 영역 / 별 승인 영역

| 작업 | 자율 가능? | 비고 |
|---|---|---|
| 본 readiness 보고 | YES | 본 sprint 완료 |
| Test Events smoke 호출 (test_event_code 지정) | NO | TJ가 test_event_code 발급 후 본 agent 실행 |
| Browser/Server dedup smoke | NO | 클라이언트 fire 측 변경 필요 (imweb 또는 GTM) |
| 운영 wiring 활성화 | NO | 별 Yellow 승인 + GTM/imweb 변경 |
| Pixel ID 변경 | NO | TJ 영역 |
| Conversions API token 변경 | NO | TJ env 영역 |

## 8. TJ 컨펌 한 줄 (즉시 가능)

```text
YES: Meta funnel CAPI Test Events smoke 진행 (test_event_code = ____ 발급 후 전달).
범위는 ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo/Lead/Search 6종 각 1회 server-side 호출 + Meta Events Manager Test Events 탭 수신 확인. 운영 production 카운트 증가 0건 유지.
```

## 9. Coffee 측 funnel CAPI 비교

`data/coffee-funnel-capi-cross-site-applicability-20260501.md` 기준 thecleancoffee.com 측에는 funnel-capi v3 가 이미 있어 client-side fire 됨. biocom 은 코드 idle 상태. 즉 **biocom funnel CAPI는 coffee보다 늦게 시작** — coffee의 패턴을 적용하는 게 안전.

## 10. 다음 자동 진행 (auto_ready)

| 작업 | 의존성 |
|---|---|
| coffee 측 funnel-capi v3 의 race/dedup 운영 evidence 수집 (read-only meta-capi-sends.jsonl 카테고리 분리) | 독립 |
| biocom imweb body 코드에 funnel-capi v3 적용 가능성 코드 read | 독립 |
| Meta Events Manager Diagnostics 점수 추적 (현 baseline) | 별 sprint |

## 한 줄 결론

> Meta funnel CAPI server-ready. client-side wiring 없음 = 운영 ON 전. **Test Events smoke 실행에 TJ가 test_event_code 1개 발급해 주시면 본 agent가 즉시 6종 smoke 진행**. 그 후 client wiring 별 Yellow 승인.
