# Meta Funnel CAPI Plan

작성 시각: 2026-05-04 23:28 KST
기준일: 2026-05-04
문서 성격: 메타 퍼널 CAPI 진행상황과 실행 계획 정본
참조 문서: [[capivm/capi]], [[capivm/capi4reply]], [[capivm/meta-funnel-capi-test-events-smoke-plan-20260505]], [[GA4/product-engagement-summary-contract-20260505]], [[data/!datacheckplan]], [[docurule]]
Lane: Green documentation only
Mode: No-send / No-write / No-deploy / No-platform-send

## 10초 요약

메타 퍼널 CAPI의 방향은 "구매 완료만 보내는 구조"에서 "구매 전 행동도 서버 신호로 보낼 수 있는 구조"로 확장하는 것이다.
다만 현재 운영에서 안전하게 켜진 것은 `Purchase` 중심 CAPI와 구매 차단 Guard다.
`ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo` 같은 구매 전 퍼널 이벤트는 브라우저 event_id 주입까지 일부 구현됐지만, 서버 CAPI mirror는 `enableServerCapi=false`라 아직 운영 송출이 아니다.
다음 행동은 Meta Events Manager Test Events 코드로 중간 퍼널 CAPI를 test-only로 검증하는 것이다.
다만 실제 Test Events 전송은 아직 하지 않았다. smoke payload와 체크리스트는 [[capivm/meta-funnel-capi-test-events-smoke-plan-20260505]]에 준비했다.

## 다음 할일

