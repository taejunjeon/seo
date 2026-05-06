# paid_click_intent v1 post-publish 모니터링 템플릿

작성 시각: 2026-05-06 16:31 KST
대상: biocom `paid_click_intent v1`
문서 성격: 운영 publish 승인 후 사용할 read-only 모니터링 템플릿. 이 문서는 publish를 실행하지 않는다.
Status: ready / pending receiver deploy and publish
Supersedes: 없음
Depends on: [[paid-click-intent-gtm-production-publish-approval-20260506]]
Do not use for: GTM Production publish, Google Ads conversion upload, GA4/Meta/Google Ads 전송, 운영 DB write

## 10초 결론

운영 publish 후 봐야 할 것은 Google Ads ROAS가 즉시 좋아지는지가 아니다.
첫 24~72시간의 목표는 `gclid/gbraid/wbraid`가 랜딩에서 저장되고 checkout/NPay intent/주문 후보까지 살아남는지 확인하는 것이다.
단, receiver가 no-write인 동안에는 주문 원장/Attribution VM에 row를 남기지 않는다.
따라서 이 템플릿의 24~72시간 목표는 `원장 fill-rate 개선`이 아니라 `live payload validation`이다.
실제 주문 원장 연결 개선은 minimal ledger write가 별도 승인된 뒤 판단한다.

성공 판단은 아래 순서다.

1. 태그가 정상 로드된다.
2. click id가 storage에 저장된다.
3. no-send receiver가 2xx를 반환한다.
4. checkout/NPay intent payload에 click id가 다시 들어간다.
5. raw payload logging 없이 안전한 access/observability 지표를 볼 수 있다.
6. confirmed purchase no-send dry-run의 `missing_google_click_id` 감소는 참고만 한다. no-write 단계에서는 필수 성공 기준이 아니다.

## 사전 기준선

publish 전 기준선:

- 운영 결제완료 주문 623건 중 Google click id 보유 주문: 5건.
- 주문 원장 기준 보존률: 0.8%.
- Google Ads 증거 주문 후보 기준 보존률: 5/10건, 50%.
- GA4 BigQuery 최근 7일 Google Ads 랜딩 세션 click id 보존률: 97.75%.
- 일반 결제 시작 세션 click id 보유율: 96.32%.
- NPay 클릭 세션 click id 보유율: 99.65%.

해석:

```text
랜딩과 GA4 raw에는 click id가 있다.
주문 원장에는 click id가 거의 없다.
따라서 publish 후 첫 모니터링은 browser storage와 no-write receiver payload가 실제 고객 환경에서 안전하게 동작하는지 봐야 한다.
주문 원장/Attribution VM 쪽 fill-rate 개선은 minimal ledger write 이후에 본다.
```

## 24시간 체크

publish 후 24시간에 확인한다.

### 1. GTM/브라우저 체크

- 대표 랜딩 URL 3개에서 GTM tag가 로드되는지 확인.
- `bi_paid_click_intent_v1` storage key가 생성되는지 확인.
- `gclid`, `gbraid`, `wbraid` 테스트 URL에서 각각 저장되는지 확인.
- `TEST_`, `DEBUG_`, `PREVIEW_` prefix가 live candidate로 통과하지 않는지 확인.

### 2. Receiver 체크

production receiver 후보:

```text
https://att.ainativeos.net/api/attribution/paid-click-intent/no-send
```

사전 preflight 결과:

```text
OPTIONS https://att.ainativeos.net/api/attribution/paid-click-intent/no-send
Origin: https://biocom.kr
결과: 204, Access-Control-Allow-Origin: https://biocom.kr
```

추가 TEST POST smoke 결과:

```text
POST https://att.ainativeos.net/api/attribution/paid-click-intent/no-send
payload: TEST_GCLID_20260506_POST_SMOKE
결과: 404 Route not found
```

따라서 receiver-enabled publish 전에는 [[paid-click-intent-production-receiver-deploy-approval-20260506]] 기준으로 production receiver route 배포가 필요하다.

24시간 체크:

