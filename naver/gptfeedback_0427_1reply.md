# GPT 피드백 0427-1 검토 회신

작성 시각: 2026-04-27 12:45 KST
최종 업데이트: 2026-04-27 18:18 KST
기준일: 2026-04-27
대상 문서: `naver/gptfeedback_0427_1.md`
검토자: Codex
Confidence: 91%

## 10초 요약

피드백의 큰 방향은 맞다. 지금은 네이버페이 버튼 클릭을 구매로 보내면 안 되고, 먼저 `intent`만 안전하게 저장한 뒤 실제 주문 원장과 붙는지 확인해야 한다.

확신 85% 이상인 항목은 바로 반영했다. 반영 범위는 `intent_key` 중복 방지 수정, `_ga` 원본 저장, `page_location` 개인정보 제거, 조회 API 보호, GTM `[118]` 초안 보강이다.

아직 live publish 단계는 아니다. 2026-04-27 14:57 KST TJ Preview 클릭에서 intent 저장은 성공했지만, 1회 클릭이 2건으로 저장됐고 `ga_session_id`가 비어 있었다.

2026-04-27 18:18 KST 기준 intent-only live publish와 live smoke까지 통과했다. 백엔드는 30초 lookback dedupe를 운영 VM에 재배포했고, GTM tag 118은 live version 139로 publish했다. 18:16 KST live smoke에서 최신 intent는 1건만 저장됐고 `environment=live`, `ga_session_id=1777281391`, `product_idx=423`이 채워졌다. 다음 병목은 24시간 수집 품질 확인과 7일 NPay 주문 매칭 dry-run이다.

## 반영한 것

| 항목 | 파일/API | 처리 |
|---|---|---|
| 랜덤 `gtm_event_id` 기반 dedupe 제거 | `backend/src/npayIntentLog.ts` | 세션, 페이지, 상품, 10초 bucket 기준 deterministic key로 변경 |
| GA client_id 포맷 정리 | `backend/src/npayIntentLog.ts`, `naver/!npay.md` | `client_id`는 prefix 제거값, `ga_cookie_raw`는 원본 `_ga`로 분리 |
| URL 개인정보 제거 | `backend/src/npayIntentLog.ts` | `page_location`, `page_referrer` 저장 전 query whitelist 적용 |
| intent 조회 API 보호 | `backend/src/routes/attribution.ts` | 운영에서는 `NPAY_INTENT_ADMIN_TOKEN` 또는 `AIBIO_NATIVE_ADMIN_TOKEN` 필요 |
| 토큰 설정 예시 | `backend/.env.example` | `NPAY_INTENT_ADMIN_TOKEN` 추가 |
| GTM 초안 보강 | `naver/npay-intent-beacon-gtm118.md` | Preview/Live 모드 분리, 상품 fallback, 저장된 캠페인값 보조 수집, member_code probe 추가 |
| GTM 태그 118 Preview 코드 보정 | GTM Default Workspace(147), tag 118 | 기존 Hurdlers HTML 유지, `SEO NPay intent beacon` marker 블록 유지, `ga_session_id` 정규식 실제 반영. quick_preview 통과. live publish 안 함 |
| 정본 문서 업데이트 | `naver/!npay.md` | 이번 피드백 반영 상태와 다음 확인 기준 추가 |

## 검증 결과

