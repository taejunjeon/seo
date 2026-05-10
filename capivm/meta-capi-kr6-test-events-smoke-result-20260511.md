# Meta CAPI KR6 Test Events smoke 결과 (gpt0508-35)

작성 시각: 2026-05-10 23:08:00 KST
실행 상태: **STOP — env blocker 명확화: META_TEST_EVENT_CODE 부재**
자신감: 92% (env 부재가 일관되게 확인됨)

## 5줄 결론 (사람이 이해하는 언어로)

1. Meta CAPI는 “구매전 행동 4종(상품 보기/장바구니 담기/주문서 시작/결제정보 입력)”을 Meta Events Manager **테스트 탭**에서만 보이게 발사하는 안전한 모드(`test_event_code`)로 검증해야 하오.
2. 그러려면 backend `.env`에 `META_TEST_EVENT_CODE`(또는 동등한 키)가 있어야 하는데, 현재 `.env`에 그런 키가 없소(`META_PIXEL_ID_*`만 있음).
3. backend 코드는 이미 `test_event_code`가 들어오면 dedup 스킵 + 운영 송출 차단 분기를 갖추고 있어서 코드는 멋지게 준비됐지만, 키 자체가 없으니 실제 발사가 불가하오.
4. 따라서 본 sprint는 실제 호출 0건. operational send 0, Purchase 0, dedup contract 그대로 유지.
5. TJ님이 Meta Events Manager에서 Test Events 코드를 받아 backend `.env`에 추가하면 다음 sprint에서 30분 windowed smoke로 4 이벤트를 즉시 발사 가능하오.

## 1. 무엇을 / 왜 / 어떻게

| 항목 | 값 |
|---|---|
| 무엇을 | backend `.env`에 META_TEST_EVENT_CODE 또는 동등 키 존재 여부 read-only 점검 |
| 왜 | 실제 Test Events smoke를 하려면 키가 backend에 있어야 운영 dedup 우회 + 운영 송출 차단 분기가 작동 |
| 어떻게 | grep `META_TEST_EVENT_CODE\|test_event_code\|testEventCode\|META_PIXEL_ID` |
| 어디에서 | `/Users/vibetj/coding/seo/backend/.env` |

## 2. 점검 결과

| 키 | 상태 |
|---|---|
| `META_PIXEL_ID_BIOCOM` | 존재 (값은 redacted) |
| `META_PIXEL_ID_COFFEE` | 존재 |
| `META_PIXEL_ID_AIBIO` | 존재 |
| **`META_TEST_EVENT_CODE` 또는 동등 키** | **부재** |

backend code에는 `metaCapi.ts:1473/1770`에 `test_event_code?.trim()` 분기가 이미 있어서, 키만 채우면 즉시 동작하오.

## 3. 왜 실제 발사를 하지 않았는가

backend가 `test_event_code` 없이 호출하면 **operational dedup이 적용되고** 결과적으로 운영 Pixel의 실제 send count로 잡힐 위험이 있소. 4 이벤트를 그렇게 발사하면 Meta Events Manager 운영 탭에 들어가서 실제 광고 학습에 영향을 줄 수 있어 금지선 위반이오.

따라서 키가 없는 동안은 절대 발사하지 않는다는 게 안전한 처리요.

## 4. dedup contract 갱신 (no-send)

| 이벤트 | event_id 형식 | dedup window | 비고 |
|---|---|---|---|
| ViewContent | `vc_<sessionId>_<contentId>_<ts>` | 1h | 변경 없음 |
| AddToCart | `atc_<sessionId>_<sku>_<ts>` | 1h | 변경 없음 |
| InitiateCheckout | `ic_<sessionId>_<ts>` | 30m | 변경 없음 |
| AddPaymentInfo | `api_<sessionId>_<ts>` | 30m | 변경 없음 |
| Purchase | (smoke 미포함) | operational dedup | **이번 sprint도 발사 금지** |

## 5. TJ님이 직접 해야 하는 작업 (Codex 대체 불가)

1. Meta Events Manager 접속
   - URL: https://www.facebook.com/events_manager2/list/dataset
   - Pixel/Dataset: `1283400029487161` (biocom)
2. Test Events 탭 진입 → "Browser Events / Test Event Code" 영역에서 임시 코드 발급(예: `TEST12345`).
3. 코드를 backend `.env`에 추가:
   ```
   META_TEST_EVENT_CODE_BIOCOM=TEST12345
   ```
4. backend 재시작 안내 (Codex가 다음 sprint에서 진행).

이 작업은 Codex가 Meta UI write 권한이 없어 대신할 수 없소.

## 6. 다음 할일

### TJ님이 할 일
1. Meta Events Manager에서 Test Events 코드 발급 + `.env`에 추가.
   - 추천: 진행 추천
   - 자신감: 90%
   - Lane: Yellow (`.env` 변경)
   - 성공 기준: backend `.env`에 `META_TEST_EVENT_CODE_BIOCOM` 키 추가 + grep 확인
   - 실패 시 해석: Test Events 탭 UI 변경, Pixel ID 권한 부족 → 별도 안내

### Codex가 할 일
1. TJ가 `.env`에 키 넣고 알려주면 backend 재시작 + 30분 window 4 이벤트 smoke 진행.
   - 추천: 진행 추천
   - 자신감: 88%
   - Lane: Yellow (이미 승인됨)
   - 의존성: TJ가 키 추가
   - 성공 기준: Events Manager Test 탭에 4 이벤트 노출 + Browser/Server 같은 event_id

## 7. 금지 (변함 없음)

- Meta Purchase 발사 ❌
- enableServerCapi=true 운영 송출 ❌
- Imweb footer/header 편집 ❌
- GTM Production publish ❌

## 8. Verdict

`KR6_SMOKE_HALTED_ENV_BLOCKER_TJ_ACTION_REQUIRED`
