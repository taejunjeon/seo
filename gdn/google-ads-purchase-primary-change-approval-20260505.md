# Google Ads `구매완료` Primary 변경 승인안

작성 시각: 2026-05-05 02:38 KST
대상: biocom Google Ads account `2149990943`, Google tag `AW-304339096`
문서 성격: 승인 요청 전 검토 문서
관련 문서: [[!gdnplan]], [[google-ads-npay-purchase-contamination-report-20260505]], [[google-ads-npay-quality-deep-dive-20260505]], [[google-ads-campaign-signal-audit-20260505]], [[google-ads-confirmed-purchase-execution-approval-20260505]]
Lane: Red for execution
Mode: 문서 작성만 Green. Google Ads 설정 변경은 승인 전 금지.

## 10초 결론

`구매완료` 전환 액션은 Google Ads에서 primary purchase로 잡혀 있지만, label은 아임웹 자동 NPay count `AW-304339096/r0vuCKvy-8caEJixj5EB`와 일치한다.
최근 7일 Google Ads `Conv. value` `66,464,812.82원` 중 `66,464,810.58원`이 이 action에서 나왔다.

따라서 이 action을 지금처럼 primary purchase로 계속 두는 것은 위험하다.
다만 바로 끄면 자동입찰 학습이 흔들릴 수 있으므로, 권장안은 `새 confirmed purchase 전환을 병렬 준비 -> 기존 구매완료를 Secondary로 낮춤 -> 7일 모니터링`이다.
실행 승인 문서는 [[google-ads-confirmed-purchase-execution-approval-20260505]]로 분리했다.
이 승인안의 기준은 `NPay 매출 제외`가 아니라 `NPay 실제 결제완료는 포함, NPay 클릭/결제시작은 구매 제외`다.

Codex 추천은 `승인안 준비 92%`, 실제 변경은 `TJ 승인 후 80%`다.

2026-05-05 09:32 KST read-only 보강 결과, 최근 14일 캠페인 `Conv. value`는 사실상 전부 primary NPay label에서 발생했다.
GA4/GTM의 NPay click-as-purchase는 `2026-04-24 23:45 KST` v138 이후 줄었지만, Google Ads primary `구매완료` value는 그 이후에도 매일 발생한다.
따라서 Google Ads 쪽 purchase primary는 아직 결제완료 기준으로 바뀌지 않았다.

## 승인 요청 이름

Google Ads `구매완료` action `7130249515` primary 제외 및 confirmed purchase 전환 신설 준비

## 현재 문제

Google Ads는 `구매완료`라는 이름의 전환 액션을 purchase primary로 사용하고 있다.
운영자는 이 이름을 보고 실제 구매 완료 매출이라고 해석하기 쉽다.

하지만 확인된 label은 아래와 같다.

```text
conversionAction: 7130249515
name: 구매완료
category: PURCHASE
primaryForGoal: true
send_to: AW-304339096/r0vuCKvy-8caEJixj5EB
```

아임웹 footer에는 같은 label이 NPay count로 들어 있다.

```html
GOOGLE_ADWORDS_TRACE.setUseNpayCount(true,"AW-304339096/r0vuCKvy-8caEJixj5EB");
```

즉 Google Ads가 구매 매출로 학습하는 신호가 실제 confirmed order가 아니라 NPay count 경로일 가능성이 높다.

## 1번. affected campaign/bid strategy read-only 조회 결과

source: `Google Ads API v22`, customer `2149990943`, window `LAST_14_DAYS`
output: `data/google-ads-campaign-signal-audit-20260505-last14.json`

