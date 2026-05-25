# Google Ads 구매 신호 분해와 NPay 가격 보강 설계 - 2026-05-25

작성 시각: 2026-05-25 23:46 KST
기준일: 2026-05-25
문서 성격: 결과 보고 + 설계 초안

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - data/!data_inventory.md
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
  lane: Yellow
  allowed_actions:
    - Google Ads API read-only 조회
    - VM Cloud SQLite read-only 조회
    - NPay matcher dry-run
    - Google click id 유실 분석 API 최소 패치 배포
    - pm2 restart seo-backend --update-env
    - pm2 save
    - 결과/설계 문서 작성
  forbidden_actions:
    - Google Ads conversion upload
    - Google Ads 전환 액션 설정 변경
    - GTM publish
    - 운영DB write/import
    - VM Cloud bridge/evidence ledger write
    - Imweb header/footer 운영 수정
  source_window_freshness_confidence:
    source: Google Ads API live + VM Cloud SQLite + 운영DB read-only
    window: today 2026-05-25 KST / last_7d 2026-05-18~2026-05-24 KST / NPay 2026-05-18~2026-05-25 KST
    freshness: 2026-05-25 23:41~23:46 KST 재조회
    confidence: high for Google Ads action split, high for VM Cloud click-stage counts, medium_high for NPay price interpretation
```

## 10초 요약

Google Ads가 `구매완료`라고 부르는 값은 현재 실제 결제완료 주문이라기보다 NPay 계열 웹 전환 신호에 거의 전부 묶여 있다.

2026-05-25 오늘 기준 Google Ads `구매완료`는 26건, 5,207,400원이다. 같은 날짜 내부 실제 결제완료 기준 매출과는 약 4,967,400원 차이가 난다.

최근 7일도 같다. Google Ads가 주장하는 구매값 36,299,458원 중 known NPay label 값이 36,299,456원으로 사실상 100%다.

NPay 클릭 신호 가격 문제는 “최근 전체가 0원으로 들어오는 문제”가 아니다. 최근 NPay intent 271건 중 가격 누락/0원은 1건뿐이다. 현재 B급 후보의 핵심은 `가격이 0`이 아니라 `단품 가격과 3+1/묶음/수량/배송비가 최종 주문금액으로 이어지는 규칙을 matcher가 덜 이해하는 것`이다.

## Google Ads가 구매로 세는 것

### 오늘 2026-05-25 KST

source: Google Ads API live `/api/google-ads/dashboard-summary?date_preset=today`
freshness: 2026-05-25 23:41 KST
confidence: high

- Google Ads `구매완료`: 26건 / 5,207,400원
- 이 값의 분류: `primary_known_npay`
- 내부 실제 결제완료와의 차이: 4,967,400원
- Secondary NPay 보조 전환 `TechSol - NPAY구매 50739`: All conv. 26건 / 5,207,400원

캠페인별 오늘 분해:

| 캠페인 | Google Ads `구매완료` 건수 | Google Ads `구매완료` 값 | 해석 |
|---|---:|---:|---|
| `[PM]검사권 실적최대화` | 8 | 3,578,000원 | known NPay label 기반 Primary 구매 신호 |
| `[PM]건기식 실적최대화` | 18 | 1,629,400원 | known NPay label 기반 Primary 구매 신호 |

사람 말로 풀면, Google Ads가 오늘 “구매가 26건 났다”고 말하지만 현재 증거상 그 26건을 그대로 내부 실제 결제완료 26건으로 보면 안 된다.

## 최근 7일 분해

source: Google Ads API live `/api/google-ads/dashboard-summary?date_preset=last_7d`
window: 2026-05-18~2026-05-24 KST
freshness: 2026-05-25 22:23 KST 캐시
confidence: high

- Google Ads Primary 전환값: 36,299,458원
- known NPay label Primary 전환값: 36,299,456원
- known NPay label 비중: 100%
- 내부 실제 결제완료와의 차이: 35,538,559원
- All conv.에만 잡히는 NPay 보조 전환값: 36,759,900원

결론은 단순하다. 최근 7일 Google Ads ROAS가 크게 보이는 가장 큰 이유는 실제 결제완료 주문이 많이 잡혀서가 아니라, Google Ads의 `구매완료` Primary 전환이 NPay 계열 count/웹 전환 신호를 구매로 크게 세고 있기 때문이다.

## Google click id 유실 분석 API 배포 결과

배포 내용: VM Cloud backend `backend/src/routes/googleAds.ts`의 click id 유실 분석 API 시간 비교 보정

왜 했는가:

분석 v2 기준점은 `2026-05-25 06:30 KST`인데, VM Cloud SQLite에는 UTC `Z` 문자열로 시간이 저장된다. 기존 API는 KST `+09:00` 문자열과 UTC 문자열을 그대로 비교해 일부 row가 빠질 수 있었다.

배포 후 확인:

source: `https://att.ainativeos.net/api/google-ads/click-id-dropoff?site=biocom&window=analysis_v2`
freshness: 2026-05-25 23:41 KST
confidence: high

