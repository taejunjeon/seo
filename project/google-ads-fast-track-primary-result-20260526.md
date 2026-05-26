작성 시각: 2026-05-26 22:38 KST
기준일: 2026-05-26
문서 성격: Google Ads 실제 구매 전용 주 전환 fast-track 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
  required_context_docs:
    - project/google-ads-upload-ledger-write-smoke-final-20260526.md
    - project/google-ads-limited-confirmed-purchase-send-approval-draft-20260526.md
    - project/google-ads-duplicate-send-ledger-design-20260526.md
  lane:
    vm_cloud_upload_ledger_write_smoke: Yellow approved by TJ
    google_ads_limited_send_validate_only: Red approved by TJ, validate_only only reached
    google_ads_actual_send: Red approved conditionally, blocked before send by Google Ads permission
  allowed_actions:
    - scoped backend route file backup
    - scoped backend route file deploy
    - VM Cloud backend typecheck/build
    - PM2 seo-backend restart
    - VM Cloud SQLite upload ledger ready row write smoke up to 2 rows
    - Google Ads upload validate_only call up to 2 rows
  forbidden_actions:
    - Google Ads actual conversion upload after validate_only 403
    - Google Ads Primary/Secondary setting mutation by API
    - operational DB write
    - raw order id or raw click id exposure
  source_window_freshness_confidence:
    source: VM Cloud live backend API + VM Cloud SQLite + Google Ads API validate_only response
    window: last_7d, 2026-05-19 to 2026-05-25 KST
    freshness: API smoke at 2026-05-26 22:35 KST
    confidence: high for ledger smoke, high for Google Ads permission blocker, medium-high for candidate bottleneck
