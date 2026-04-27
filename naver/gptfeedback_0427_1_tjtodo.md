# TJ 할일: NPay Intent Preview 확인

작성 시각: 2026-04-27 13:31 KST
업데이트: 2026-04-27 13:39 KST Preview 클릭 결과 반영
추가 업데이트: 2026-04-27 13:47 KST 운영 backend 배포 결과 반영
추가 업데이트: 2026-04-27 14:01 KST 운영 조회 token 설정 완료
추가 업데이트: 2026-04-27 14:57 KST Preview 재클릭 결과 반영
추가 업데이트: 2026-04-27 16:00 KST dedupe 운영 재배포와 GTM session_id Preview 코드 보정 완료
추가 업데이트: 2026-04-27 16:42 KST Preview 재검증 통과
추가 업데이트: 2026-04-27 18:18 KST intent-only live publish와 smoke 통과
기준일: 2026-04-27
대상: `naver/gptfeedback_0427_1.md` 후속 실행
담당: TJ + Codex
Confidence: 86%

## 10초 요약

Codex가 2026-04-27 13:06 KST에 GTM `[118] HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)` 태그에 NPay intent beacon 초안을 넣었고, 13:31 KST에 `quick_preview compilerError: false` 상태까지 수정했다. 위치는 `Default Workspace(147)`이고, live publish는 하지 않았다.

TJ님이 GTM Preview에서 실제 네이버페이 버튼 클릭 1건을 확인했다. Network에 `POST https://att.ainativeos.net/api/attribution/npay-intent` 요청이 잡혔고, type은 `ping`, status는 404였다.

추천은 `24시간 수집 품질 확인 후 7일 매칭 dry-run으로 넘어가는 것`이다. 14:57 KST 결과는 GTM beacon이 버튼 클릭에서 발화되고 운영 DB에 저장된다는 점을 증명했다. 이후 Codex가 1회 클릭 2건 저장 문제와 `ga_session_id` 공백 문제를 보강했다. 16:42 KST 재검증에서는 최신 intent가 1건만 저장됐고 `ga_session_id`도 채워졌다. 18:10 KST에는 live version 139로 intent-only publish를 완료했고, 18:16 KST live smoke도 통과했다.

## Codex가 방금 처리한 것

| 항목 | 결과 |
|---|---|
| GTM 컨테이너 | `accounts/4703003246/containers/13158774` |
| 워크스페이스 | `Default Workspace(147)` |
| 수정 태그 | `[118] HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)` |
| 처리 방식 | 기존 Hurdlers HTML은 유지하고, `SEO NPay intent beacon start/end` marker 블록으로 초안 추가 |
| 모드 | `environment: "preview"`, `debug_mode: true` |
| publish | 안 함 |
| 백업 | `.codex-backups/gtm-20260427-npay-intent/tag118-before-2026-04-27T04-06-33-677Z.json` |
| 추가 백업 | `.codex-backups/gtm-20260427-npay-intent/tag118-before-fixed-2026-04-27T04-31-23-247Z.json` |
| 원인 확인 | 백업 상태 임시 Workspace는 `compilerError: false`, 최초 beacon 추가 상태는 `true`였다 |
| 원인 | 삽입 위치가 아니라 `try { function ... }` 형태의 블록 안 함수 선언이 GTM 컴파일러와 충돌 |
| 수정 | beacon helper 함수들을 `try` 밖 IIFE 최상단으로 이동 |
| 검증 | `quick_preview compilerError: false`, endpoint 포함, preview 모드 포함, `gtag('event','purchase')` 없음, 기존 Hurdlers 이벤트 유지, script open/close 2:2 |
| 임시 워크스페이스 | 테스트용 `Workspace(149)` 생성 후 삭제 완료 |
| session_id 보정 | Workspace 147 tag 118 Preview 코드에 `/(?:^|[.$])s(\\d+)/` 반영 |
| session_id quick_preview | 2026-04-27 15:56 KST `compilerError: false`, fingerprint `1777272925667` |
| backend dedupe 운영 재배포 | 2026-04-27 15:58 KST `seo-backend` 재시작, health 200 |

