작성 시각: 2026-05-27 02:12 KST
기준일: 2026-05-27
문서 성격: Google Ads 실제 결제완료 전용 전환 API 진단 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - docs/report/text-report-template.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - data/!data_inventory.md
    - project/google-ads-confirmed-only-nosend-builder-20260526.md
    - project/google-ads-confirmed-purchase-send-auto-dispatch-result-20260527.md
  lane: Green Lane read-only diagnostics
  allowed_actions:
    - Google Ads API read-only query
    - VM Cloud SQLite read-only query
    - cron log read-only inspection
    - documentation
  forbidden_actions:
    - additional Google Ads conversion upload/send
    - Google Ads UI setting mutation
    - production DB write/import
    - GTM publish
  source_window_freshness_confidence:
    source:
      - Google Ads API v22
      - VM Cloud SQLite upload ledger
      - VM Cloud cron log
      - Google Ads official docs
    window: 2026-05-20 ~ 2026-05-27
    freshness: live read-only at 2026-05-27 02:05 KST
    confidence: high for API/auth/action/ledger, medium for UI diagnostic banner interpretation
```

## 10초 요약

Google Ads에 실제 결제완료 주문만 알려주는 새 전환 통로는 API 기준으로 연결되어 있다.

VM Cloud 전송 장부에는 `sent` 3건이 있고, 모두 Google Ads API 응답 코드 `200`을 받았다. Google Ads API 리포트에서도 `BI confirmed_purchase_offline` 2건이 이미 전환으로 조회된다. 다만 오프라인 데이터 진단 요약 테이블은 아직 빈 결과라, UI의 `데이터 소스 연결` 안내는 현재만 보면 전송 실패 증거가 아니라 Google Ads 진단/화면 갱신 지연 또는 UI 안내 문구로 보는 것이 맞다.

## 확인한 것

### 1. Google Ads 전환 계정과 전환 액션

- 전환 추적 계정: 현재 광고 계정 자체가 전환을 관리한다.
- 전환 액션: `BI confirmed_purchase_offline`
- 전환 액션 타입: `UPLOAD_CLICKS`
- 상태: `ENABLED`
- 주 전환 여부: `primaryForGoal=true`

의미:

- 이 전환은 웹사이트 태그가 아니라 서버가 Google Ads에 실제 결제완료 주문을 직접 알려주는 방식이다.
- 고객센터 화면의 `데이터 소스 연결` 버튼을 눌러 Shopify/MySQL 같은 제품을 붙이는 것이 이 경로의 필수 조건이라고 보기는 어렵다.

### 2. VM Cloud 전송 장부

`google_ads_confirmed_purchase_upload_ledger` 기준:

| 상태 | 건수 | 설명 |
|---|---:|---|
| sent | 3 | Google Ads API로 전송했고 응답 코드 200을 받은 건 |

세부 요약:

| 전환일 | 금액 | click id type | Google Ads 응답 |
|---|---:|---|---|
| 2026-05-20 | 36,900원 | gclid | 200 |
| 2026-05-24 | 234,000원 | gclid | 200 |
| 2026-05-26 | 35,000원 | gclid | 200 |

주의:

- 문서와 대화에는 원문 주문번호, 원문 gclid를 출력하지 않았다.
- VM Cloud 장부에도 원문 대신 digest/hash 중심으로 저장되어 있다.

### 3. Google Ads API 리포트 집계

`segments.conversion_action = BI confirmed_purchase_offline` 기준:

| 날짜 | 전환수 | 전환값 |
|---|---:|---:|
| 2026-05-20 | 1 | 36,900원 |
| 2026-05-24 | 1 | 234,000원 |

해석:

- Google Ads API 리포트는 이미 2건을 전환으로 인식하고 있다.
- 2026-05-26 전송분 35,000원은 아직 리포트에 안 보인다. 전송 시각이 2026-05-27 01:06 KST라서 Google Ads 집계 지연으로 보는 것이 자연스럽다.

### 4. 오프라인 전환 진단 요약

Google Ads API의 아래 두 진단 리소스를 조회했다.

- 계정 수준 진단: `offline_conversion_upload_client_summary`
- 전환 액션 수준 진단: `offline_conversion_upload_conversion_action_summary`

결과:

- API 호출: 성공
- 진단 row: 0건

해석:

- API 권한/인증 실패가 아니다.
- 전환 액션 ID 불일치도 아니다.
- 다만 Google Ads의 오프라인 데이터 진단 요약 테이블은 아직 이 계정/액션에 대한 row를 만들지 않았다.

## 현재 판단

### 데이터 소스 연결 버튼을 누를 필요가 있는가

현재 판단은 `아직 누르지 않는다`이다.

이유:

1. Google Ads API 리포트에서 이미 `BI confirmed_purchase_offline` 2건이 조회된다.
2. VM Cloud 전송 장부도 3건 모두 `sent`, Google 응답 `200`이다.
3. 공식 문서상 API 전환 가져오기 상태는 오프라인 데이터 진단 리소스로 조회할 수 있고, 제품 데이터 소스 연결 화면은 별도 연결 옵션이다.

즉, 지금 문제는 `연결이 안 됐다`라기보다 `UI의 진단 배너와 API 리포트 집계가 같은 속도로 갱신되지 않는다`에 가깝다.

## 하지 않은 것

- 추가 Google Ads 전환 전송은 하지 않았다.
- Google Ads UI 설정은 바꾸지 않았다.
- 데이터 소스 연결 버튼은 누르지 않았다.
- 운영DB write/import는 하지 않았다.
- raw order id, raw click id는 출력하지 않았다.

## 다음 확인 기준

### 1. 2026-05-27 전송분 35,000원이 Google Ads 리포트에 보이는지 확인

성공 기준:

- `BI confirmed_purchase_offline` 리포트에 2026-05-26 또는 2026-05-27 날짜로 35,000원 전환이 잡힌다.

실패 시 해석:

- 24시간 이상 안 보이면 업로드 시각, conversion time timezone, click id match, conversion action resource, consent 필드를 다시 분해한다.

### 2. 오프라인 데이터 진단 row가 생기는지 확인

성공 기준:

- `offline_conversion_upload_client_summary` 또는 `offline_conversion_upload_conversion_action_summary`에 row가 생긴다.

실패 시 해석:

- 리포트 집계에는 잡히지만 진단 summary만 늦거나 비어 있는 케이스다.
- 이 경우 Google Ads UI의 빨간 배너보다 실제 conversion action metrics를 우선 판단 근거로 쓴다.

## 자율성 점수

이번 Green Lane read-only 진단 자율성 점수: 92/100

잘한 점:

- TJ님 추가 승인 없이 공식 문서, Google Ads API, VM Cloud 원장, cron 로그까지 한 번에 조회했다.
- `데이터 소스 연결이 필수인지`를 UI 느낌이 아니라 실제 API 리포트와 장부로 판단했다.
- raw 주문번호와 raw click id를 노출하지 않았다.

부족했던 점:

- 이 진단은 첫 전송 직후 Codex가 먼저 했어야 했다.
- Google Ads UI가 빨간 배너를 보여줄 때, 단순 화면 해석에 머물지 말고 즉시 `offline conversion upload summary`와 conversion action metrics를 같이 조회했어야 한다.

