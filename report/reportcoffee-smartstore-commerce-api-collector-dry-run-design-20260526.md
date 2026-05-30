# 더클린커피 스마트스토어 커머스API collector dry-run 설계와 VM 테스트

작성 시각: 2026-05-26 00:50 KST  
기준일: 2026-05-26  
문서 성격: 네이버 커머스API read-only collector 설계 / VM Cloud 접근 테스트 결과  
담당: Codex  
관련 문서: [[reportcoffee-smartstore-playauto-warning-and-naver-commerce-api-review-20260526]], [[reportcoffee-selfmall-smartstore-nosend-reconciliation-20260525]]

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_harness_read:
    - harness/coffee-data/README.md
    - report/reportcoffee-smartstore-playauto-warning-and-naver-commerce-api-review-20260526.md
  lane: Green
  allowed_actions:
    - vm_cloud_read_only_api_probe
    - local_no_raw_design
    - local_json_markdown_output
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
    - secret_or_token_output
  source_window_freshness_confidence:
    source: VM Cloud API probe + local env key-shape check + official Naver Commerce API docs + PlayAuto/Excel reconciliation docs
    window: 2026-04-25 - 2026-05-01 KST
    freshness: 2026-05-26 00:50 KST
    confidence: high for VM probe result, medium for final coffee readiness because coffee Commerce credentials are missing
