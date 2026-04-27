# NPay Intent-Only Live Publish 승인안

작성 시각: 2026-04-27 16:55 KST
실행 업데이트: 2026-04-27 18:18 KST
기준일: 2026-04-27
대상: 바이오컴 GTM `GTM-W2Z6PHN`, Default Workspace(147), tag 118
담당: TJ 승인, Codex 실행
Confidence: 92%

## 10초 요약

TJ 승인 후 `NPay intent-only live publish`를 완료했다. 최종 live version은 `139`이고 이름은 `npay_intent_only_live_20260427`이다.

이 publish는 구매 전환을 보내는 작업이 아니다. `POST /api/attribution/npay-intent`로 버튼 클릭 시점의 브라우저 식별값을 저장하는 작업이다.

GA4 purchase, Meta CAPI Purchase, Google Ads 전환, NPay 주문형 설정은 건드리지 않았다.

## 실행 결과

| 항목 | 결과 |
|---|---|
| 승인 | TJ 승인 완료 |
| publish 방식 | Default Workspace 147을 publish하지 않고, live v138 기준 새 Workspace 150 생성 |
| 이유 | Workspace 147이 stale 상태라 [43]/[48]/[143] rollback 위험이 있었음 |
| publish workspace | `accounts/4703003246/containers/13158774/workspaces/150` |
| created version | `139`, `npay_intent_only_live_20260427` |
| live version | `139`, `npay_intent_only_live_20260427` |
| tag 43 | `add_payment_info` 유지 |
| tag 48 | paused 유지 |
| tag 118 | intent beacon live 반영 |
| result backup | `.codex-backups/gtm-20260427-npay-intent/publish-result-fresh-workspace-npay-intent-2026-04-27T09-09-47-679Z.json` |

## Live Smoke 결과

2026-04-27 18:16 KST에 Codex가 운영 상품 페이지에서 `.npay_btn_pay`를 1회 클릭했다. 결제 완료는 하지 않았다.

| 필드 | 결과 | 판단 |
|---|---|---|
| captured_at | 2026-04-27 18:16:44 KST | 정상 |
| environment | `live` | 정상 |
| duplicate_count | 0 | 정상 |
| client_id | `1759636711.1777281392` | 정상 |
| ga_session_id | `1777281391` | 정상 |
| ga_session_number | `1` | 정상 |
| product_idx | `423` | 정상 |
| product_name | `팀키토 저포드맵 도시락 7종 골라담기` | 정상 |
| product_price | 8,900원 | 정상 |
| page_location | `https://biocom.kr/DietMealBox/?idx=423` | 정상 |
| match_status | `pending` | 정상 |
| GA4 purchase | 관측 없음 | 정상 |
| Meta Purchase | 관측 없음 | 정상 |
| Google Ads | 기존 page_view/config 계열 호출만 관측 | 구매 전환 변경 없음 |

## 결론

| 선택지 | Codex 추천 | 자신감 | 의미 |
|---|---|---:|---|
| A. intent-only live publish 진행 | 완료 | 92% | NPay 버튼 클릭 intent를 운영 traffic에서 수집한다. purchase 전송은 없음 |
| B. Preview만 유지 | NO | 70% | 안전하지만 live intent가 쌓이지 않아 주문 매칭 dry-run을 못 한다 |
| C. purchase dispatcher까지 같이 진행 | NO | 55% | 아직 이르다. live intent 7일치 매칭률을 본 뒤 판단해야 한다 |

TJ님 답변 형식:

| 답변 | Codex 행동 |
|---|---|
| `YES: NPay intent-only live publish 진행` | 아래 실행안을 그대로 진행 |
| `NO: 보류` | GTM live publish 없이 문서 상태만 유지 |

## 지금까지 확인된 것