| 순서 | Phase/Sprint | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 상세 | 컨펌 필요 |
|---:|---|---|---|---|---|---|---|---|
| 1 | [[#Phase2-Sprint3]] | 준비안 완료 / 실행 대기 | TJ + Codex | Meta Test Events 코드로 중간 퍼널 CAPI smoke를 한다 | 서버 CAPI mirror가 실제 Meta에서 browser/server dedup 되는지 확인해야 운영 ON 여부를 판단할 수 있다 | [[capivm/meta-funnel-capi-test-events-smoke-plan-20260505]] 기준으로 `test_event_code`가 있을 때만 상품 페이지 3~5개를 방문하고 Events Manager 테스트 탭을 확인한다 | [[#Phase2-Sprint3\|이동]] | YES |
| 2 | [[#Phase2-Sprint4]] | 부분 완료 | TJ + Codex | `AddPaymentInfo`가 왜 event_id 주입 로그에 안 잡혔는지 확인한다 | 결제정보 단계가 빠지면 결제 직전 퍼널 신호가 비게 된다 | Console에서 `window.fbq.__FUNNEL_CAPI_V3_WRAPPED__`를 확인하고 Network에서 `ev=AddPaymentInfo` 발화 시점을 본다 | [[#Phase2-Sprint4\|이동]] | YES |
| 3 | [[#Phase1-Sprint1]] | 부분 완료 | TJ + Codex | Purchase Browser/Server dedup을 Events Manager UI에서 확인한다 | VM 성공 로그만으로 Meta dedup 성공을 확정하면 안 된다 | Pixel `1283400029487161`에서 Purchase Browser/Server 표시, event_id, dedup, Event Match Quality를 캡처한다 | [[#Phase1-Sprint1\|이동]] | YES |
| 4 | [[#Phase3-Sprint5]] | 설계 완료 | Codex | Meta용 `marketing_intent` 수신 설계를 운영 Preview 문서로 쪼갠다 | 결제 완료 시점에만 fbclid/UTM을 잡으면 이미 늦다 | 랜딩 시점에 fbclid, fbc, fbp, UTM, referrer, GA client/session id를 저장하는 GTM Preview 계획을 만든다 | [[#Phase3-Sprint5\|이동]] | NO |
| 5 | [[#Phase3-Sprint6]] | 설계 완료 | Codex | 체류시간/스크롤은 내부 분석용으로 먼저 설계한다 | 표준 퍼널 이벤트가 닫히기 전 engagement custom event를 Meta에 켜면 학습을 오염시킬 수 있다 | [[GA4/gtm-engagement-internal-analysis-design-20260504]] 기준으로 backend contract와 GTM Preview 승인안을 다음 단계로 만든다 | [[#Phase3-Sprint6\|이동]] | NO |

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | Purchase Guard와 Purchase CAPI 안정화 | TJ + Codex | 85% / 70% | [[#Phase1-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | 브라우저 event_id 주입 | Codex | 70% / 45% | [[#Phase1-Sprint2\|이동]] |
| Phase2 | [[#Phase2-Sprint3]] | 중간 퍼널 서버 mirror Test Events | TJ + Codex | 58% / 0% | [[#Phase2-Sprint3\|이동]] |
| Phase2 | [[#Phase2-Sprint4]] | AddPaymentInfo wrap race 확인 | TJ + Codex | 40% / 0% | [[#Phase2-Sprint4\|이동]] |
| Phase3 | [[#Phase3-Sprint5]] | 랜딩 시점 marketing_intent 보존 | Codex | 55% / 0% | [[#Phase3-Sprint5\|이동]] |
| Phase3 | [[#Phase3-Sprint6]] | 체류시간/스크롤 커스텀 신호 판단 | Codex | 35% / 0% | [[#Phase3-Sprint6\|이동]] |

## 문서 목적

이 문서는 메타 퍼널 CAPI가 무엇을 하려는 작업인지, 현재 어디까지 구현됐는지, 운영으로 켜기 전에 무엇을 확인해야 하는지 TJ님과 개발자가 같은 기준으로 보게 만드는 문서다.

## 질문에 대한 답

TJ님이 이해한 방향은 큰 틀에서 맞다.
퍼널 CAPI는 `Purchase`만 Meta에 보내는 것이 아니라, 구매 전에 일어나는 의미 있는 행동도 Meta에 보내서 신호 품질을 높이려는 작업이다.

현재 이 프로젝트에서 명확히 구현 범위로 잡힌 구매 전 표준 이벤트는 아래 4개다.

- `ViewContent`: 상품 상세를 봤다.
- `AddToCart`: 장바구니에 담았다.
- `InitiateCheckout`: 주문서 또는 결제 흐름을 시작했다.
- `AddPaymentInfo`: 결제정보 단계까지 갔다.

단, "체류시간"이나 "스크롤"은 현재 문서와 코드에서 운영 구현 범위로 확인되지 않았다.
Meta에 custom event로 보낼 수는 있지만, 지금 바로 켜면 이벤트 품질 기준이 흔들릴 수 있다.
따라서 현재 우선순위는 표준 퍼널 4개 이벤트를 먼저 test-only로 닫는 것이다.
체류시간/스크롤은 표준 이벤트가 안정화된 뒤 별도 Sprint로 설계해야 한다.

## Footer와 GTM 대체 가능성

여기서 말하는 `footer`는 "아임웹 관리자에 직접 넣는 삽입 코드"를 뜻한다.
다만 repo의 `footer/` 폴더명은 관례상 붙은 이름이고, 실제 파일 안에는 아임웹 헤더 상단 코드, body 직후 코드, 푸터 끝 코드가 함께 있다.

현재 역할은 아래처럼 나뉜다.

- Purchase Guard: 아임웹 헤더 상단에 들어가는 코드다. `Purchase`가 발사되기 직전에 서버 `payment-decision`을 조회해서 구매를 허용하거나 막는다.
- Funnel CAPI v3: 아임웹 푸터 끝에 들어가는 코드다. aimweb이 쏘는 `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`에 event_id를 붙이고, 필요하면 서버 CAPI로 mirror한다.
- UTM persistence, checkout_started, payment_success: 아임웹 페이지 흐름에서 랜딩/주문/결제완료 정보를 attribution backend로 보내는 코드다.
- GTM: biocom 정본 컨테이너는 `GTM-W2Z6PHN`이다. 이미 아임웹 marketing 탭에서 자동 주입되는 축이다.

GTM으로 대체 가능한 것은 있다.
하지만 전부 GTM으로 옮기면 안 된다.

**GTM 대체 추천 영역**:

- `marketing_intent`: 랜딩 시점의 `fbclid`, `_fbc`, `_fbp`, UTM, referrer 저장.
- 체류시간/스크롤 같은 내부 분석용 engagement event.
- dataLayer 기반 `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo` 관찰과 서버-only Test Events smoke.
- stage/preview가 필요한 새 추적 실험. GTM은 Preview와 version 관리가 좋아서 실험에는 아임웹 footer보다 안전하다.

**GTM 대체 신중 영역**:

- 중간 퍼널 Browser+Server 완전 대체.
- 이유는 기존 aimweb 자동 Meta 이벤트가 이미 브라우저 `fbq`를 쏘고 있기 때문이다.
- GTM이 서버 CAPI만 추가하면 browser event_id와 server event_id가 다를 수 있다.
- GTM이 browser fbq까지 직접 쏘면 aimweb 자동 이벤트와 중복될 수 있다.
- 이 경로는 aimweb 자동 Meta event를 끄고 GTM이 단독 소유할 수 있을 때만 안정적이다.

**GTM 대체 비추천 영역**:

- Purchase Guard.
- 이유는 Purchase Guard가 `Purchase` 발화 직전에 가장 먼저 끼어들어야 하기 때문이다.
- GTM은 비동기 로드라 `fbq` wrap 순서가 항상 보장되지 않는다.
- 결제완료 페이지에서 GTM이 늦게 뜨면 이미 `Purchase`가 나간 뒤라 차단할 수 없다.
- 따라서 `Purchase` 차단/허용은 아임웹 헤더 상단 코드로 유지하는 것이 안전하다.

현재 추천안은 아래다.

- 단기: Purchase Guard는 아임웹 헤더 상단에 유지한다.
- 단기: 기존 Funnel CAPI footer는 `enableServerCapi=false`로 유지하고, test-only 검증 전 운영 송출하지 않는다.
- 중기: `marketing_intent`, 체류시간/스크롤 내부 분석, dataLayer 관찰은 GTM Preview로 설계한다.
- 장기: aimweb 자동 Meta 이벤트를 끌 수 있고 GTM이 browser fbq와 server CAPI를 같은 event_id로 단독 발사할 수 있으면, 중간 퍼널은 GTM 중심으로 이전할 수 있다.

## 현재 상태

확인된 결론은 아래다.

- `Purchase` CAPI는 운영 VM에서 서버 전송까지 돌아간다.
- VM `/api/meta/capi/log` 기준 `Purchase` operational send 1,255건, success 1,255건, duplicate 0건으로 기록돼 있다.
- 이 숫자는 "우리 서버가 중복 없이 보냈다"는 증거다.
- 그러나 Meta Events Manager에서 Browser/Server dedup이 성공했다는 최종 증거는 아직 UI 캡처 전이다.
- biocom footer의 `funnel-capi v3`는 `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`에 event_id를 주입하도록 되어 있다.
- live 설정은 `enableServerCapi=false`다. 즉 중간 퍼널 서버 CAPI mirror는 운영 송출 중이 아니다.
- `ViewContent` event_id 주입은 HealthFood와 DietMealBox 상품 페이지에서 관측됐다.
- `AddPaymentInfo`는 Events Manager에 aimweb 자동 이벤트가 보이지만, 2026-04-15 테스트 세션에서는 funnel-capi의 `inject eid AddPaymentInfo` 로그가 확인되지 않았다.
- backend `/api/meta/capi/track`는 `AddPaymentInfo`까지 허용한다. 이는 Test Events smoke가 400으로 막히지 않게 하는 준비다.
- Meta용 `marketing_intent`는 core attribution matching 로직과 테스트가 있다. 다만 운영 receiver는 현재 strict TikTok evidence가 없으면 저장하지 않는 구조라 Meta 랜딩 intent 운영 수집은 아직 별도 보강이 필요하다.

### 2026-05-04 ViewContent CSV와 GTM live 확인

TJ님이 Meta Events Manager에서 내보낸 `ViewContent` CSV는 도움이 된다.
이 파일은 개별 event_id를 주지는 않지만, 브라우저 이벤트와 서버 이벤트의 총량 차이를 정량화한다.

CSV 확인 결과:

- 파일: `/Users/vibetj/Downloads/2026. 5. 4. 오후 11_48.csv`
- 유효 row: 672개. 마지막 약관 안내 row 1개는 데이터가 아니라 제외했다.
- event: `ViewContent`만 포함.
- window: 2026-04-06 23:00 ~ 2026-05-04 22:00 KST.
- browser_received_count 합계: 432,795.
- server_received_count 합계: 2.
- server 비율: 0.000462%.
- server row는 2026-04-14 02:00 KST 1건, 2026-04-15 13:00 KST 1건뿐이다.

해석:

- `ViewContent` 서버 CAPI mirror는 현재 운영상 사실상 켜져 있지 않다.
- Meta UI의 "이벤트 범위 0%" 경고와 정합한다.
- 이 CSV만으로는 dedup 성공 여부를 판단할 수 없다. event_id가 없기 때문이다.
- 따라서 다음 테스트는 `test_event_code`를 붙인 stage footer에서 server count가 증가하는지와 Events Manager Test Events 탭의 event_id 일치를 같이 봐야 한다.

GTM API read-only 확인 결과:

- 대상 컨테이너: `GTM-W2Z6PHN`.
- live version: `140`, `tiktok_marketing_intent_v1_live_20260503`.
- live 구성: tags 58, triggers 84, variables 60.
- 체류시간 트리거가 있다: trigger `[18] 긴 조회 시간(page_view_long)`, type `timer`, interval `420000ms`, limit `1`.
- 이 트리거는 tag `[21] tmp_ga4 page_view_long 이벤트`에 연결돼 있다. GA4 event name은 `page_view_long`, measurement id는 `G-WJFXN5E2Q1`, value는 `100`, currency는 `KRW`다.
- 스크롤 트리거가 있다: trigger `[11] 트리거`, type `scrollDepth`, thresholds `10,25,50,75,90`, units `PERCENT`, start `WINDOW_LOAD`.
- 하지만 live version 140 기준으로 trigger `[11]`을 firing trigger로 쓰는 tag는 없다. 즉 스크롤 깊이는 트리거 기반만 있고 실제 GA4/Meta 전송 태그에는 연결되지 않은 상태로 판단한다.
- variable `[33] USER_TIME`은 현재 시각을 ISO 문자열로 반환하는 변수다. 사용자의 실제 체류시간을 계산하는 변수는 아니다.

결론:

- TJ님 말처럼 체류시간/스크롤의 "기반"은 GTM에 일부 있다.
- 그러나 현재 상태는 "Meta CAPI에 바로 활용 가능"이 아니라 "GTM 기반 내부 분석 설계에 재사용 가능"이다.
- 특히 `page_view_long`은 7분 기준이라 너무 보수적이다. Meta 신호로 쓰기보다 내부 분석용 참고 지표로 먼저 보는 것이 맞다.
- 스크롤은 tag 연결이 없으므로 새 tag/endpoint 없이 운영 데이터로 쌓이지 않는다.

## 구현된 것

구매 완료 쪽은 많이 진행됐다.

- `footer/header_purchase_guard_server_decision_0412_v3.md`가 `window.FB_PIXEL.Purchase`와 `window.fbq('track', 'Purchase')`를 모두 감싼다.
- payment-decision endpoint가 `confirmed`, `pending`, `canceled`, `unknown`을 판단한다.
- 카드 결제 confirmed는 Browser Pixel `Purchase`를 통과시킨다.
- 가상계좌 pending은 Browser Pixel `Purchase`를 차단하고 `VirtualAccountIssued` custom event를 보낸다.
- Server Purchase CAPI는 `Purchase.{아임웹 order_code}` 형태 event_id를 우선 사용하도록 개선돼 Browser/Server dedup 기준을 맞춘다.
- CAPI payload는 `client_ip_address`, `client_user_agent`, `fbc`, `fbp`, hashed email, hashed phone을 넣을 수 있어 Advanced Matching 기반이 있다.

구매 전 퍼널 쪽은 구조가 준비됐다.

- `footer/biocom_footer_0415_final3.md`의 `funnel-capi v3`가 `window.fbq`를 wrap한다.
- aimweb이 이미 쏘는 표준 이벤트에 event_id가 없으면 `ViewContent.<content>.<session>` 같은 결정론적 event_id를 주입한다.
- 같은 event_id를 backend `/api/meta/capi/track`로 mirror할 수 있는 코드가 있다.
- live 설정은 서버 mirror off다.
- backend `sendFunnelEvent`는 event_id, event_source_url, fbc, fbp, content_ids, value, test_event_code를 Meta CAPI로 보낼 수 있다.
- `/api/meta/capi/track`는 origin, pixel id, event name, event_id를 검증한다.

## 아직 안 된 것

아직 운영 완료로 보면 안 되는 것은 아래다.

- 중간 퍼널 `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`의 server CAPI mirror 운영 전송.
- Meta Test Events 탭에서 Browser/Server 같은 event_id dedup 확인.
- `AddPaymentInfo` wrap race 원인 확정.
- Purchase Browser/Server dedup과 Event Match Quality의 Meta UI 최종 캡처.
- Meta `marketing_intent` 운영 저장. core 로직은 Meta first-touch를 인식하지만, `/api/attribution/marketing-intent` receiver는 현재 TikTok evidence 중심으로 저장한다.
- `external_id`를 어떤 값으로 넣을지 결정.
- 체류시간/스크롤 custom event 설계와 승인.

## 막힌 이유

현재 병목은 코드보다 운영 검증 화면과 승인 경계다.

Meta Events Manager UI는 로그인, 2FA, 계정 권한이 필요하다.
Codex가 로컬 코드와 로그는 확인할 수 있지만, Events Manager에서 dedup 상태와 Event Match Quality를 직접 확정하기는 어렵다.

또한 중간 퍼널 CAPI는 호출하면 실제 Meta 플랫폼으로 전송되는 경로다.
따라서 운영 송출은 승인 없이 켜면 안 된다.
지금 가능한 안전한 다음 단계는 `test_event_code`를 붙인 Test Events smoke다.

## Phase1-Sprint1

**이름**: Purchase Guard와 Purchase CAPI 안정화

**목표**: 실제 결제 완료 주문만 Meta `Purchase`로 보내고, 가상계좌 미입금 같은 미확정 주문은 `Purchase`로 잡히지 않게 한다.

**완료한 것**:

- 서버 상태 조회형 Purchase Guard v3 작성.
- 카드 결제 confirmed는 `allow_purchase`.
- 가상계좌 pending은 `block_purchase_virtual_account`.
- pending 차단 후 `VirtualAccountIssued` custom event 전송.
- Server Purchase CAPI event_id를 Browser Pixel과 맞추는 규칙 반영.
- 운영 VM CAPI 로그상 Purchase 1,255건 성공 기록 확인.

**남은 것**:

- Meta Events Manager에서 Browser/Server dedup 상태를 직접 확인한다.
- Event Match Quality와 Advanced Matching Parameters를 캡처한다.
- custom `Refund` 수신 여부도 같이 본다.

**쉬운 설명**:

이 Sprint는 "돈을 실제로 받은 주문만 Meta 구매로 인정한다"는 안전장치다.
이게 없으면 Meta ROAS가 가상계좌 미입금 같은 허수 주문까지 먹고 부풀 수 있다.

**▲ 요약표로**: [[#Phase-Sprint 요약표]]

## Phase1-Sprint2

**이름**: 브라우저 event_id 주입

**목표**: aimweb이 보내는 구매 전 이벤트에 event_id를 붙여서, 나중에 서버 CAPI와 같은 이벤트로 묶일 수 있게 한다.

**완료한 것**:

- `funnel-capi v3`가 `window.fbq`를 wrap한다.
- `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`가 mirror 대상이다.
- `Purchase`는 mirror 대상에서 제외했다. Purchase는 Purchase Guard가 단독 관리한다.
- `ViewContent` event_id 주입은 실측으로 확인됐다.
- 서버 mirror는 disabled 상태로 유지했다.

**남은 것**:

- AddToCart, InitiateCheckout, AddPaymentInfo 각각의 실제 event_id 주입 로그를 다시 확인한다.
- 같은 세션에서 event_id가 과도하게 재사용되거나 중복 발사되지 않는지 본다.

**쉬운 설명**:

브라우저 이벤트와 서버 이벤트가 같은 주민등록번호 같은 값을 가져야 Meta가 "아, 같은 행동이구나"라고 합칠 수 있다.
그 주민등록번호 역할이 event_id다.

**▲ 요약표로**: [[#Phase-Sprint 요약표]]

## Phase2-Sprint3

**이름**: 중간 퍼널 서버 mirror Test Events

**목표**: 구매 전 이벤트를 서버 CAPI로도 보내되, 운영 카운트에 바로 섞지 않고 Meta Test Events 탭에서만 검증한다.

**2026-05-05 준비 상태**:

- smoke payload, 이벤트별 확인 포인트, 성공/실패 기준을 [[capivm/meta-funnel-capi-test-events-smoke-plan-20260505]]에 분리했다.
- 실제 Meta Test Events 전송은 하지 않았다.
- 아임웹 footer/stage 적용, GTM Preview/Publish, backend deploy, 운영 CAPI ON은 별도 승인 전까지 금지다.

**실행 순서**:

1. Meta Events Manager에서 biocom pixel/dataset `1283400029487161`의 Test Events code를 발급한다.
2. 로컬 `backend/.env` 또는 실행 환경에 `META_EVENT_CODE_BIOCOM`으로 Test Events code를 넣는다.
3. `cd backend && npx tsx scripts/render-funnel-capi-test-footer.ts --site biocom`으로 `/tmp/biocom_footer_0415_final3_stage1_test_events.md`를 만든다.
4. 생성 파일은 repo에 커밋하지 않는다. test code 원문이 들어간 stage 파일이기 때문이다.
5. 설정은 `enableServerCapi=true`, `testEventCode=TEST...`, `debug=true`다.
6. 상품 페이지 3~5개를 방문한다.
7. 장바구니, 주문서 진입, 결제정보 단계가 가능한 흐름을 한 번씩 돈다.
8. Events Manager Test Events 탭에서 Browser와 Server가 같은 event_id로 보이는지 확인한다.
9. dedup 또는 diagnostics 경고가 있으면 운영 ON을 보류한다.

**성공 기준**:

- `ViewContent`가 Browser와 Server 양쪽으로 보인다.
- `event_id`가 같다.
- Test Events 탭에서 dedup 또는 같은 이벤트 묶음으로 해석된다.
- 운영 이벤트 카운트에 별도 오염이 없다.
- backend `/api/meta/capi/log`에 `send_path=test_event`와 test code가 남는다.

**실패 기준**:

- Server만 보이거나 Browser만 보인다.
- event_id가 다르다.
- AddPaymentInfo가 아예 잡히지 않는다.
- Diagnostics에 중복 또는 match quality 문제가 뜬다.

**▲ 요약표로**: [[#Phase-Sprint 요약표]]

## Phase2-Sprint4

**이름**: AddPaymentInfo wrap race 확인

**목표**: aimweb이 AddPaymentInfo를 너무 빨리 쏴서 funnel-capi가 event_id를 못 붙이는지 확인한다.

**현재 증상**:

- Events Manager에는 `AddPaymentInfo https://biocom.kr/HealthFood/?idx=386` 형태가 보였다.
- 그러나 2026-04-15 테스트 세션에서는 `[funnel-capi] inject eid AddPaymentInfo ...` 로그가 없었다.

**가능한 원인**:

- aimweb이 funnel-capi wrap 이전에 AddPaymentInfo를 발화했다.
- 특정 상품 또는 결제 흐름에서만 AddPaymentInfo가 발화된다.
- Pixel Helper나 Events Manager 표시가 지연되어 콘솔 로그와 같은 세션이 아닐 수 있다.

**확인 방법**:

- 상품 페이지 로드 직후 Console에서 `window.fbq.__FUNNEL_CAPI_V3_WRAPPED__`가 `true`인지 본다.
- Network에서 `facebook.com/tr` 요청 중 `ev=AddPaymentInfo`의 발화 시각을 본다.
- 그 요청이 wrap 완료보다 빠르면 head 이동 또는 더 이른 설치를 검토한다.
- wrap 완료 후 발화됐는데도 inject 로그가 없으면 payload 형식이나 event name casing을 확인한다.

**▲ 요약표로**: [[#Phase-Sprint 요약표]]

## Phase3-Sprint5

**이름**: 랜딩 시점 marketing_intent 보존

**목표**: 결제 완료 페이지에 광고 파라미터가 남지 않아도, 랜딩 시점의 Meta 클릭 증거를 나중에 주문과 연결한다.

**완료한 것**:

- core attribution 로직은 Meta first-touch 후보를 인식한다.
- `fbclid`, `_fbc`, `_fbp`, Facebook/Instagram referrer, Meta/Facebook/Instagram UTM을 Meta 증거로 볼 수 있다.
- 테스트에서는 Meta `marketing_intent -> payment_success` first-touch 연결이 통과했다.

**중요한 한계**:

- 운영 receiver `/api/attribution/marketing-intent`는 현재 strict TikTok evidence가 없으면 저장하지 않는다.
- 따라서 Meta 랜딩 intent가 운영에서 실제로 쌓인다고 보면 안 된다.
- Meta용 intent 저장을 열려면 receiver 조건과 GTM Preview 계획이 따로 필요하다.

**남은 것**:

- Meta용 `marketing_intent` receiver 허용 조건을 설계한다.
- 저장 필드는 `fbclid`, `_fbc`, `_fbp`, UTM 6종, landing URL, referrer, GA client/session id, captured_at으로 잡는다.
- direct 방문이나 내부 배너가 Meta first-touch를 덮어쓰지 못하게 한다.
- GTM Preview 후 Production publish는 별도 승인으로 둔다.

**▲ 요약표로**: [[#Phase-Sprint 요약표]]

## Phase3-Sprint6

**이름**: 체류시간/스크롤 커스텀 신호 판단

**목표**: 표준 이벤트 외에 체류시간이나 스크롤을 Meta에 보낼 가치가 있는지 판단한다.

**현재 결론**:

내부 분석용 설계는 완료했다.
정본 설계안은 [[GA4/gtm-engagement-internal-analysis-design-20260504]]다.
다만 Meta CAPI 운영 송출은 여전히 보류다.
체류시간과 스크롤은 현재 capi 문서와 코드에서 운영 구현된 범위가 아니며, 품질 기준을 잘못 잡으면 Meta에 "구매 가능성이 높은 행동"이 아니라 "그냥 페이지를 오래 켠 행동"을 학습시킬 수 있다.

**검토 의견**:

체류시간과 스크롤 깊이는 내부 분석 지표로는 유효하다.
상품 페이지를 3초 보고 나간 사람과 60초 이상 읽고 75%까지 스크롤한 사람은 구매 의도가 다를 가능성이 크다.
따라서 내부 원장에는 `engaged_view`, `scroll_75`, `qualified_product_view` 같은 보조 행동으로 남기는 것을 추천한다.

하지만 Meta CAPI 운영 전환 이벤트로 바로 보내는 것은 추천하지 않는다.
이유는 세 가지다.

- 체류시간/스크롤은 구매 의도가 아니라 콘텐츠 소비를 측정할 수 있다.
- 기준을 낮게 잡으면 이벤트 수가 너무 많아져 `Purchase`, `InitiateCheckout`, `AddToCart`보다 신호 품질이 흐려진다.
- 건강기능식품 상품군에서는 민감한 관심사 추정처럼 보이지 않도록 이벤트명과 custom data를 보수적으로 잡아야 한다.

따라서 순서는 `내부 분석용 수집 설계 -> backend dry-run contract -> GTM Preview smoke -> 7~14일 주문 연결 검증 -> Meta Test Events custom event -> 운영 CAPI 송출 판단`으로 가는 것이 맞다.
운영 캠페인 최적화 목표로 쓰는 것은 마지막 단계다.

**진행 조건**:

- 표준 4개 이벤트의 Test Events dedup 검증이 끝난다.
- 이벤트명을 표준 이벤트와 섞지 않는다.
- custom event로만 테스트한다.
- value를 매출처럼 넣지 않는다.
- 운영 캠페인 최적화 이벤트로 쓰기 전에 별도 승인한다.

**후보 예시**:

- `EngagedView`: 상품 페이지 30초 이상 체류와 50% 이상 스크롤이 동시에 충족된 경우.
- `ProductScrollDepth`: 상품 페이지 75% 이상 스크롤.

**현재 추천**:

- 내부 분석용 로컬/VM 원장 수집: 추천도 72%.
- Meta Test Events custom event smoke: 추천도 45%.
- Meta 운영 CAPI 송출 또는 캠페인 최적화 이벤트 사용: 추천도 25%.

지금은 표준 퍼널 이벤트를 먼저 닫고, 체류시간/스크롤은 내부 분석용으로만 설계하는 것이 맞다.

**▲ 요약표로**: [[#Phase-Sprint 요약표]]

## 운영 금지선

이번 문서 작성과 검토에서 하지 않은 것은 아래다.

- 운영 DB write를 하지 않았다.
- GTM Production publish를 하지 않았다.
- 아임웹 헤더/푸터 운영 코드를 바꾸지 않았다.
- Meta CAPI 운영 전송을 새로 발생시키지 않았다.
- GA4/Meta/Google/TikTok 전환값을 바꾸지 않았다.
- 중간 퍼널 CAPI `enableServerCapi=true` 운영 모드를 켜지 않았다.

앞으로도 아래는 별도 승인 전 금지다.

- `testEventCode=''` 상태로 중간 퍼널 server mirror ON.
- Meta용 `marketing_intent` Production publish.
- 체류시간/스크롤 custom event 운영 송출.
- Advanced Matching `external_id` 운영 적용.
- Events Manager AEM 우선순위 변경.

## 확인 근거

문서 근거:

- `capivm/capi.md`: 2026-04-15 biocom footer `biocom_footer_0415_final3.md` 배포, `enableServerCapi=false`, ViewContent event_id 주입 확인, AddPaymentInfo 미해결 이슈 기록.
- `capivm/capi4reply.md`: Purchase Guard v3가 `FB_PIXEL.Purchase`와 `fbq('track','Purchase')`를 모두 감싸는 구조 기록.
- `data/!datacheckplan.md`: 2026-05-04 기준 Purchase CAPI 성공 로그와 중간 퍼널 CAPI test-only 상태 기록.

코드 근거:

- `footer/biocom_footer_0415_final3.md`: `FUNNEL_CAPI_CONFIG`, `MIRROR_EVENTS`, `enableServerCapi=false`, `server skipped (disabled)` 로직.
- `backend/src/routes/meta.ts`: `/api/meta/capi/track` origin/pixel/event whitelist와 `AddPaymentInfo` 허용.
- `backend/src/metaCapi.ts`: `sendFunnelEvent`, `sendMetaConversion`, Purchase event_id 생성, Advanced Matching 기본 필드.
- `backend/src/routes/attribution.ts`: `/api/attribution/marketing-intent` receiver의 현재 TikTok evidence gate.
- `backend/src/attribution.ts`: Meta first-touch match reason과 payment_success 연결 로직.
- `backend/tests/attribution.test.ts`: Meta `marketing_intent -> payment_success` first-touch 테스트와 CAPI event_id 안정화 테스트.

## 변경 이력

- 2026-05-04 23:28 KST: `capi`, `capi4reply`, `data/!datacheckplan`, 실제 코드 기준으로 메타 퍼널 CAPI 진행상황과 계획을 정본 문서로 신규 작성.
- 2026-05-05 02:05 KST: [[capivm/meta-funnel-capi-test-events-smoke-plan-20260505]] 링크와 준비 상태 반영. 실제 Test Events 전송은 아직 하지 않았고, 실행은 별도 승인 게이트로 유지.