## TJ님이 할 일

| 순서 | 담당 | 상태 | 무엇을 하는가 | 왜 하는가 | 어떻게 하는가 | Codex가 못 하는 이유 | 성공 기준 |
|---:|---|---|---|---|---|---|---|
| 1 | Codex | 완료 | `[118]` 태그에 초안을 넣고 quick_preview를 통과시킨다 | 기존 purchase 오염 없이 intent만 보낼 수 있는지 확인한다 | GTM API로 Default Workspace(147)의 태그 118 HTML에 marker 블록 추가 후 helper 함수 위치 수정 | 처리 완료 | `quick_preview compilerError: false` |
| 2 | TJ | 완료 | GTM Preview를 연다 | 운영 배포 없이 태그가 실제 버튼에서만 실행되는지 봐야 한다 | Google Tag Manager에서 바이오컴 컨테이너 Preview 실행 | GTM 로그인 세션과 브라우저 Preview 권한이 필요하다 | Preview 연결 완료 |
| 3 | TJ | 완료 | 네이버페이 버튼을 1회 클릭한다 | 실제 버튼 selector와 외부 결제 이동 직전 beacon 동작을 확인해야 한다 | 상품 상세 페이지에서 NPay 버튼 클릭 후 결제 완료는 하지 않는다 | 실제 브라우저, 쿠키, GTM Preview 세션이 필요하다 | Network에 `POST /api/attribution/npay-intent` 확인. 응답 404 |
| 4 | Codex | 완료 | 운영 VM backend에 신규 route를 배포한다 | 현재 404는 운영 backend 미배포로 판단된다 | `seo-backend`에 로컬에서 검증된 `npay-intent` route 포함 빌드를 반영하고 PM2 restart | 운영 배포는 승인 대상이다 | smoke POST 201 |
| 5 | TJ | 완료 | 배포 후 네이버페이 버튼을 1회 다시 클릭한다 | DB 저장과 payload 품질은 실제 Preview 브라우저에서 확인해야 한다 | 같은 GTM Preview에서 NPay 버튼 클릭, 실제 결제 완료는 하지 않음 | 실제 브라우저 쿠키와 Preview 세션 필요 | 2건 201 저장 |
| 6 | Codex | 완료 | 최신 intent 결과를 확인한다 | Codex가 payload 품질과 매칭 가능성을 판단해야 한다 | `GET /api/attribution/npay-intents?limit=5`에 운영 `x-admin-token`을 붙여 최신 intent 확인 | 저장 성공 후 가능 | 상품/페이지/client_id는 정상, `ga_session_id` 공백 |
| 7 | Codex | 완료 | 중복 저장과 session_id 추출을 보강한다 | 1회 클릭이 2건으로 저장되면 live publish 후 intent 수가 부풀고, `ga_session_id`가 없으면 GA4 세션 매칭력이 떨어진다 | 서버 dedupe 30초 lookback, GTM `GS2.1.s...` 정규식 보정 | 처리 완료 | 로컬 dedupe 검증 통과, GTM Workspace 반영, 운영 backend 재배포 |
| 8 | TJ | 완료 | 같은 상품에서 Preview NPay 버튼을 1회 다시 클릭한다 | 보강된 dedupe와 `ga_session_id` 추출이 실제 브라우저에서 맞는지 확인한다 | GTM Preview 상태에서 같은 상품 페이지의 NPay 버튼을 1회 클릭하고 결제는 완료하지 않는다. 클릭한 시각을 Codex에게 알려준다 | 실제 브라우저 쿠키와 Preview 세션이 필요하다 | 16:42 KST 최신 row 1건, `ga_session_id` 값 있음 |
| 9 | Codex | 완료 | intent-only live publish 승인안을 만든다 | Preview 검증은 통과했지만 운영 태그 반영은 별도 승인 대상이다 | purchase 전송 없음, `environment: live`, `debug_mode: false`, rollback 방식, 7일 매칭 리포트 계획을 YES/NO 안으로 제시 | 처리 완료 | TJ 승인 완료 |
| 10 | Codex | 완료 | intent-only live publish와 smoke를 진행한다 | 운영 traffic에서 intent가 쌓이는지 확인한다 | live v138 기준 새 Workspace 150 생성 후 tag 118만 publish, 버튼 1회 smoke | 처리 완료 | live version 139, latest row `environment=live` |
| 11 | Codex | 다음 | 24시간 수집 품질을 확인한다 | 운영 traffic에서 필수 필드가 안정적으로 들어오는지 봐야 한다 | intent row의 `client_id`, `ga_session_id`, `product_idx`, 중복률 집계 | Codex 가능 | fill rate 기준 충족 |
| 12 | Codex | 다음 | 7일 NPay 주문 매칭 dry-run을 만든다 | purchase dispatcher 가능성을 판단한다 | `npay_intent_log`와 confirmed NPay 주문을 시간/상품/session 기준으로 매칭 | Codex 가능 | matched/ambiguous/unmatched 리포트 |