| 캠페인 | 상태 | 채널 | 입찰 | 일예산 | 최근 14일 비용 | 최근 14일 Conv. value | primary NPay 비중 | 영향 판정 |
|---|---|---|---|---:|---:|---:|---:|---|
| `[PM]검사권 실적최대화` | ENABLED | PERFORMANCE_MAX | MAXIMIZE_CONVERSIONS | 240,000원 | 3,418,001원 | 53,158,638원 | 100% | 영향 큼. 감액 또는 pause test 후보 |
| `[PM]건기식 실적최대화` | ENABLED | PERFORMANCE_MAX | MAXIMIZE_CONVERSIONS | 320,000원 | 4,184,674원 | 41,669,299원 | 100% | 영향 큼. 감액 또는 pause test 후보 |
| `[PM] 이벤트` | PAUSED | PERFORMANCE_MAX | MAXIMIZE_CONVERSIONS | 280,000원 | 2,820,144원 | 27,338,330원 | 100% | 이미 중지. 재개 금지 후보 |
| `[SA]바이오컴 검사권` | ENABLED | SEARCH | MAXIMIZE_CONVERSIONS | 50,000원 | 693,721원 | 1,329,006원 | 100% | 검색 의도 캠페인. 소액 cap 유지 후보 |

`[SA]바이오컴 검사권`은 트래픽만 받는 캠페인이라는 뜻이 아니다.
`SEARCH` 채널이므로 사용자가 관련 검색어를 입력한 뒤 들어오는 수요 포착 캠페인이다.
전환 신호 오염은 동일하게 있으나, PM/PMax와 달리 검색어 의도가 있으므로 소액 cap으로 분리 유지한 뒤 주문 단위 조인으로 판단한다.

## 2번. confirmed purchase 전환 설계 결과

현재 추천은 `새 confirmed purchase 전환을 병렬로 만들고, 기존 구매완료를 Secondary로 낮추는 것`이다.
단순히 기존 `AW-304339096/r0vu...` label을 다른 label로 치환하는 방식은 금지한다.

### 후보 A. 결제완료 페이지 client-side 태그

- 추천: `58%`
- 장점: 구현이 빠르고 홈페이지 결제는 잡기 쉽다.
- 한계: NPay처럼 자사몰 결제완료 페이지로 돌아오지 않는 흐름을 놓친다.
- 판단: 홈페이지 결제 보조 신호로는 가능하지만, NPay 포함 정본 purchase로는 부족하다.

### 후보 B. Google Ads offline conversion import

- 추천: `86%`
- 장점: Imweb/Toss/NPay confirmed order 기준으로만 value를 보낼 수 있다.
- 한계: 랜딩 또는 체크아웃 시점에 `gclid`, `gbraid`, `wbraid`를 저장해야 한다.
- 판단: Google Ads confirmed purchase 정본으로 가장 적합하다.

### 후보 C. Enhanced conversions for web

- 추천: `66%`
- 장점: 이메일/전화번호 같은 1st-party customer data를 해시해 매칭 품질을 높일 수 있다.
- 한계: 클릭 신호를 구매 신호로 잘못 세는 문제를 자동으로 고치지는 않는다.
- 판단: 정본 purchase 전환의 보조 매칭 품질 개선책이다.

### 권장 실행 순서

1. `BI confirmed_purchase` 같은 새 전환 action을 만든다.
2. 처음에는 Secondary 또는 observation 상태로 둔다.
3. Imweb/Toss/NPay confirmed order만 value를 갖게 한다.
4. `gclid`, `gbraid`, `wbraid`, order id, conversion time, value, currency를 no-send dry-run으로 검증한다.
5. 7일 병렬 수집 후 기존 `구매완료` action `7130249515`를 Secondary로 낮춘다.
6. 24시간, 72시간, 7일 단위로 Google Ads value, 내부 confirmed revenue, 일반 결제 시작, NPay confirmed 주문을 모니터링한다.

### Google Ads 퍼널 신호 판단

Meta CAPI처럼 스크롤 깊이/체류시간을 바로 purchase 최적화로 보내면 안 된다.
Google Ads에서는 아래처럼 분리한다.

| 신호 | 처리 | 이유 |
|---|---|---|
| confirmed purchase | 새 정본 purchase 전환 후보 | 실제 매출 |
| begin_checkout / add_payment_info | Secondary 또는 GA4 key event 관찰 | 구매 전 단계 |
| 90초 이상 체류 + 75% 스크롤 | 내부 `ProductEngagementSummary` 또는 audience | 관심도. 매출 아님 |
| NPay click | purchase 금지. `add_payment_info` 또는 intent | 클릭과 결제완료 분리 |