| 검증 | 결과 |
|---|---|
| TypeScript typecheck | 통과: `npm --prefix backend run typecheck` |
| Backend build | 통과: `npm --prefix backend run build` |
| 백엔드 재시작 | 완료: `localhost:7020` 새 빌드로 기동 |
| Health check | 통과: `GET /health` |
| `text/plain` POST | 통과: 신규 저장 201 |
| dedupe | 통과: 같은 payload 재전송 200 + `deduped: true` |
| URL sanitize | 통과: `phone`, `email`, `token`, hash 제거 확인 |
| 로컬 테스트 데이터 | 삭제 완료: smoke용 intent 행 제거 |
| GTM quick_preview | 통과: Workspace 147 tag 118 fingerprint `1777264285574`, `compilerError: false` |
| GTM 원인 격리 | 확인: 백업 상태는 `false`, 최초 beacon은 `true`, helper 함수들을 `try` 밖으로 이동하니 `false` |
| TJ GTM Preview 클릭 | 요청 발생 확인: `POST /api/attribution/npay-intent`, type `ping`, status 404 |
| 운영 endpoint 상태 | 404 확인: 운영 `seo-backend`가 살아 있지만 신규 route는 아직 미배포 |
| 운영 VM backend 배포 | 완료: backup 후 route 반영, PM2 restart, `/health` 200 |
| 운영 POST smoke | 완료: 201 확인 후 smoke row 삭제. `npay_intent_log` 총 0건 |
| 운영 조회 token | 완료: `NPAY_INTENT_ADMIN_TOKEN` 설정, token 포함 조회 200 |
| TJ Preview 재클릭 | 저장 성공: 14:57 KST 2건 201. 1회 클릭 대비 중복 저장, `ga_session_id` 공백 확인 |
| 서버 30초 dedupe 보강 | 완료: 운영 재배포 대상 diff 기준 반영, 4초 간격 중복 재현 테스트 통과 |
| GTM session_id 보정 | 완료: Workspace 147 tag 118 Preview 코드 실제 수정, quick_preview `compilerError: false` |
| 운영 VM dedupe 재배포 | 완료: backend 백업 후 PM2 `seo-backend` 재시작, `/health` 200 |
| 16:42 KST Preview 재검증 | 통과: 최신 row 1건, `ga_session_id=1777275745`, `ga_session_number=15` |
| 18:10 KST live publish | 완료: live version 139, Workspace 150 사용 |
| 18:16 KST live smoke | 통과: `environment=live`, `ga_session_id=1777281391`, `product_idx=423` |

## 항목별 판단

| 피드백 항목 | 판단 | 확신 | 조치 |
|---|---|---:|---|
| 지금 방향은 추가 문서보다 Preview 검증이 우선 | 맞음 | 92% | 문서에 다음 병목을 Preview 검증으로 정리 |
| 네이버페이 버튼 클릭은 purchase가 아니라 intent | 맞음 | 97% | purchase/GA4/Meta/Google Ads 전송은 열지 않음 |
| NPay 주문형을 바로 제거하면 안 됨 | 맞음 | 90% | 유지. 주문형 제거 판단은 뒤로 둠 |
| `sendBeacon` 선택은 적합 | 맞음 | 90% | 유지. 실패 시 `fetch keepalive` fallback 유지 |
| `environment: preview`, `debug_mode: true`는 live 전 수정 필요 | 맞음 | 92% | GTM 문서에 Preview/Live 값 분리 |
| `client_id` 예시가 `_ga` 원본과 섞여 있음 | 맞음 | 95% | `ga_cookie_raw` 필드 추가, 문서 예시 수정 |
| 랜덤 `gtm_event_id` 기반 intent key는 dedupe에 불리 | 맞음 | 98% | deterministic key로 코드 수정 |
| `text/plain` parser 확인 필요 | 맞음 | 95% | 로컬 smoke로 수신 확인 |
| `GET /npay-intents` 공개는 위험 | 맞음 | 93% | 운영 토큰 보호 추가 |
| `page_location` 원문 저장은 sanitize 필요 | 맞음 | 92% | 서버 저장 전 whitelist 적용 |
| 상품정보 추출은 Preview에서 확인 필요 | 맞음 | 88% | GTM 초안 fallback 추가. 실제 값 존재 여부는 Preview 필요 |
| UTM/gclid를 현재 URL에서만 읽는 것은 약함 | 대체로 맞음 | 88% | localStorage/sessionStorage 보조 조회와 `_gcl_aw`, `_gcl_dc` raw 수집 추가. 실제 저장 위치는 Preview 필요 |
| `member_code` 수집 가능성 확인 필요 | 보류 | 72% | safe probe는 추가했지만 실제 전역 변수 존재 여부는 현장 Preview 필요 |
| GA4 MP purchase에는 실제 `client_id`, `session_id`가 필요 | 맞음 | 93% | Google 공식 문서 기준으로 purchase dispatcher는 아직 보류 |
| Meta CAPI Purchase는 GA4 안정화 후 | 맞음 | 86% | 아직 열지 않음 |
| Google Ads `[248]`는 마지막에 정리 | 맞음 | 90% | 아직 변경하지 않음 |