## 2026-04-27 16:42 KST 재검증 결과

TJ님이 같은 상품에서 NPay 버튼을 1회 클릭했다. 네이버페이에서 `단체회원은 이용 불가합니다` 안내가 떴지만, intent 검증에는 문제가 아니다. 이 검증은 결제 성공이 아니라 버튼 클릭 직전의 브라우저/세션 정보를 저장하는 것이 목적이기 때문이다.

| 필드 | 결과 | 판단 |
|---|---|---|
| captured_at | 2026-04-27 16:42:34 KST | 클릭 시각과 일치 |
| 저장 row | 최신 1건 | 성공 |
| environment | `preview` | live publish 전 검증 상태 |
| duplicate_count | 0 | 이번에는 중복 호출이 저장되지 않음 |
| client_id | `395345677.1775926422` | 정상 |
| ga_cookie_raw | `GA1.1.395345677.1775926422` | 정상 |
| ga_session_id | `1777275745` | 정상. 14:57 KST 공백 문제 해결 |
| ga_session_number | `15` | 정상 |
| product_idx | `423` | 정상 |
| product_name | `팀키토 저포드맵 도시락 7종 골라담기` | 정상 |
| product_price | 8,900원 | 정상 |
| page_location | `https://biocom.kr/DietMealBox/?idx=423` | 정상 |
| page_referrer | `https://biocom.kr/supplements` | 정상 |
| member_code | 빈 값 | 로그인/회원 식별은 미확인. 실패 조건은 아님 |
| match_status | `pending` | 주문 매칭 전 상태로 정상 |

판정: Preview 성공이다. 다음 단계는 `intent-only live publish` 승인안 작성이다. 단, 이 단계에서도 GA4 purchase, Meta CAPI Purchase, Google Ads 전환 변경은 하지 않는다.

## 2026-04-27 18:16 KST Live Smoke 결과

Codex가 운영 상품 페이지에서 `.npay_btn_pay` 버튼을 1회 클릭했다. 결제 완료는 하지 않았다.

| 필드 | 결과 | 판단 |
|---|---|---|
| live version | `139`, `npay_intent_only_live_20260427` | 정상 |
| captured_at | 2026-04-27 18:16:44 KST | 정상 |
| environment | `live` | 정상 |
| duplicate_count | 0 | 정상 |
| client_id | `1759636711.1777281392` | 정상 |
| ga_session_id | `1777281391` | 정상 |
| ga_session_number | `1` | 정상 |
| product_idx | `423` | 정상 |
| product_name | `팀키토 저포드맵 도시락 7종 골라담기` | 정상 |
| page_location | `https://biocom.kr/DietMealBox/?idx=423` | 정상 |
| GA4 purchase | 관측 없음 | 정상 |
| Meta Purchase | 관측 없음 | 정상 |
| Google Ads | 기존 page_view/config 계열 호출만 관측 | 구매 전환 변경 없음 |

## Preview 때 꼭 확인할 값

