# Google click id 보존률 개선 설계

작성 시각: 2026-05-05 23:38 KST
대상: biocom Google Ads confirmed purchase 연결
문서 성격: Green Lane 설계/진단 문서. GTM publish, backend deploy, Google Ads 전송은 하지 않는다.
Status: active / Preview and HTTPS receiver pass
Supersedes: 없음
Next document: [[paid-click-intent-receiver-access-result-20260506|paid_click_intent receiver 접근 검증 결과]]
Do not use for: GTM Production publish, Google Ads 전환 액션 생성/변경, conversion upload, backend 운영 deploy

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/APPROVAL_GATES.md
  required_context_docs:
    - total/!total.md
    - gdn/!gdnplan.md
    - gdn/google-ads-confirmed-purchase-operational-dry-run-20260505.md
    - data/google-click-id-preservation-diagnostics-20260505.md
  lane: Green
  allowed_actions:
    - read-only 진단
    - 로컬 no-send route 설계
    - 문서 작성
    - 로컬 typecheck/smoke
  forbidden_actions:
    - GTM Production publish
    - backend 운영 deploy
    - Google Ads conversion upload
    - Google Ads conversion action 생성/변경
    - GA4/Meta 전환 전송
    - 운영 DB write
  source_window_freshness_confidence:
    source: "운영 DB confirmed order 623건 + Attribution VM snapshot + GA4 BigQuery guard + 코드 inspection"
    window: "2026-04-27~2026-05-05"
    freshness: "운영 Postgres read-only, VM snapshot 2026-05-05, GA4 BigQuery events_20260504 fresh"
    site: "biocom"
    confidence: 0.88