```

## 한 줄 결론

실제 구매 전용 Google 주 전환은 데이터 후보와 중복 방지 장부까지는 시작 직전까지 갔지만, Google Ads API가 전송 권한을 거절해 오늘 바로 Primary로 올릴 수 있는 상태까지는 못 갔다.

## 목표와 진척율

- 목표: 오늘 안에 Google Ads가 입찰 학습에 쓸 실제 구매 전용 주 전환을 시작한다.
- 현재 진척율: 92%
- 92%까지 간 이유: 실제 결제완료 + gclid 직접 연결 후보 2건을 VM Cloud 장부에 ready로 썼고, 중복 write가 막히는 것을 확인했다.
- 100%까지 못 간 이유: Google Ads upload validate-only가 `PERMISSION_DENIED / ACTION_NOT_PERMITTED`로 실패했다. 후보 데이터 문제가 아니라 전송 권한 또는 데이터 소스 연결 문제다.

## 실행한 것

1. VM Cloud 장부 write smoke endpoint를 추가했다.
   - API: `POST /api/google-ads/confirmed-purchase/upload-ledger-write-smoke`
   - 효과: Google Ads에 보내기 전, ready 후보를 장부에 최대 2건만 남김.
   - 전송: 0건.

2. VM Cloud 장부에 ready 2건을 기록했다.
   - status: `ready`
   - rows: 2
   - amount: 270,900원
   - conversion action: `BI confirmed_purchase_offline`
   - Google Ads request id: 없음
   - sent_at: 없음

3. 같은 write smoke를 한 번 더 호출했다.
   - 결과: 기존 ready row 2건이 중복으로 막힘.
   - 의미: 같은 주문을 두 번 보내는 사고를 막는 장부 key가 작동한다.

4. Google Ads 제한 전송 endpoint를 추가했다.
   - API: `POST /api/google-ads/confirmed-purchase/limited-upload`
   - 제한: ready 장부 row가 있는 후보 최대 2건만 가능.
   - 승인 문자열 없으면 실행 불가.

5. 실제 전송 전 validate-only를 실행했다.
   - validate-only 뜻: Google Ads에 "이 전송 형식이 맞는지"만 확인하고 실제 전환 수치는 올리지 않는 검사.
   - 결과: 실패.
   - Google Ads 응답:
     - HTTP 403
     - `PERMISSION_DENIED`
     - `ACTION_NOT_PERMITTED`
     - message: `The user does not have permission to perform this action on the resource or call a method.`

## 하지 않은 것

- Google Ads 실제 전환 upload는 0건이다.
- Google Ads Primary 전환 설정 변경은 하지 않았다.
- 운영DB write는 0건이다.
- 원문 주문번호, 원문 gclid, 원문 gbraid, 원문 wbraid는 문서와 응답에 노출하지 않았다.

## 현재 숫자

최근 7일, 2026-05-19 ~ 2026-05-25 KST 기준:

- 실제 결제완료 주문: 458건
- 실제 결제완료 매출: 109,080,402원
- 1단계 후보: 실제 구매 + gclid 직접 연결: 2건 / 270,900원
- 보류 후보: gclid와 gbraid가 섞여 자동 전송 불가: 2건 / 485,000원
- 내부 bridge는 있으나 Google click id 없음: 345건 / 99,800,828원
- click bridge 없음: 109건 / 8,523,674원

후보율 0.4%는 "실제 결제완료 중 Google Ads에 바로 보낼 수 있는 gclid 직접 후보" 비율이다.

## 지금 판단

Google Ads에 실제 구매 전용 주 전환을 시작하려면 후보 데이터보다 Google Ads 전송 권한 문제가 먼저다.

현재 `BI confirmed_purchase_offline` 전환 액션은 Google Ads 안에 존재하고 enabled다.

- type: `UPLOAD_CLICKS`
- category: `PURCHASE`
- primaryForGoal: `false`
- status: `ENABLED`

하지만 현재 VM Cloud가 쓰는 Google Ads API 호출 주체는 search/read는 가능하지만 uploadClickConversions는 거절된다.

## 다음 결정

오늘 1시간 fast-track 기준으로는 `BI confirmed_purchase_offline`을 지금 Primary로 올리지 않는다.

이유:

1. 아직 실제 전환 1건도 Google Ads에 들어가지 않았다.
2. validate-only부터 권한이 막혔다.
3. Primary로 올리면 Google Ads 입찰 학습에 쓸 실제 구매 신호가 없는 상태가 된다.

단, 방향은 유지한다. `BI confirmed_purchase_offline`이 실제 구매 전용 주 전환 후보인 것은 맞다.

## 다음 할일

1. Google Ads 전송 권한 문제를 해결한다.
   - 담당: TJ님 + Codex
   - TJ님 화면: Google Ads `목표 > 전환 > BI confirmed_purchase_offline > 데이터 소스 연결` 또는 계정 접근 권한 화면.
   - 성공 기준: validate-only가 HTTP 200으로 통과한다.
   - 실패 시 해석: 전환 액션 문제가 아니라 API 사용자 권한, 데이터 소스 연결, OAuth 방식 문제다.

2. validate-only 통과 후 제한 2건을 실제 전송한다.
   - 담당: Codex
   - 전제: 1번 통과.
   - 성공 기준: Google Ads response ok, 장부 status `sent` 2건 또는 일부 성공/실패가 명확히 기록된다.
   - 실패 시 해석: payload 형식, conversion action, gclid age, order id 중 하나를 재확인한다.

3. 실제 전송 1~2건 수신 확인 후 Primary 승격한다.
   - 담당: TJ님
   - 화면: Google Ads `목표 > 전환 > BI confirmed_purchase_offline`
   - 바꿀 설정: `보조 액션`에서 `주요 액션`으로 변경.
   - 성공 기준: Google Ads 구매 목표에서 `BI confirmed_purchase_offline`이 primary로 보이고, 기존 NPay 버튼 클릭/결제진입은 secondary로 유지된다.

4. 후보율 0.4% 병목을 넓힌다.
   - 담당: Codex
   - 첫 확장: gclid+gbraid 혼합 2건을 왜 섞였는지 분해한다.
   - 둘째 확장: 내부 bridge 345건 중 Google click id가 왜 없는지 checkout/payment_success 단계별로 나눈다.
   - 성공 기준: ready 후보가 2건에서 10건 이상으로 올라가거나, 못 올리는 이유가 주문 흐름별로 분리된다.