| 단계 | 전체 row | Google click id row | 비율 | 해석 |
|---|---:|---:|---:|---|
| 광고 클릭 직후 URL | 1,100 | 747 | 67.91% | 클릭 직후 URL에는 click id가 충분히 들어온다 |
| 클릭 의도 저장 | 808 | 808 | 100.00% | paid-click 저장은 정상 |
| 구매하기 진입 | 114 | 4 | 3.51% | 구매하기 단계에 오는 Google click 표본이 아직 작다 |
| 결제 화면 체류 | 339 | 11 | 3.24% | 결제 화면에도 일부 남는다 |
| 결제완료 신호 전체 | 59 | 1 | 1.69% | 결제완료 신호 자체에는 1건 남았다 |
| 실제 결제완료 주문 직접 보존 | 27 | 0 | 0.00% | 실제 주문번호와 exact로 붙은 Google click id는 아직 없다 |
| NPay 클릭-주문 exact 후보 | 31 | 22 | 70.97% | NPay 클릭 후보에는 Google click id가 많이 남는다 |

즉 click id가 전혀 저장되지 않는 문제가 아니다. 더 정확한 병목은 `NPay 외부 결제완료 / 내부 주문번호 / Google click id`를 안전하게 하나의 주문 증거로 묶는 bridge다.

## NPay 가격 0 문제 재판정

source: VM Cloud SQLite `npay_intent_log` read-only
window: 2026-05-18~2026-05-25 KST
freshness: 2026-05-25 23:45 KST
confidence: high

- 최근 NPay intent row: 271건
- 가격이 없거나 0원인 row: 1건
- 가격이 있는 row: 270건
- Google click id가 있는 row: 200건

가격 누락/0원 1건은 2026-05-20의 호르몬 검사 상품 row다. 현재의 주된 B급 병목을 대표하지 않는다.

NPay matcher dry-run 기준:

- NPay 실제 결제완료 주문: 24건
- strong match: 21건
- A급: 14건
- B급: 7건
- B급 중 Google click id 있음: 1건
- Google Ads 전송 후보: 0건

B급 7건의 핵심은 아래다.

1. 3+1, 묶음, 수량 옵션으로 최종 주문금액이 단품 가격의 배수로 만들어지는 경우가 있다.
2. 일부 상품은 intent에는 단품 가격이 있고 주문에는 묶음 총액이 들어온다.
3. Google click id가 없는 B급은 내부 분석 후보로는 볼 수 있지만 Google Ads에 보낼 수 없다.
4. Google click id가 있는 B급 1건은 금액은 맞지만 NPay 클릭 후 결제완료까지 12.5분이 걸려 자동 A급으로 올리지 않는다.

## 보강 반영 결과

2026-05-25 23:52 KST에 VM Cloud backend에 no-write matcher 보강을 추가 배포했다.

반영한 것:

- `bundle_multiple_reconciled` 판정을 추가했다.
- 예: `39,000원 상품 클릭 -> 117,000원 주문`처럼 상품명이 정확히 같고 주문금액이 클릭 가격의 작은 정수배이면 내부 bridge 후보에서 금액을 맞는 것으로 읽는다.
- 이 판정은 내부 분석용이다. Google click id가 없으면 Google Ads 전송 후보가 아니다.

배포 후 NPay dry-run 변화:

source: VM Cloud backend local dry-run
window: 2026-05-18~2026-05-25 KST
freshness: 2026-05-25 23:52 KST
confidence: high