## 확신 85% 미만으로 보류한 것

### 1. `member_code` 실제 변수명

현재 확신은 72%다. 이유는 아임웹/허들러스가 실제 상품 상세 페이지에서 어떤 전역 변수명으로 회원 식별자를 노출하는지 확인하지 못했기 때문이다.

Codex가 한 일: `window.member_code`, `window.IMWEB_MEMBER_CODE`, `window.hurdlers_member_code`, `window.hurdlers_ga4.member_code`, `window.hurdlers_ga4.user_id`를 안전하게 probe하도록 GTM 초안에 넣었다.

필요한 데이터: GTM Preview 또는 브라우저 콘솔에서 실제 payload의 `member_code` 값 존재 여부.

### 2. 광고 클릭값의 기존 저장 위치

현재 확신은 78%다. URL만 보는 것이 약하다는 피드백은 맞지만, 기존 footer 또는 Hurdlers가 `gclid`, UTM을 정확히 어디에 저장하는지는 아직 확인하지 못했다.

Codex가 한 일: URL, localStorage, sessionStorage를 같이 보도록 GTM 초안을 보강했고, `_gcl_aw`, `_gcl_dc`는 raw payload에 남기도록 했다.

필요한 데이터: 광고 유입 후 페이지 이동을 거친 실제 브라우저에서 `gclid`, `gbraid`, `wbraid`, UTM이 payload에 남는지 확인.

### 3. 운영 endpoint 배포 상태

현재 확신은 97%다. 로컬 7020은 검증했고, 운영 `https://att.ainativeos.net` 배포 후 `POST /api/attribution/npay-intent` smoke가 201을 반환했다. 이후 운영 `.env`에 `NPAY_INTENT_ADMIN_TOKEN`을 설정했고, token 포함 `GET /api/attribution/npay-intents`는 200을 반환한다. token 없는 조회는 403이다.

Codex가 한 일: 로컬 새 빌드로 재시작하고 smoke를 완료했다. 운영 VM backend 백업, 파일 반영, PM2 restart, dependency sync, endpoint smoke를 완료했다.

필요한 데이터: TJ Preview 재클릭으로 실제 브라우저 payload가 201/200을 반환하는지 확인. 이후 조회 API로 최신 row의 `client_id`, `ga_session_id`, `product_idx`, `product_name` 품질 확인.

## 공식 문서 확인