## 선택지

### 선택지 A. 그대로 둔다

- 추천: `18%`
- 장점: 자동입찰 충격이 없다.
- 단점: Google Ads ROAS와 자동입찰 학습이 계속 오염된다.
- 판단: 권장하지 않는다.

### 선택지 B. `구매완료`를 바로 Secondary로 낮춘다

- 추천: `68%`
- 장점: 오염된 primary purchase 학습을 빠르게 줄인다.
- 단점: 대체 confirmed purchase 전환이 없으면 자동입찰 학습량이 급감할 수 있다.
- 판단: 현금 소진 방어가 급하면 가능하다. 하지만 대체 신호 준비가 먼저인 편이 안전하다.

### 선택지 C. 새 confirmed purchase 전환을 병렬로 만들고, `구매완료`를 Secondary로 낮춘다

- 추천: `86%`
- 장점: Google이 배울 새 정본 구매 신호를 만들고, 기존 오염 신호를 참고용으로 낮춘다.
- 단점: 구현과 모니터링이 필요하다.
- 판단: 기본 권장안이다.

### 선택지 D. Google Ads 전체를 끈다

- 추천: `62%`
- 장점: 오염된 자동입찰로 인한 광고비 소진을 즉시 막는다.
- 단점: 검색 의도 캠페인의 일부 유효 매출 가능성까지 끊는다.
- 판단: 전환 신호 수정이 늦어지고 현금 방어가 최우선이면 선택한다.

## 권장 실행 순서

1. 현 상태에서는 Google Ads 증액을 중단한다.
2. PM/PMax 계열 예산은 30~50% 감액 또는 7일 pause test 후보로 둔다.
3. `[SA]바이오컴 검사권` 같은 검색 의도 캠페인은 소액 cap으로 분리 유지한다.
4. 새 confirmed purchase 전환 설계를 확정한다.
5. 새 전환이 test-only 또는 observation 상태로 정상 수신되는지 확인한다.
6. 그 뒤 `구매완료` action `7130249515`를 Secondary로 낮춘다.
7. 24시간, 72시간, 7일 단위로 Google Ads value, 내부 confirmed 매출, NPay confirmed 매출, 일반 결제 시작을 모니터링한다.

## 허용 범위

TJ님이 이 문서를 승인하면 허용되는 일:

- Google Ads UI에서 action `7130249515`의 primary/goal 포함 여부를 확인.
- 새 confirmed purchase 전환 설계 문서 작성.
- 변경 전 campaign bid strategy와 affected campaigns read-only 조회.
- 변경 전/후 모니터링 체크리스트 작성.

이 문서 승인만으로 아직 허용하지 않는 일:

- Google Ads 전환 액션 변경.
- conversion upload.
- GTM publish.
- 아임웹 footer 변경.
- 운영 DB write.
- 외부 플랫폼 전송.

실제 전환 액션 변경은 별도 실행 승인 문구가 필요하다.

## Hard Fail

아래 중 하나라도 발견되면 변경을 중단한다.

1. `구매완료` action이 특정 캠페인 bid strategy의 유일한 conversion goal이고, 대체 전환이 전혀 없다.
2. 새 confirmed purchase 전환의 transaction_id/value/currency가 안정적으로 들어오지 않는다.
3. Google Ads UI에서 action 변경이 계정 전체 기본 목표에 예상보다 넓게 영향을 준다.
4. 변경 후 24시간 내 핵심 검색 캠페인의 클릭/전환 지표가 급락하고 내부 confirmed 매출도 같이 하락한다.

## Success Criteria

성공 기준은 아래다.

1. `구매완료` NPay label이 더 이상 purchase primary 학습 신호의 중심이 아니다.
2. 새 confirmed purchase 전환은 실제 confirmed order 기준으로만 value를 갖는다.
3. Google Ads 화면의 platform ROAS와 내부 confirmed ROAS가 분리 표시된다.
4. 7일 모니터링에서 광고비 소진은 줄고, 내부 confirmed 매출 급락은 없다.