| 지표 | 보강 전 | 보강 후 | 해석 |
|---|---:|---:|---|
| NPay 실제 결제완료 주문 | 24 | 24 | 같은 주문 집합 |
| strong match | 21 | 20 | 1건은 더 보수적으로 ambiguous로 남음 |
| A급 | 14 | 15 | 묶음 가격 1건이 내부 A급으로 올라감 |
| B급 | 7 | 5 | 단품가×묶음 문제 2건이 해소됨 |
| `bundle_multiple_reconciled` | 0 | 2 | 묶음/배수 가격으로 설명되는 주문 |
| Google Ads 전송 후보 | 0 | 0 | 외부 전송 후보는 여전히 열지 않음 |

## 추가 보강 설계 초안

### 1단계. NPay 클릭 순간 가격을 더 풍부하게 저장한다

목적: 사용자가 NPay 버튼을 누를 때 “상품 하나 가격”만이 아니라 “실제로 결제될 것으로 보이는 금액”도 같이 남긴다.

추가 수집 후보:

- `product_unit_price`: 상품 기본 단가
- `selected_option_price`: 선택 옵션 가격
- `selected_quantity`: 선택 수량
- `visible_total_price`: 화면에 보이는 총 결제 예상 금액
- `npay_expected_payment_amount`: NPay 버튼 클릭 직전 계산한 예상 결제금액
- `price_source`: 가격을 어디서 읽었는지. 예: product_detail_price, selected_option, order_summary, npay_button_area
- `price_parse_confidence`: high / medium / low

주의:

현재 `npay_intent_log`에는 `product_price` 컬럼만 있다. 바로 스키마를 늘리기보다, 1차는 기존 raw payload에 위 필드를 같이 담고 matcher가 읽게 하는 방식이 더 빠르다. 운영 DB write나 Google Ads 전송은 없다.

### 2단계. matcher가 묶음/배수 금액을 이해하게 한다

목적: `39,000원 상품 클릭 -> 117,000원 주문`처럼 실제로는 같은 상품 3개 또는 3+1 구성이지만 현재는 금액 불일치로 보이는 케이스를 내부 bridge에서 더 정확히 읽는다.

추가 판정 후보:

- `bundle_multiple_reconciled`: 주문금액이 클릭 가격의 2배, 3배, 4배 등이고 상품명이 정확히 맞는 경우
- `line_item_total_reconciled`: 주문 라인아이템 총액과 클릭 상품/옵션 조합이 맞는 경우
- `visible_total_reconciled`: 클릭 당시 화면 총액과 주문금액이 맞는 경우

중요:

이 판정은 내부 분석용 bridge를 개선하는 것이다. Google click id가 없으면 Google Ads 전송 후보가 아니다.

### 3단계. 프론트 보고서 문구를 바꾼다

현재 “금액 불일치”라고만 보이면 TJ님 입장에서는 가격이 틀렸는지, 코드가 0을 보냈는지, 묶음 상품 때문인지 알기 어렵다.

권장 문구:

- 나쁜 표현: `amount_mismatch`
- 좋은 표현: `상품은 맞지만 클릭 당시 단품 가격과 최종 주문금액이 묶음/수량 때문에 다릅니다. 내부 후보로는 더 볼 수 있지만, Google click id가 없으면 Google Ads 전송 후보는 아닙니다.`

## 하지 않은 것

- Google Ads conversion upload: 0건
- Google Ads 전환 액션 설정 변경: 0건
- GTM publish: 0건
- 운영DB write/import: 0건
- VM Cloud bridge/evidence ledger write: 0건
- raw click id / raw order id 문서 출력: 0건

주의: backend restart 후 기존 background job인 Meta CAPI auto-sync가 1건 전송 로그를 남겼다. 이번 작업에서 Google Ads 전송이나 신규 dispatcher를 연 것은 아니지만, backend 재시작은 기존 활성 background job을 다시 깨울 수 있다. 다음 배포 runbook에는 `기존 background job side-effect 확인`을 별도 체크로 넣어야 한다.

## 다음 판단

1. Google Ads ROAS 갭의 1차 원인은 `구매완료` Primary가 실제 결제완료 전용 신호가 아니라 known NPay label 신호에 묶인 것이다.
2. 내부 실제 매출에는 NPay actual 결제완료를 포함해야 한다.
3. 그러나 NPay 클릭/count를 구매완료로 세면 안 된다.
4. 예산 판단은 당분간 `내부 confirmed + NPay actual`을 우선으로 보고, Google Ads ROAS는 플랫폼 주장값으로만 분리해서 본다.
5. 다음 구현은 NPay 가격/묶음 보강과 실제 결제완료 전용 no-send 후보 생성기 고도화가 맞다.