| 항목 | 결과 |
|---|---|
| backend route | 운영 `https://att.ainativeos.net/api/attribution/npay-intent` 배포 완료 |
| backend health | 2026-04-27 16:00 KST `GET /health` 200 |
| 조회 보호 | `NPAY_INTENT_ADMIN_TOKEN` 설정 완료. 무토큰 403, 토큰 조회 200 |
| dedupe | 30초 lookback 적용. 같은 브라우저/상품/페이지/근접 시간 중복은 `duplicate_count` 증가 |
| GTM Workspace | 147 Default Workspace |
| 미게시 변경 | 1건. tag 118만 `updated` |
| merge conflict | 0건 |
| tag 118 Preview 상태 | `ENVIRONMENT="preview"`, `DEBUG_MODE=true` |
| tag 118 fingerprint | `1777272925667` |
| quick_preview | `compilerError: false`, tagCount 57 |
| purchase 코드 | tag 118 beacon 안에 `gtag('event','purchase')` 없음 |

## Preview 재검증 근거

2026-04-27 16:42 KST에 TJ님이 같은 상품에서 NPay 버튼을 1회 클릭했다.

| 필드 | 결과 | 판단 |
|---|---|---|
| 저장 row | 최신 1건 | 통과 |
| environment | `preview` | 의도한 상태 |
| duplicate_count | 0 | 이번 클릭은 중복 저장 없음 |
| client_id | `395345677.1775926422` | 정상 |
| ga_cookie_raw | `GA1.1.395345677.1775926422` | 정상 |
| ga_session_id | `1777275745` | 정상 |
| ga_session_number | `15` | 정상 |
| fbp | 값 있음 | Meta 보조키 확보 |
| product_idx | `423` | 정상 |
| product_name | `팀키토 저포드맵 도시락 7종 골라담기` | 정상 |
| product_price | 8,900원 | 정상 |
| page_location | `https://biocom.kr/DietMealBox/?idx=423` | 정상 |
| match_status | `pending` | 주문 매칭 전 상태로 정상 |

네이버페이의 `단체회원은 이용 불가합니다` 안내는 이번 판단에 큰 영향을 주지 않는다. 이 검증은 결제 성공이 아니라 버튼 클릭 시점의 intent 저장 검증이다.

## 승인하면 바뀌는 것

GTM tag 118의 beacon 블록에서 아래 두 값만 live용으로 바꾼다.

```js
var ENVIRONMENT = "live";
var DEBUG_MODE = false;
```

그 외 기존 Hurdlers dataLayer 처리, 버튼 trigger, 상품 추출, GA 쿠키 추출, endpoint는 유지한다.

## 승인해도 바뀌지 않는 것

| 항목 | 상태 |
|---|---|
| GA4 purchase 전송 | 변경 없음 |
| Meta CAPI Purchase 전송 | 변경 없음 |
| Google Ads 전환 설정 | 변경 없음 |
| `[143] HURDLERS - [이벤트전송] 구매` | 변경 없음 |
| `[43] GA4_구매전환_Npay` | 변경 없음. 계속 `add_payment_info` |
| `[48] GA4_구매전환_홈피구매` | 변경 없음. 계속 paused |
| NPay 주문형 제거 | 하지 않음 |
| 서버사이드 purchase dispatcher | 하지 않음 |
| 운영 DB schema 변경 | 하지 않음 |

## Codex 실행 단계

| 순서 | 담당 | 무엇을 하는가 | 왜 하는가 | 어떻게 하는가 | 성공 기준 |
|---:|---|---|---|---|---|
| 1 | Codex | Workspace 147 상태를 다시 확인 | tag 118 외 변경이 섞이면 publish하면 안 된다 | GTM API `workspace/status` 조회 | workspaceChange 1건, tag 118만 updated, merge conflict 0 |
| 2 | Codex | tag 118 백업 | publish 전 rollback 기준을 남긴다 | GTM API로 tag 118 JSON 저장 | `.codex-backups/gtm-20260427-npay-intent/`에 백업 파일 생성 |
| 3 | Codex | tag 118 live 값 적용 | Preview 값을 운영 수집 값으로 바꾼다 | `ENVIRONMENT="live"`, `DEBUG_MODE=false`로 변경 | endpoint, session fix, purchase 금지 조건 유지 |
| 4 | Codex | quick_preview 실행 | publish 전 GTM 컴파일 오류를 막는다 | GTM API `quick_preview` | `compilerError: false` |
| 5 | Codex | container version 생성 | publish 가능한 버전을 만든다 | version name `npay_intent_only_live_20260427` | 새 version 생성 |
| 6 | Codex | publish | 운영 traffic에서 intent만 수집한다 | GTM API publish | live version 증가 예상 |
| 7 | Codex + TJ | live smoke | 운영 브라우저에서 실제로 수집되는지 확인한다 | NPay 버튼 1회 클릭, 결제 완료 안 함 | 최신 row `environment=live`, `ga_session_id` 있음, purchase 전송 없음 |
| 8 | Codex | 24시간 관찰 | 의도치 않은 중복/오류를 본다 | intent row 수, duplicate_count, product/session fill rate 확인 | 오류율 낮고 필수 필드 정상 |
| 9 | Codex | 7일 매칭 dry-run | NPay 주문과 intent가 붙는지 본다 | NPay 주문 원장과 `npay_intent_log` 매칭 | matched/ambiguous/unmatched 리포트 |