- MDN은 `navigator.sendBeacon()`이 작은 분석 데이터를 비동기 POST로 보내는 용도이며, 페이지 이동을 지연시키지 않는다고 설명한다. 그래서 NPay 외부 결제 이동 직전 intent 저장에는 적합하다. 참고: [MDN sendBeacon](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)
- Google은 GA4 Measurement Protocol에서 특정 세션 속성으로 붙이려면 `session_id`를 포함하고 세션 시작 후 24시간 이내 전송해야 한다고 설명한다. 그래서 서버 purchase dispatcher는 intent의 실제 `client_id`, `ga_session_id` 없이는 열면 안 된다. 참고: [GA4 Measurement Protocol use cases](https://developers.google.com/analytics/devguides/collection/protocol/ga4/use-cases)

## 최종 판단

`YES`: endpoint smoke, GTM `[118]` Preview, intent-only 수집 검증

`NO`: GTM live publish, GA4 purchase 전송, Meta CAPI Purchase 전송, Google Ads `[248]` 변경, NPay 주문형 전체 제거

추천안은 `서버 30초 dedupe 보강 + GTM session_id 정규식 보강 → Preview 재클릭 → intent-only live publish 승인 여부 판단`이다. 현재 결과만으로 live publish는 아직 NO다.

## 2026-04-27 14:57 KST Preview 판정

TJ님이 네이버페이 버튼을 1회 클릭했다고 보고했다. 운영 조회 결과는 아래와 같다.

| 항목 | 결과 |
|---|---|
| 저장 상태 | 성공 |
| 저장 건수 | 2건 |
| captured_at | 2026-04-27 14:57:16 KST, 14:57:20 KST |
| status | 둘 다 201 |
| 상품 | `423`, `팀키토 저포드맵 도시락 7종 골라담기`, 8,900원 |
| page | `https://biocom.kr/DietMealBox/?idx=423` |
| client_id | 있음 |
| ga_cookie_raw | 있음 |
| ga_session_id | 없음 |
| ga_session_number | `14` |

판단: 저장 endpoint는 성공했다. 다만 live publish 전 보강이 필요하다. 1회 클릭이 2건으로 저장된 것은 trigger 또는 네이버페이 버튼 흐름에서 같은 intent가 두 번 보내진 것이다. 또한 `ga_session_number`는 잡히는데 `ga_session_id`가 빈 값인 것은 GA4 `GS2.1.s...$o...` 쿠키 포맷에서 `.` 뒤의 `s`를 현재 정규식이 못 잡는 문제로 본다.

조치:

| 조치 | 상태 |
|---|---|
| 서버 dedupe를 30초 lookback으로 보강 | 로컬 수정 + 임시 DB 검증 통과 |
| GTM `getGaSessionId()` 정규식 보강 | GTM Workspace 147 tag 118 Preview 코드에 실제 반영 완료 |
| live publish | 아직 NO |

검증:

| 검증 | 결과 |
|---|---|
| TypeScript typecheck | 통과 |
| Backend build | 통과 |
| dedupe 재현 테스트 | 동일 클릭 4초 간격 2회 입력 시 1건 저장, `duplicate_count=1` |

## 2026-04-27 16:00 KST 보강 완료 판정

### 1. 백엔드 dedupe 보정

운영 배포 대상 코드는 30초 안에 들어온 같은 intent를 새 행으로 만들지 않는다. 같은 intent 판단 기준은 아래다.

| 기준 | 설명 |
|---|---|
| `site`, `source` | 바이오컴 NPay intent인지 구분 |
| `client_id` 또는 `ga_cookie_raw` | GA 세션 ID가 비어도 같은 브라우저를 묶기 위한 fallback |
| `ga_session_id` | 값이 있으면 세션 단위 정밀도 상승 |
| `page_location`, `product_idx`, `product_name` | 같은 상품/상세페이지 클릭인지 판단 |
| `user_agent_hash`, `ip_hash` | 같은 브라우저/네트워크에서 발생한 근접 중복인지 보조 판단 |
| `captured_at ± 30초` | 10초 bucket 경계 문제 제거 |

검증 결과는 `첫 요청 201`, `두 번째 요청 200 deduped true`, `row 1건`, `duplicate_count 1 증가`다. 다른 상품이나 다른 `client_id`는 별도 row로 저장되는 것도 확인했다.

### 2. GTM `[118]` session_id 보정

문서 수정이 아니라 실제 GTM Default Workspace(147)의 tag 118 Preview 코드에 반영했다.

| 항목 | 결과 |
|---|---|
| 수정 정규식 | `/(?:^|[.$])s(\d+)/` |
| 목적 | `_ga_WJFXN5E2Q1=GS2.1.s177...$o14...` 같은 포맷에서 `s177...`를 `ga_session_id`로 추출 |
| quick_preview | `compilerError: false` |
| fingerprint | `1777272925667` |
| purchase 전송 | 추가 없음 |
| live publish | 안 함 |

### 3. 운영 재배포

| 항목 | 결과 |
|---|---|
| 배포 대상 | VM `instance-20260412-035206`, PM2 `seo-backend` |
| 백업 | `/home/biocomkr_sns/seo/backups/backend-20260427-065715-npay-dedupe-sessionid` |
| 반영 | `DUPLICATE_LOOKBACK_MS`, `gaCookieRaw` 기반 dedupe 포함 |
| PM2 | `seo-backend` restart + save 완료 |
| health | 2026-04-27 16:00 KST `GET https://att.ainativeos.net/health` 200 |
| 기존 14:57 row | 그대로 보존. 과거 2건을 병합/삭제하지 않음 |

## 다음 재검증 요청

TJ님이 해야 할 일은 하나다.

| 담당 | 무엇을 하는가 | 왜 하는가 | 어떻게 하는가 | 성공 기준 |
|---|---|---|---|---|
| TJ | 같은 상품에서 GTM Preview NPay 버튼을 1회 다시 클릭 | 백엔드 dedupe와 GTM `ga_session_id` 보정이 실제 브라우저에서 동시에 맞는지 확인 | live publish 없이 Preview 상태에서 `팀키토 저포드맵 도시락 7종 골라담기` 또는 같은 NPay 상품의 버튼을 1회 클릭하고 결제는 완료하지 않는다 | 최종 저장 row 1건, 중복 호출 시 두 번째는 200 `deduped: true`, `duplicate_count=1`, `ga_session_id` 값 있음 |

Codex가 할 일은 TJ님 클릭 직후 최신 intent를 조회해 `client_id`, `ga_session_id`, `ga_session_number`, `product_idx`, `product_name`, `duplicate_count`를 판정하는 것이다.

## 2026-04-27 16:42 KST Preview 재검증 판정

TJ님이 같은 상품에서 NPay 버튼을 1회 클릭했다. 최신 intent 조회 결과는 아래다.

| 항목 | 결과 | 판단 |
|---|---|---|
| captured_at | 2026-04-27 16:42:34 KST | 클릭 시각과 일치 |
| 저장 row | 최신 1건 | 통과 |
| environment | `preview` | 의도한 상태 |
| duplicate_count | 0 | 이번 클릭은 중복 저장 없음 |
| client_id | `395345677.1775926422` | 정상 |
| ga_cookie_raw | `GA1.1.395345677.1775926422` | 정상 |
| ga_session_id | `1777275745` | 정상 |
| ga_session_number | `15` | 정상 |
| product_idx | `423` | 정상 |
| product_name | `팀키토 저포드맵 도시락 7종 골라담기` | 정상 |
| product_price | 8,900원 | 정상 |
| page_location | `https://biocom.kr/DietMealBox/?idx=423` | 정상 |
| page_referrer | `https://biocom.kr/supplements` | 정상 |
| member_code | 빈 값 | 실패 조건 아님 |

네이버페이의 `단체회원은 이용 불가합니다` 안내는 이번 검증에는 문제가 아니다. 이 단계는 결제 성공 검증이 아니라 버튼 클릭 시점의 intent와 GA 세션 정보 저장 검증이다.

판정: `YES`, Preview 검증은 통과. 다음 권장 단계는 `intent-only live publish` 승인안 작성이다. 단, purchase 전송, Meta CAPI Purchase, Google Ads 전환 변경은 아직 `NO`다.

## 2026-04-27 18:18 KST Live Publish 판정

TJ님 승인 조건대로 publish 직전 체크를 수행했다. 단, Default Workspace 147은 stale 상태라 publish하지 않았다. live v138 기준 새 Workspace 150을 만들고 tag 118만 반영했다.

| 항목 | 결과 |
|---|---|
| live version | `139`, `npay_intent_only_live_20260427` |
| workspace 변경 | Workspace 150에서 tag 118만 updated |
| merge conflict | 0건 |
| quick_preview | `compilerError: false` |
| purchase 코드 | tag 118 beacon block 안에 GA4 purchase, Meta Purchase, Google Ads conversion call 없음 |
| tag 43 | `add_payment_info` 유지 |
| tag 48 | paused 유지 |

Live smoke:

| 항목 | 결과 |
|---|---|
| environment | `live` |
| ga_session_id | `1777281391` |
| ga_session_number | `1` |
| product_idx | `423` |
| product_name | `팀키토 저포드맵 도시락 7종 골라담기` |
| GA4 purchase | 관측 없음 |
| Meta Purchase | 관측 없음 |
| Google Ads | 기존 page_view/config 계열 호출만 관측 |

판정: `YES`, intent-only live publish 성공. 다음은 purchase dispatcher가 아니라 24시간 수집 품질 확인과 7일 매칭 dry-run이다.