| 필드 | 왜 필요한가 | YES 기준 |
|---|---|---|
| `client_id` | GA4 Measurement Protocol purchase 복구 시 원래 브라우저 세션에 붙이기 위해 필요 | `GA1.1.` prefix가 없는 숫자 두 덩어리 형태 |
| `ga_cookie_raw` | client_id 추출이 맞는지 대조하기 위해 필요 | `GA1.1...` 원본 쿠키값 |
| `ga_session_id` | GA4 세션 attribution에 필요 | 빈 값 아님 |
| `product_idx` | NPay 주문과 클릭 intent를 상품 기준으로 매칭하기 위해 필요 | 빈 값 아님 |
| `product_name` | 상품명 보조 매칭과 사람이 보는 검수에 필요 | 빈 값 아님 |
| `page_location` | 어떤 상품/랜딩에서 눌렀는지 확인하기 위해 필요 | 전화번호, 이메일, token 같은 query가 빠져 있음 |
| `member_code` | 있으면 주문 매칭 신뢰도가 크게 올라감 | 있으면 좋음. 없으면 실패는 아님 |

## Codex가 이미 확인한 것

| 항목 | 결과 |
|---|---|
| 로컬 백엔드 수신점 | 확인 완료 |
| `text/plain` body 수신 | 확인 완료 |
| 201 신규 저장 | 확인 완료 |
| 200 dedupe | 확인 완료 |
| URL query 개인정보 제거 | 확인 완료 |
| 타입체크와 빌드 | 확인 완료 |
| 백엔드 7020 재시작 | 완료 |
| 운영 backend dedupe 재배포 | 완료. 백업 후 PM2 `seo-backend` 재시작, 외부 `/health` 200 |
| GTM Workspace 147 session_id 보정 | 완료. tag 118 Preview 코드 수정, quick_preview `compilerError: false` |

## Codex가 아직 확실히 못 하는 것

| 항목 | 왜 못 하는가 | 대체 방법 |
|---|---|---|
| GTM Preview 실제 버튼 재클릭 | GTM 계정, Preview 브라우저, 실제 사이트 쿠키가 필요 | TJ님이 같은 상품에서 NPay 버튼을 1회 클릭하고 클릭 시각을 전달 |
| 운영 `att.ainativeos.net` 배포 | 완료 | route 반영, health 200, POST smoke 201, smoke row 삭제 완료 |
| 조회 API token 설정 | 완료 | 운영 `.env`에 `NPAY_INTENT_ADMIN_TOKEN` 설정, 원문은 Git/문서/채팅 미기록 |
| Naver Pay 리턴 URL 설정 가능 여부 확정 | 네이버 답변과 파트너센터 권한이 필요 | TJ님이 네이버 답변을 문서에 붙이면 Codex가 Option A/B 재판단 |
| Google Ads `[248]` 변경 | 입찰 신호에 영향을 주는 운영 변경 | intent 수집과 주문 매칭률 확인 후 별도 승인 |

## Codex 추천안

추천안 A: `intent-only live publish 승인안을 만든 뒤 TJ 승인 후에만 publish한다`.

자신감은 92%다. 이유는 현재 GTM 발화, 운영 endpoint 저장, 30초 dedupe 보강, `ga_session_id` 추출까지 Preview에서 확인됐기 때문이다. 남은 불확실성은 live publish 후 실제 운영 브라우저에서 7일간 NPay 주문과 intent가 어느 정도 매칭되는지다.

TJ님이 Preview 버튼을 다시 클릭하면 Codex가 다음으로 할 일은 아래 순서다.

1. 보호된 `GET /api/attribution/npay-intents?limit=5`로 최신 intent row를 확인한다.
2. 1회 클릭이 최종 1건으로 남았는지, 중복 호출이면 `duplicate_count`만 증가했는지 판정한다.
3. `ga_session_id`, `ga_session_number`, `client_id`, `product_idx`, `product_name`을 확인한다.
4. 누락 필드가 있으면 GTM 초안을 selector/dataLayer 기준으로 수정한다.
5. intent-only live publish 승인안을 YES/NO 형태로 제시한다.
6. 승인 후 7일치 intent와 NPay 주문 원장을 매칭하는 dry-run 리포트를 만든다.