- 2xx rate. 현재는 access log의 status/path/origin 수준 집계 또는 TEST smoke 기준으로 본다.
- `has_google_click_id=true` count. 전용 counter가 없으면 TEST smoke와 제한 샘플 응답에서만 본다.
- `test_click_id=true` count. 전용 counter가 없으면 TEST smoke에서만 본다.
- `live_candidate_after_approval=false` count for test IDs. 전용 counter가 없으면 TEST smoke에서만 본다.
- PII reject count. 전용 counter가 없으면 negative smoke 통과 여부로만 본다.
- raw body가 log에 남지 않는지 확인.
- click id/landing_url/client/session 값은 마스킹 또는 집계 형태로만 남는지 확인.

주의:

```text
receiver가 2xx라고 해서 Google Ads로 전송된 것이 아니다.
no-send receiver는 platform send가 0이어야 한다.
receiver count는 DB/ledger row count가 아니다.
no-write 단계에서는 access log/observability counter/TEST smoke만 사용한다.
현재 코드 inspection 기준 paid_click_intent 전용 observability counter는 아직 확인되지 않았다.
따라서 counter가 없으면 24h/72h의 세부 fill-rate는 "counter 구현 시" 지표로 두고, 이번 단계에서는 route health와 smoke 결과를 우선 본다.
```

### 3. 이상 징후

아래가 보이면 즉시 rollback 후보로 둔다.

- 결제 버튼/NPay 버튼 클릭 오류.
- JS error 급증.
- Google Ads/GA4/Meta purchase 전환 수 비정상 증가.
- payload에 이메일, 전화번호, 이름, 주소, 결제정보 포함.
- test click id가 live candidate로 통과.

## 72시간 체크

publish 후 72시간에 확인한다.

### 1. Fill-rate 비교

아래를 publish 전 기준선과 비교한다.

- Google Ads 랜딩 세션 수.
- paid_click_intent 수신 수.
- paid_click_intent 중 Google click id 보유 수.
- checkout payload 중 Google click id 보유 수.
- NPay intent payload 중 Google click id 보유 수.
- confirmed purchase no-send dry-run의 `missing_google_click_id` count/rate. 단, no-write receiver 단계에서는 참고 지표다.

현재 전용 counter가 없으면 위 5개 중 `paid_click_intent 수신 수`와 `click id 보유 수`는 access log 수준 또는 TEST smoke 수준으로만 본다.
정확한 fill-rate는 minimal ledger write 또는 body 없는 counter가 승인·구현된 뒤 산출한다.

### 2. 주문 후보 연결

아래를 분리해서 본다.

- 홈페이지 결제완료 후보.
- NPay 실제 결제완료 후보.
- click/count/payment start만 있는 후보.
- canceled/refunded/test/manual 차단 후보.
- already_in_ga4 차단 후보.
- missing_google_click_id 차단 후보.

### 3. 판단 기준

좋은 결과:

- `paid_click_intent` 수신이 Google Ads 세션 규모와 비슷한 방향으로 증가.
- checkout/NPay intent 단계에서 click id 보유율이 높게 유지.
- raw payload logging 없이 마스킹/집계 지표만 남음.
- confirmed purchase no-send dry-run에서 `missing_google_click_id`가 감소하면 추가로 좋은 신호. 단, no-write 단계에서는 감소하지 않아도 실패로 보지 않는다.
- 외부 플랫폼 전송 0건 유지.

나쁜 결과:

- tag는 로드되지만 storage가 비어 있음.
- storage는 있지만 receiver가 실패.
- receiver는 되지만 checkout/NPay intent payload에 click id가 없음.
- test click id가 live candidate로 통과.
- purchase 전환값이 비정상 증가.

## 결과 보고서 템플릿

publish 후 결과 문서는 아래 파일명으로 만든다.

```text
gdn/paid-click-intent-gtm-production-publish-result-YYYYMMDD.md
```

포함할 내용:

- publish 시각.
- GTM live version before/after.
- tag/trigger diff.
- rollback plan.
- 24h 결과.
- 72h 결과.
- no-send/no-write/no-platform-send 유지 여부.
- 다음 단계 추천.

## 다음 단계 판단

72시간 결과가 좋으면:

- confirmed purchase no-send dry-run을 운영 publish 이후 window로 재실행한다.
- minimal `paid_click_intent` ledger write 승인안을 작성한다.
- Google Ads confirmed_purchase 전송은 여전히 Red Lane으로 별도 승인 문서를 유지한다.

72시간 결과가 나쁘면:

- tag pause 또는 rollback.
- 실패 지점별로 수정안을 만든다.
- Google Ads conversion action 변경과 upload는 계속 보류한다.