## Rollback

문제 발생 시 되돌리는 순서:

1. 변경한 Google Ads conversion goal/action 설정을 이전 상태로 복구한다.
2. 새 confirmed purchase 전환은 Secondary 또는 observation 상태로 낮춘다.
3. PM/PMax 예산 감액을 원복할지 별도 판단한다.
4. 변경 시각 전후 24시간의 Google Ads API, GA4 raw, 내부 confirmed order를 비교한다.

## TJ님 승인 문구 초안

아래 문구를 명시적으로 승인해야 실제 변경 단계로 넘어간다.

```text
YES. Google Ads `구매완료` action 7130249515의 primary 제외 준비를 승인합니다.
단, 바로 변경하지 말고 새 confirmed purchase 전환 설계와 affected campaign/bid strategy 확인 후 변경 실행안을 다시 보고하세요.
```

## 다음 할일

### Codex가 할 일

1. affected campaign/bid strategy read-only 조회
- 추천/자신감: `88%`
- 상태: 완료. 결과는 이 문서의 `1번. affected campaign/bid strategy read-only 조회 결과`와 [[google-ads-campaign-signal-audit-20260505]]에 반영했다.
- 무엇을 하는가: `구매완료` action이 영향을 주는 캠페인과 입찰 전략을 조회했다.
- 왜 하는가: primary 변경 시 학습 충격 범위를 알아야 한다.
- 어떻게 하는가: Google Ads API read-only로 campaign, bidding_strategy, conversion goal 관련 필드를 조회한다.
- 성공 기준: 변경 영향 캠페인 목록이 나온다.
- 승인 필요: NO.

2. confirmed purchase 전환 설계 문서 작성
- 추천/자신감: `86%`
- 상태: 1차 완료. 실제 실행 승인 문서는 다음 단계에서 별도 분리한다.
- 무엇을 하는가: client-side 전환과 offline conversion import 중 어느 쪽이 맞는지 비교했다.
- 왜 하는가: 오염된 NPay count를 내리기 전에 대체 구매 신호가 필요하다.
- 어떻게 하는가: Imweb order, Toss/NPay confirmed, gclid/gbraid/wbraid 저장 가능성을 대조한다.
- 성공 기준: 구현 후보, 리스크, 롤백 기준이 정리된다.
- 승인 필요: 문서 작성 NO, 실제 전송 YES.

3. Google Ads confirmed purchase 실행 승인 문서 분리
- 추천/자신감: `88%`
- 상태: 완료. [[google-ads-confirmed-purchase-execution-approval-20260505]]에 분리했다.
- 무엇을 하는가: 실제 Google Ads 변경/전송 전, 새 전환 action 생성과 offline conversion dry-run 절차를 별도 승인 문서로 만든다.
- 왜 하는가: 이 문서는 변경 승인 전 검토이고, 실제 실행은 Red Lane이라 더 좁은 실행 승인서가 필요하다.
- 어떻게 하는가: 전환 action 이름, payload, no-send 검증, 병렬 기간, rollback 기준을 적는다.
- 성공 기준: TJ님이 실행 여부를 문구로 승인할 수 있다.
- 승인 필요: 문서 작성 NO, 실행 YES.

### TJ님이 할 일

1. PM/PMax 예산 방어선 결정
- 추천/자신감: `82%`
- 무엇을 하는가: PM/PMax 계열을 30~50% 감액할지 7일 pause test할지 결정한다.
- 왜 하는가: 전환 신호를 고치기 전까지 자동입찰 성과를 믿기 어렵다.
- 어떻게 하는가: Google Ads UI에서 `[PM]검사권 실적최대화`, `[PM]건기식 실적최대화`, `[PM] 이벤트`만 분리해서 본다.
- 성공 기준: 광고비 소진을 줄이면서 검색 의도 캠페인은 보존한다.
- Codex 대체 가능 여부: NO. 실제 예산 변경은 사업 판단이다.
- 승인 필요: YES.