## Publish 직후 성공 기준

| 기준 | Go |
|---|---|
| live intent 저장 | NPay 버튼 1회 클릭 후 최신 row 1건 생성 |
| environment | `live` |
| ga_session_id | 빈 값 아님 |
| ga_session_number | 빈 값 아님 |
| product_idx/product_name | 빈 값 아님 |
| 중복 호출 | 중복 발생 시 새 row가 아니라 `duplicate_count` 증가 |
| GA4 purchase | 버튼 클릭만으로 purchase 전송 없음 |
| Meta CAPI Purchase | 버튼 클릭만으로 전송 없음 |
| Google Ads purchase | 버튼 클릭만으로 전환 변경 없음 |

## Rollback 기준

아래 중 하나라도 발생하면 즉시 rollback한다.

| 조건 | 조치 |
|---|---|
| tag 118 publish 후 GTM 오류 발생 | 이전 live version 138로 rollback 또는 tag 118 백업 복원 후 새 version publish |
| NPay 버튼 클릭이 결제 흐름을 방해 | tag 118 beacon 제거 또는 이전 tag 118 백업 복원 |
| intent가 1회 클릭당 과도하게 증가 | live publish 취소 후 selector/trigger 재검토 |
| `ga_session_id` fill rate가 낮음 | live publish는 유지할지 보류하고 GTM 쿠키 추출 재검토 |
| purchase 이벤트가 발생 | 즉시 rollback. 이 승인안 범위 위반 |

## Rollback 방법

1. GTM live version을 v138로 되돌린다.
2. 또는 publish 직전 백업한 tag 118 JSON으로 tag 118을 복원한다.
3. quick_preview를 통과시킨다.
4. rollback version을 publish한다.
5. `GET /api/attribution/npay-intents`로 rollback 후 신규 live intent가 멈췄는지 확인한다.

## 위험과 대응

| 위험 | 가능성 | 영향 | 대응 |
|---|---:|---:|---|
| NPay 버튼 click trigger가 2회 발화 | 중 | intent 수 과대 | 서버 30초 dedupe로 흡수 |
| 일부 브라우저에서 sendBeacon 실패 | 중 | intent 일부 누락 | `fetch keepalive` fallback 유지 |
| live traffic에서 상품명 추출 누락 | 낮음 | 주문 매칭 점수 하락 | dataLayer/meta/title fallback 유지, 24시간 fill rate 점검 |
| member_code 없음 | 중 | 회원 단위 매칭 약화 | 실패 조건 아님. 주문 매칭은 client/session/product/time 기준으로 시작 |
| Google/Meta purchase 오염 | 낮음 | 전환 품질 훼손 | 승인 범위에서 purchase 코드 없음, publish 전 regex 검사 |

## Codex 추천

추천은 `YES: NPay intent-only live publish 진행`이다.

자신감은 92%다. 이유는 Preview에서 핵심 필드가 모두 들어왔고, backend dedupe와 GTM session_id 보정이 운영/Preview 양쪽에서 확인됐기 때문이다.

자신감이 100%가 아닌 이유는 live publish 후 실제 운영 traffic에서 7일치 NPay 주문과 intent 매칭률을 아직 보지 못했기 때문이다. 그래서 purchase dispatcher는 아직 열지 않고, intent-only로 먼저 7일 데이터를 쌓는 것이 맞다.

## TJ 승인 문구

아래 둘 중 하나로 답하면 된다.

```text
YES: NPay intent-only live publish 진행
```

```text
NO: 보류
```
