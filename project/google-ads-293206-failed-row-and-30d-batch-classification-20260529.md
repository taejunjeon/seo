작성 시각: 2026-05-29 01:41 KST
기준일: 2026-05-29
문서 성격: Google Ads 실제 결제완료 전환 293,206원 실패 row 원인 조사 및 최근 30일 전송 후보 분류

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  required_context_docs:
    - project/google-ads-limited-send-245000-and-reflection-monitor-20260529.md
    - project/google-ads-duplicate-send-ledger-design-20260526.md
    - project/google-ads-confirmed-purchase-send-auto-dispatch-result-20260527.md
  lane: Green_read_only_and_documentation
  allowed_actions:
    - VM Cloud SQLite read-only query
    - VM Cloud API no-write plan query
    - Google Ads API read-only diagnostics query
    - local code inspection
    - documentation
  forbidden_actions:
    - Google Ads conversion send
    - VM Cloud DB write
    - operational DB write
    - deploy/restart
    - raw order id or raw click id exposure
  source_window_freshness_confidence:
    source: VM Cloud SQLite + VM Cloud API + Google Ads API + local source code
    window: last_30d, site=biocom
    freshness: checked 2026-05-29 01:41 KST
    confidence: high for ledger state and candidate counts, medium for 293206 exact Google-side reason because raw partial failure body was not persisted