```

## 10초 결론

Google Ads에 실제 결제완료 주문만 구매로 알려주려면 `gclid`, `gbraid`, `wbraid`가 주문까지 남아야 한다.
현재 운영 결제완료 주문 623건 중 Google click id가 남은 주문은 5건뿐이다.
따라서 지금은 Google Ads 전환 전송을 준비하기보다, 랜딩/체크아웃/NPay intent 시점에 Google click id를 먼저 보존해야 한다.

## 확인된 숫자

근거 파일: [[../data/google-click-id-preservation-diagnostics-20260505]]

| 항목 | 값 | 해석 |
|---|---:|---|
| 운영 결제완료 주문 | 623건 | 홈페이지 결제완료와 NPay 실제 결제완료만 포함 |
| Google click id 보유 주문 | 5건 | `gclid/gbraid/wbraid` 중 하나라도 있는 주문 |
| 전체 보존률 | 0.8% | Google Ads confirmed purchase 연결에는 매우 낮음 |
| Google evidence 주문 분모 보존률 | 5 / 10건, 50% | 주문까지 남은 명시적 Google evidence 기준. Google 랜딩 세션 분모는 BigQuery로 별도 봐야 함 |
| 홈페이지 결제완료 보존률 | 2 / 586건, 0.34% | 자사몰 결제완료만으로는 거의 못 붙음 |
| NPay 결제완료 보존률 | 3 / 37건, 8.11% | NPay intent 쪽이 상대적으로 낫지만 충분하지 않음 |
| evidence는 있으나 Google click id가 없는 주문 | 489건 | VM/NPay 증거는 붙었지만 Google click id가 사라진 주문 |

## 분모를 나누는 기준

전체 결제완료 주문 기준 보존률은 0.8%다.
이 숫자는 Meta, TikTok, Naver, Organic, Direct 주문까지 모두 포함한 분모다.
따라서 Google Ads 유입 후보 주문만의 보존률과 반드시 나눠 봐야 한다.

현재 주문 원장/VM evidence에 명시적 Google 증거가 남은 주문은 10건이고, 이 중 click id가 남은 주문은 5건이다.
이 분모에서는 보존률이 50%다.
다만 `search`, `cpc`, `sem` 같은 범용 단어는 Naver brandsearch와 섞이므로 Google 후보 조건에서 제외했다.
최종 Google Ads 랜딩 세션 기준 분모는 GA4 BigQuery landing-session 분석으로 별도 산출한다.

해석 규칙:

- 0.8%는 전체 결제완료 주문 기준 보존률이다. 전체 주문에는 Google Ads가 아닌 매출도 섞여 있으므로 Google Ads 품질 판단의 최종 분모가 아니다.
- 50%는 이미 Google 증거가 남은 주문 후보 기준 보존률이다. 다만 표본이 10건뿐이므로 낙관하면 안 된다.
- 다음 검증은 Google Ads 랜딩 세션과 주문 후보를 더 넓게 잡아, Google Ads 유입 후보 기준 보존률을 다시 산출하는 것이다.

## 왜 이게 병목인가

Google Ads의 실제 결제완료 전환은 광고 클릭 ID와 주문이 붙어야 제대로 올라간다.
`gclid`는 일반 Google Ads 클릭 ID이고, `gbraid/wbraid`는 iOS/앱·웹 환경에서 쓰이는 Google Ads 클릭 ID다.
이 값들이 주문 시점에 없으면 실제 결제완료 주문이 있어도 Google Ads에 “이 광고 클릭에서 온 구매”라고 알려주기 어렵다.

현재 병목은 Google Ads API가 아니라 `결제 전 click id 저장`이다.
결제완료 페이지에서만 URL을 읽으면 Toss, NPay, PG 리다이렉션 뒤에 click id가 사라질 수 있다.

## 코드 inspection에서 확인한 위험

현재 `/api/attribution/marketing-intent`는 TikTok 중심으로 설계되어 있다.
코드상 `marketing_intent`는 TikTok evidence가 없으면 `no_tiktok_intent_evidence`로 skip될 수 있다.
또 기존 marketing intent URL allowlist는 `ttclid`와 UTM 중심이라 Google click id 보존 통로로 쓰기에는 부족하다.

따라서 Google용 보존은 기존 TikTok 경로를 억지로 재사용하지 말고 `paid_click_intent v1` 또는 `marketing_intent v2`로 분리하는 것이 안전하다.

## 설계안

### 1. 랜딩 시점 저장

고객이 `biocom.kr`에 들어오는 순간 아래 값을 1st-party storage에 저장한다.

저장 대상:

- `gclid`
- `gbraid`
- `wbraid`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `landing_url`
- `referrer`
- `client_id`
- `ga_session_id`
- `captured_at`

저장 위치:

- 브라우저 `localStorage` 또는 1st-party cookie
- Attribution VM `marketing_intent` 또는 새 `paid_click_intent` 원장

TTL 추천:

- Google Ads click id: 90일
- UTM/referrer: 30일
- checkout 연결용 session key: 세션 단위

### 2. 체크아웃/NPay intent 시점 재주입

고객이 장바구니, 일반 결제 시작, NPay 버튼 클릭으로 이동할 때 저장된 click id를 payload에 다시 넣는다.
결제완료 시점에 URL에서 다시 찾지 않고, 랜딩 때 저장한 값을 계속 전달한다.

필수 원칙:

- NPay 클릭은 purchase가 아니다.
- NPay 결제 시작도 purchase가 아니다.
- NPay 실제 결제완료 주문만 confirmed purchase 후보가 된다.
- 홈페이지 결제완료 주문도 confirmed purchase 후보가 된다.

### 3. 주문 완료 후 confirmed purchase no-send 후보 생성

운영 DB에서 실제 결제완료 주문을 확인한 뒤에만 후보를 만든다.
후보에는 아래 중 하나가 있어야 Google Ads 연결 가능성이 높다.

- `gclid`
- `gbraid`
- `wbraid`

없으면 후보는 만들 수 있지만 Google Ads 전송 후보로는 `missing_google_click_id` 차단한다.

## 단계별 진행

### Green Lane

이미 진행한 것:

- 운영 source no-send dry-run 확장. 최신 재실행 결과: 623건, 홈페이지 586건, NPay 37건.
- Google click id 보존률 진단. 최신 재실행 결과: 전체 0.8%, 주문 evidence 기준 Google 후보 10건 중 5건.
- confirmed_purchase no-send preview route 추가.
- paid_click_intent no-send preview route 추가. 산출물: `POST /api/attribution/paid-click-intent/no-send`.
- source freshness에 운영 아임웹 주문 원장 추가.
- confirmed_purchase no-send route 운영 샘플 검증. 산출물: [[../data/confirmed-purchase-no-send-route-sample-20260506]].
- GTM Preview 승인안 작성. 산출물: [[paid-click-intent-gtm-preview-approval-20260506]].
- GTM Preview only 실행. 산출물: [[paid-click-intent-gtm-preview-result-20260506]]. 결과: storage/payload PASS, Node-side receiver PASS.
- HTTPS tunnel receiver 재검증. 산출물: [[paid-click-intent-receiver-access-result-20260506]]. 결과: `gclid/gbraid/wbraid` 세 케이스 모두 browser receiver `200 ok=true`.

아직 Green으로 가능한 것:

- 최근 7일/14일 Google Ads 랜딩 URL 중 click id 포함률 BigQuery 추가 분석.
- GTM Production publish 승인안 작성. 운영 publish 범위, rollback, no-send/no-write guard, 24h/72h 모니터링 기준을 정리한다.

### Yellow Lane

TJ님 승인 후 가능한 것:

- GTM Production publish 여부 결정. Preview/receiver는 통과했지만 운영 게시 전에는 별도 승인 필요.

### Red Lane

별도 명시 승인 전 금지:

- GTM Production publish.
- backend 운영 deploy.
- Google Ads conversion upload.
- Google Ads 전환 액션 생성/변경.
- GA4/Meta purchase 전송.
- 운영 DB write.

## 성공 기준

1차 성공 기준:

- 테스트 랜딩 URL에서 `gclid/gbraid/wbraid`가 storage에 저장된다.
- checkout/NPay intent payload에 같은 click id가 다시 들어간다.
- `/api/attribution/paid-click-intent/no-send` preview에서 `has_google_click_id=true`가 나온다.
- `TEST_`, `DEBUG_`, `PREVIEW_` prefix click id는 Preview 확인용으로만 남고 live 후보에서는 차단된다.
- 실제 외부 플랫폼 전송은 0건이다.

운영 전환 전 성공 기준:

- Google Ads 유입으로 추정되는 결제완료 주문의 click id 보존률이 현재 0.8%보다 의미 있게 상승한다.
- 최소 7일 동안 `NPay click/count/payment start`가 purchase 후보로 들어가지 않는다.
- GA4 BigQuery guard가 이미 있는 주문을 중복 후보에서 제외한다.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Notes:
- 현재 수치는 confirmed purchase 전송 준비보다 click id 보존이 우선이라는 근거다.
- Google Ads 계정 변경은 아직 진행하지 않는다.