```

## 10초 요약

VM Cloud에서 네이버 커머스API 토큰 발급 자체는 되는 후보가 있었다. 하지만 그 후보 키로 조회된 상품은 더클린커피가 아니라 바이오컴 상품이었다.

즉 결론은 “VM IP가 네이버 커머스API를 완전히 못 부르는 문제는 아니다”이다. 문제는 더클린커피 스마트스토어용 커머스API 앱 키와 스토어 권한이 아직 확인되지 않았다는 점이다.

따라서 지금은 더클린커피 스마트스토어 매출을 네이버 API primary로 바꾸면 안 된다. PlayAuto 기준 + 경고 운영을 유지하고, 더클린커피 커머스API 키가 준비되면 no-raw collector dry-run으로 재검증한다.

## VM 테스트 결과

테스트 위치는 VM Cloud `34.64.104.94`다. 토큰, secret, raw 주문번호, 고객정보는 출력하지 않았다.

### VM 환경 키 확인

VM Cloud SEO backend env에는 아래 성격의 키만 보였다.

- `BIOCOM_NAVER_ADS_*`
- `PLAYAUTO_*`

보이지 않은 키:

- `THECLEANCOFFEE_NAVER_COMMERCE_*`
- `NAVER_COMMERCE_COFFEE_*`
- `NAVER_SMARTSTORE_COFFEE_*`

`/etc/ceoboard/backend.env`에는 Naver Works 관련 키만 있었다. Naver Works는 사내 업무 도구 연동 성격이고, 스마트스토어 주문 조회용 커머스API와 다르다.

### VM에서 성공한 후보

로컬 `.env`에 있던 `BIOCOM_STORE_APP_ID` / `BIOCOM_STORE_APP_SECRET` 후보는 VM Cloud에서 토큰 발급 200으로 통과했다.

2026-04-25 - 2026-05-01 window에서 raw 없이 집계한 결과:

- 변경 row: 52
- 고유 상품주문 row: 52
- 상세 row: 52
- 주문 distinct count: 52
- gross amount: 5,540,740원
- 상태: 구매결정 49, 취소 3
- 한 날짜 조회에서 429 rate limit이 1회 발생했지만, 수집된 ID 상세 조회는 성공

중요한 판정:

조회된 상위 상품이 바이오컴 알러지 검사, 구아검, 바이오컴 뉴로마스터 쪽이었다. 더클린커피 원두/드립백 상품이 아니다.

따라서 이 키는 더클린커피 스마트스토어 primary로 쓰면 안 된다.

### 실패한 후보

`NAVER_COFFEE_*` 값은 커머스API 키로 쓰려고 하면 서명 단계에서 `Invalid salt`가 난다.

사람 말로 풀면, 이 키는 스마트스토어 주문을 읽는 키가 아니라 네이버 광고 API 키 모양이다. 광고비 조회에는 쓸 수 있지만 스마트스토어 주문 조회에는 못 쓴다.

## 현재 판정

현재 판정은 `blocked_access`다.

더 자세히 쓰면:

- 데이터가 없는 것이 아니다.
- 네이버 커머스API가 없는 것도 아니다.
- VM IP가 전부 막힌 것도 아니다.
- 다만 더클린커피 스마트스토어용 커머스API 앱 키와 스토어 권한이 아직 없다.

그래서 더클린커피 스마트스토어 매출 API 직접 조회는 아직 실패로 본다.

## collector dry-run 설계

목표는 PlayAuto, Excel, 네이버 커머스API 세 값을 같은 기간으로 비교하는 것이다. 단, raw 주문번호, 상품주문번호, 구매자명, 연락처, 결제키, 토큰, secret은 출력하지 않는다.

### 입력

우선순위로 찾을 env 이름:

1. `THECLEANCOFFEE_NAVER_COMMERCE_CLIENT_ID`
2. `THECLEANCOFFEE_NAVER_COMMERCE_CLIENT_SECRET`
3. `NAVER_COMMERCE_COFFEE_CLIENT_ID`
4. `NAVER_COMMERCE_COFFEE_CLIENT_SECRET`
5. `NAVER_SMARTSTORE_COFFEE_CLIENT_ID`
6. `NAVER_SMARTSTORE_COFFEE_CLIENT_SECRET`

운영 위치는 VM Cloud가 유리하다. 이유는 VM Cloud IP가 기존 커머스API 후보 토큰 발급에는 성공했고, MacBook 로컬 호출은 이전 테스트에서 `GW.IP_NOT_ALLOWED`였기 때문이다.

### 처리 순서

1. credential preflight
   - 무엇: 더클린커피 커머스API 키가 있는지 값 출력 없이 확인한다.
   - 성공 기준: client id와 client secret이 있고, VM Cloud에서 토큰 발급 200.

2. changed-status fetch
   - 무엇: 변경 상품 주문 목록을 읽는다.
   - 쉬운 설명: 네이버가 “이 기간에 상태가 바뀐 주문” 목록을 준다.
   - 성공 기준: 변경 row와 고유 상품주문 row count가 나온다.

3. detail aggregate
   - 무엇: 상품 주문 상세를 메모리에서 읽고 바로 합산한다.
   - 쉬운 설명: 주문 하나하나를 저장하지 않고, 금액/상태/상품명 묶음만 계산한다.
   - 성공 기준: 주문수, 금액, 상태별 count, TOP 상품 bucket이 나온다.

4. scope guard
   - 무엇: 상품명이 더클린커피인지 확인한다.
   - 왜: 이번 VM 테스트처럼 토큰이 되더라도 바이오컴 스토어일 수 있기 때문이다.
   - 성공 기준: 더클린커피 원두/드립백/커피 상품이 대부분이다.

5. reconciliation
   - 무엇: 같은 KST 기간에서 네이버 API, PlayAuto, Excel을 비교한다.
   - 성공 기준: 차이가 닫히거나, 차이 사유가 `날짜 기준`, `상태 기준`, `정산 조정`, `source scope mismatch` 중 하나로 분류된다.

## 중요한 설계 주의점

`last-changed-status` API는 “결제일 기준 전체 주문을 한 번에 다 주는 API”라기보다 “최근 상태가 바뀐 주문을 가져오는 API”에 가깝다.

그래서 장기적으로는 매일 cursor를 돌려 로컬/VM cache를 쌓아야 안정적이다. 단, cache write는 아직 승인받지 않았으므로 이번 단계에서는 메모리 집계 dry-run만 한다.

운영 전환 구조는 이렇게 나눈다.

- Green: no-write, no-send dry-run. count/amount/status/product bucket만 출력.
- Yellow: TJ님 승인 후 로컬 또는 VM SQLite cache에 커머스API 집계 cache 적재.
- Red: 운영DB write, 외부 전송, 광고 플랫폼 전환 전송. 현재 범위 아님.

## PlayAuto와의 관계

현재 PlayAuto 기준은 계속 유지한다.

2026-04-25 - 2026-05-01:

- PlayAuto: 1,839,340원 / 53 rows
- Excel: 1,905,140원 / 55건
- 차이: -65,800원 / -2 rows

네이버 커머스API가 더클린커피 scope로 열리면 이 차이를 줄일 수 있다. 하지만 오늘 확인된 VM 커머스API 후보는 바이오컴 scope라서 이 차이를 설명하는 데 쓰면 안 된다.

## Track 진척률

- Track A Source Rule: 87% -> 88% (+1%)
- Track B Coffee Sales Source: 100% -> 100% (+0%)
- Track C Coffee Ad Spend Source: 100% -> 100% (+0%)
- Track D Biocom Report Source Map: 74% -> 74% (+0%)
- Track E Slack no-send / Schedule: 100% -> 100% (+0%)
- Track F Automation Guard: 100% -> 100% (+0%)

## 하지 않은 것

- Slack 실제 발송 0건
- 운영DB write 0건
- VM Cloud write/deploy/restart 0건
- 광고 플랫폼 send/upload 0건
- GTM publish 0건
- raw 주문/상품주문/결제/고객 식별자 출력 0건
- secret/token 출력 0건

## 다음 할 일

### Auto Green

1. 커머스API no-raw collector 스크립트 초안을 만든다.
   - 무엇: env 키가 준비되면 VM 또는 로컬에서 같은 JSON schema로 집계하는 스크립트다.
   - 왜: 다음번 키 등록 후 바로 재검증하려면 실행 경로가 있어야 한다.
   - 어떻게: 입력은 `--start`, `--end`, `--env-prefix`, 출력은 count/amount/status/top_products만 둔다.
   - 성공 기준: 키가 없으면 `missing_credential`, 키가 있으면 raw 없는 aggregate JSON을 출력한다.
   - 담당: Codex
   - 추천 점수/자신감: 88%

2. PlayAuto warning 유지
   - 무엇: Slack no-send와 HTML 보고서에서 스마트스토어 warning을 유지한다.
   - 왜: 네이버 API가 아직 더클린커피 scope로 열리지 않았기 때문이다.
   - 성공 기준: 스마트스토어 줄에 PlayAuto 기준과 API 미검증 경고가 같이 보인다.
   - 담당: Codex
   - 추천 점수/자신감: 95%

### Approval Needed

1. 더클린커피 커머스API 앱 키를 발급/확인한다.
   - 무엇: 더클린커피 스마트스토어용 커머스API 앱의 client id와 client secret을 확인한다.
   - 왜: 지금 성공한 키는 바이오컴 scope라서 더클린커피 매출 조회에 쓸 수 없다.
   - 어떻게: 네이버 커머스API센터에서 더클린커피 스토어 앱을 확인하고, 호출 IP는 VM Cloud `34.64.104.94`를 우선 등록한다.
   - 성공 기준: VM Cloud에서 토큰 발급 200, 상품 scope가 더클린커피로 확인된다.
   - 담당: TJ님
   - 추천 점수/자신감: 82%

### Blocked/Parked

1. 네이버 커머스API를 스마트스토어 primary로 승격
   - 현재 보류한다.
   - 이유: 더클린커피 scope가 확인되지 않았고, 오늘 VM 테스트는 바이오컴 상품만 반환했다.
   - 재개 조건: 더클린커피 커머스API 키와 VM IP 허용이 확인된다.