```

## 10초 요약

293,206원 row는 실제 구매 후보 자체가 틀린 것이 아니다.

Google Ads 전송 당시 응답에 `부분 실패` 표시가 있었고, 우리 장부가 그 row를 `failed`로 처리했다. 문제는 실패 세부 문구를 저장하지 않고 응답 hash만 남긴 점이다. 그래서 지금 저장된 hash만으로는 Google이 왜 실패시켰는지 원문 사유를 복원할 수 없다.

최근 30일 기준으로 현재 장부 규칙상 추가로 보낼 수 있는 후보는 16건, 3,104,627원이다. 다만 다음 batch는 바로 대량 전송하지 말고 먼저 validate-only로 통과 여부를 확인한 뒤 3-5건 단위로 보내는 것이 맞다.

## 293,206원 row 판단

### 사람이 이해하는 결론

이 row는 `구매 후보가 아닌 것`이 아니라 `실패 사유를 볼 수 없게 저장한 것`이 병목이다.

비유하면, 택배 접수는 했는데 접수대가 "일부 문제 있음"이라고 답했고, 우리는 그 답변 원문 대신 영수증 번호의 지문만 보관한 상태다. 지문만 보고는 "주소 오류인지, 중복 접수인지, 시간 오류인지"를 역으로 읽을 수 없다.

### 확인한 사실

- VM Cloud 전송 장부에는 293,206원 row가 `failed`로 1건 있다.
- 같은 후보는 현재 no-write 계획에서도 같은 중복 key로 다시 잡힌다.
- 즉 후보 생성 기준으로는 여전히 실제 구매 전송 후보다.
- 실패 당시 Google Ads API 응답은 HTTP 200이었다.
- HTTP 200은 요청 자체가 Google 서버에 도착해 응답을 받았다는 뜻이다.
- 하지만 Google Ads 전환 업로드는 HTTP 200이어도 개별 row가 실패할 수 있다.
- 당시 응답에는 `partialFailure=true`가 있었다.
- 우리 로그의 `errorSummary.googleAdsErrors`는 빈 배열이었다.
- 장부에는 원문 응답이 아니라 `google_ads_response_hash`만 저장됐다.

### 현재 확정 가능한 원인

확정 원인:

- 실패 row가 생긴 직접 원인은 Google Ads 업로드 응답의 `partialFailure=true`다.
- 현재 다시 보내지 못하는 직접 원인은 장부가 이 row를 `failed`로 보유하고 있고, 같은 중복 key 재처리를 막고 있기 때문이다.

아직 확정하지 못한 원인:

- Google이 해당 row를 왜 partial failure로 봤는지의 세부 사유.
- 예: 중복 전환, 전환 시각 문제, 클릭 id 매칭 문제, order id 문제, 기타 Google Ads API validation 문제.

확정하지 못한 이유:

- 당시 raw partial failure body를 저장하지 않았다.
- 저장된 response hash는 원문 복호화가 불가능한 단방향 지문이다.
- Google Ads offline conversion diagnostic summary는 현재 3 successful events만 보여주며, 이 실패 row의 상세 사유를 돌려주지 않는다.

## 해시로 raw 주문번호를 알 수 있는가

해시만으로는 알 수 없다.

해시는 비밀번호 지문처럼 한 방향으로 만든 값이다. 원문 주문번호를 넣어 hash를 만들 수는 있지만, hash를 보고 원문 주문번호를 되돌리는 것은 설계상 불가능하다.

다만 최고관리자 권한으로 내부 원본 테이블을 함께 보면 찾을 수 있다.

방법은 이렇다.

1. VM Cloud 내부 원본 주문/클릭 후보 테이블에서 같은 날짜, 금액, 사이트, click id digest, order digest 조건으로 후보를 찾는다.
2. 각 후보의 원문 주문번호와 원문 click id를 서버 안에서만 다시 hash한다.
3. 실패 row의 digest와 맞는 후보를 찾는다.
4. 결과는 일반 보고서에 raw로 뿌리지 않고, admin token이 있는 row-level 진단 화면에서만 보여준다.

즉 `hash 자체를 복호화하는 것`은 불가능하다. 대신 `원본 데이터가 남아 있으면 서버 내부에서 대조해 찾는 것`은 가능하다.

## 최근 30일 후보 분류

Source:

- VM Cloud API: `/api/google-ads/confirmed-purchase/upload-ledger-write-smoke-plan?site=biocom&window=last_30d&limit=80`
- VM Cloud SQLite: `google_ads_confirmed_purchase_upload_ledger`
- 기준 시각: 2026-05-29 01:41 KST

### 보내도 되는 후보

- 16건
- 총 3,104,627원
- 공통 조건:
  - 실제 결제완료 후보
  - Google click id type이 `gclid`
  - 장부 기준 아직 sent/failed로 처리되지 않은 후보
  - 현재 no-write 장부 계획에서 `would_insert_ready_row`

날짜/금액 분포:

- 2026-05-04: 349,000원 1건
- 2026-05-07: 245,000원 2건
- 2026-05-08: 245,000원 1건
- 2026-05-09: 245,000원 1건
- 2026-05-10: 245,000원 1건
- 2026-05-11: 245,000원 1건
- 2026-05-15: 11,900원 3건, 35,000원 1건, 245,000원 1건
- 2026-05-17: 245,000원 1건, 234,927원 1건
- 2026-05-18: 245,000원 1건
- 2026-05-19: 245,000원 1건

### 보류 후보

1. 293,206원 1건
   - 이유: 실제 구매 후보이고 click id도 있으나, 이전 전송에서 partial failure로 실패 처리됨.
   - 다음 조건: validate-only 재검증 또는 실패 사유 저장 보강 후 재판단.

2. NPay bridge A급이지만 Google click id 복구가 필요한 후보
   - 이유: "이 NPay 결제완료는 이 버튼 클릭에서 온 것"이라는 내부 연결은 강하지만, Google Ads에 보내려면 gclid/gbraid/wbraid 중 하나가 전송 payload에 있어야 한다.
   - 다음 조건: 버튼 클릭 intent 저장값과 결제완료 주문을 1:1로 붙이고, 원문 Google click id를 안전하게 payload에 연결.

3. 내부 결제완료지만 Google click id가 없는 후보
   - 이유: 매출은 맞지만 Google Ads에 "광고 클릭 후 구매"라고 알려줄 직접 식별자가 없다.
   - 다음 조건: Google click id 보존/bridge를 더 개선.

### 제외 후보

- 클릭만 있고 결제완료가 없는 row
- NPay 버튼 클릭/결제 진입 이벤트
- 결제 미완료, 취소, 환불, 금액 불일치 후보
- 이미 sent 처리된 row

이번 조회에서 `notActualPurchaseRows`는 0으로 보였다. 즉 현재 후보 생성기의 첫 단계는 실제 구매 후보 위주로 잘 걸러지고 있다.

## 다음 batch 크기 판단

### 많이 보내면 무엇이 문제인가

많이 보낸다고 그 자체가 항상 나쁜 것은 아니다.

문제는 `틀린 구매`, `중복 구매`, `실패 사유를 모르는 row`가 한꺼번에 많이 들어가면 Google Ads 학습과 내부 판단이 동시에 흐려지는 것이다.

주요 리스크:

1. 실패 row가 많이 쌓이면 실패 원인을 찾기 어려워진다.
   - 1건 실패는 원인 추적이 가능하다.
   - 20건을 한꺼번에 보내고 5건이 실패하면 어떤 조건이 문제였는지 다시 쪼개야 한다.

2. Google Ads 진단 품질이 나빠질 수 있다.
   - Google Ads API는 partial failure를 허용하지만, 업로드 진단에서 실패율이 높으면 신호 품질이 나빠 보인다.

3. 잘못된 구매값이 들어가면 입찰 학습이 틀어진다.
   - 버튼 클릭은 보조 전환이고 실제 구매가 아니다.
   - 실제 구매만 보내야 한다는 기준이 깨지면 지금까지 정리한 ROAS 갭 축소 작업이 다시 오염된다.

4. 과거 날짜 backfill이 한 번에 들어가면 ROAS 리포트가 갑자기 바뀐다.
   - 예산 판단자가 오늘 성과가 좋아진 것으로 오해할 수 있다.
   - 그래서 날짜별/전송일별로 구분해서 봐야 한다.

### 추천 batch 방식

추천:

1. 다음 전송 전에 16건 전체를 validate-only로 먼저 확인한다.
   - Google Ads에 실제 구매로 반영하지 않고 형식/기본 오류만 확인하는 단계다.

2. validate-only에서 실패가 없으면 3-5건 단위로 보낸다.
   - 첫 batch: 3건 또는 5건
   - 15-30분 간격으로 장부 status와 Google Ads 진단을 본다.
   - 실패가 0이면 다음 batch를 5-10건까지 늘린다.

3. 293,206원은 별도 처리한다.
   - 원인 없는 재전송은 하지 않는다.
   - 재전송하려면 먼저 실패 사유 저장 보강 또는 validate-only 단건 재검증이 필요하다.

## 코드 보강 필요점

현재 코드의 약점:

- Google Ads 응답의 `partialFailureError` 원문 또는 sanitized message를 장부에 저장하지 않는다.
- `last_error`에는 response hash만 남는다.
- 그래서 실패 후 며칠이 지나면 정확한 원인 복원이 어렵다.

필요한 보강:

1. `partialFailureError.message`를 raw click/order 없이 저장한다.
2. error code, trigger, field path index만 저장한다.
3. raw gclid/order id는 저장하지 않는다.
4. failed row를 재검증할 수 있는 validate-only 단건 진단 endpoint를 만든다.
5. 293,206원처럼 이미 failed가 된 row는 `retry_eligible=false` 기본값으로 두고, 진단이 닫힌 뒤에만 별도 승인으로 재시도한다.

## 검증 로그

- Harness preflight strict: PASS
- VM Cloud SQLite ledger read-only: PASS
- VM Cloud API no-write plan: PASS
- Google Ads offline upload diagnostics read-only: PASS
- Local source code inspection: PASS
- Raw order id 노출: NO
- Raw click id 노출: NO
- Google Ads conversion send: NO
- VM Cloud DB write: NO
- Deploy/restart: NO

## 다음 할일

### Auto Green

1. 293,206원 row의 validate-only 단건 재검증 설계를 만든다.
   - 목적: 실제 전송 없이 Google이 지금도 같은 row를 거절하는지 확인한다.
   - 성공 기준: raw 주문번호/클릭ID를 출력하지 않고, sanitized error code/message만 확인.

2. 실패 응답 저장 보강 패치를 만든다.
   - 목적: 다음 실패부터는 hash만 남지 않게 한다.
   - 성공 기준: `last_error` 또는 별도 진단 필드에 원문 식별자 없는 실패 사유가 남는다.

3. 최근 30일 16건 ready 후보 전체를 validate-only로 먼저 돌리는 승인안을 만든다.
   - 목적: 실제 Google Ads 수치 변경 없이 batch 전송 전 오류를 미리 본다.
   - 성공 기준: 16건 중 통과/실패/보류 사유가 나뉜다.

### Approval Needed

1. 다음 batch 실제 전송
   - 추천: 16건 전체를 바로 보내기보다 3-5건 단위.
   - 이유: 293,206원 같은 실패 row가 다시 생길 때 원인 추적을 쉽게 하기 위해서다.
   - 승인 후 허용 범위: 실제 구매 후보만, click id 있는 row만, 장부 중복 방어 통과 row만.
