# Google NPay bridge write smoke 준비 및 최근 7일 재분해 - 2026-05-28

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/APPROVAL_GATES.md
  required_context_docs:
    - data/!data_inventory.md
    - project/google-npay-35000-duplicate-guard-7d-rerun-20260528.md
  lane:
    code_patch: Green
    vm_cloud_write_smoke: Yellow-approved-by-TJ
    google_ads_limited_send: Red-requested-but-not-executed-in-this-note
  allowed_actions:
    - local code patch
    - typecheck
    - VM Cloud read-only API
    - approval packet/update note
  forbidden_actions:
    - Google Ads send before deployed candidate generator confirms ready row
    - production DB write
    - GTM publish
    - ambiguous/B급 automatic send
  source_window_freshness_confidence:
    source: VM Cloud API + local source code
    window: 2026-05-22T00:00:00+09:00 ~ 2026-05-29T00:00:00+09:00
    freshness: live API fetched 2026-05-28 23:02~23:03 KST
    confidence: high for read-only counts; medium until VM deploy/write smoke runs
```

## 한 줄 결론

이번 35,000원 NPay 주문을 Google Ads 실제 구매 전송 후보로 올리려면, 기존 후보 생성기에 `NPay bridge A급 + gclid` 후보를 포함시키는 backend 패치가 필요하다. 로컬 패치와 typecheck는 완료했지만, VM Cloud backend 배포 전에는 실제 write smoke/send를 실행하지 않는다.

## 현재 확인된 최근 7일 숫자

기준: `2026-05-22 00:00 KST ~ 2026-05-29 00:00 KST`

- NPay 버튼/결제 intent: 300건
- Google 유입 계열 intent: 224건
- Google click id 보존 intent: 220건
- 실제 NPay 결제완료: 43건
- 내부 strong match: 22건
- Grade A: 14건
- Grade B: 8건
- ambiguous: 21건
- purchase_without_intent: 0건
- Google click id가 붙은 strong match: 2건
- bridge URL hash와 Google click id까지 같이 있는 Grade A: 1건

## Grade B 8건 분해

| 분류 | 건수 | 해석 | 자동 전송 판단 |
|---|---:|---|---|
| Google click id 없음 + 금액 불일치 | 7 | 내부 주문 연결 후보는 있으나 Google Ads에 보낼 식별자가 없고, 금액도 상품/배송비/수량 조합으로 딱 맞지 않음 | 제외 |
| 시간 간격 초과 | 1 | Google click id와 금액은 있으나 NPay 버튼 클릭부터 결제완료까지 12.6분으로 길다 | 수동 검토, 자동 전송 제외 |

## ambiguous 21건 분해

| 분류 | 건수 | 해석 | 자동 전송 판단 |
|---|---:|---|---|
| 최고 후보 점수 70 미만 | 17 | 주문과 버튼 클릭을 같은 건으로 보기엔 점수 자체가 낮음 | 제외 |
| 비슷한 후보가 여러 개 | 4 | 1등과 2등 후보 차이가 작아 잘못 붙일 위험이 있음 | 제외 |

## 로컬 코드 패치

파일: `backend/src/routes/googleAds.ts`

변경 의도:

1. 기존 Google Ads 실제 구매 전송 후보 생성기는 `자사몰 결제완료 row에 gclid가 직접 남은 주문`만 다뤘다.
2. NPay는 외부 결제창에서 완료되므로 자사몰 결제완료 row에 click id가 직접 남기 어렵다.
3. 그래서 `NPay bridge A급 + orderCreateTimeBridge=exact + bridge URL hash 있음 + gclid 있음 + 결제금액 > 0` 후보를 같은 후보 생성기에 포함했다.
4. 장부 write plan도 private preview 전용 후보 대신 실제 upload candidate builder를 보도록 바꿨다.

검증:

- `cd backend && npm run typecheck`: PASS

## 아직 실행하지 않은 것

- VM Cloud backend deploy: 미실행
- VM Cloud Google Ads upload ledger write smoke: 미실행
- Google Ads limited upload: 미실행
- Google Ads 자동 dispatcher: 미실행

## 다음 gate

1. VM Cloud backend 배포
2. `upload-ledger-write-smoke-plan`에서 이번 35,000원 NPay 후보가 1순위 ready row로 잡히는지 확인
3. `upload-ledger-write-smoke` 1건 실행
4. 같은 row replay 중복 차단 확인
5. `limited-upload?validate_only=1` 형식 검증
6. `limited-upload` 실제 1건 전송

## 운영 판단

이번 35,000원 주문은 최근 7일 중 가장 좋은 Google Ads 실제 구매 전송 seed다. 단, 현재 VM Cloud에 배포된 backend는 아직 NPay bridge 후보를 upload candidate builder에 포함하지 않으므로, 먼저 backend 배포가 필요하다.

## 2026-05-28 23:20 KST 실행 결과

TJ님 승인 범위:

- VM Cloud backend 배포 승인
- VM Cloud Google Ads upload ledger write smoke 승인
- Google Ads 제한 전송 1건 승인

실행 결과:

| 항목 | 결과 | 근거 |
|---|---:|---|
| VM Cloud backend 배포 | 완료 | `googleAds.ts` 단일 파일 반영 후 remote `npm run typecheck`, `npm run build` PASS |
| backend 재시작 | 완료 | `seo-backend` PM2 online |
| health | 정상 | `https://att.ainativeos.net/health` ok, DB true |
| Imweb sync interval | 5분 유지 확인 | `imwebAutoSync.intervalMs=300000` |
| 장부 write smoke | 완료 | 35,000원 후보 1건 ready row insert |
| Google Ads 제한 전송 1건 | 완료 | ledger status `sent`, Google Ads response code `200`, request id present |
| raw 주문번호/click id 노출 | 없음 | smoke/preview response invariant 기준 false |

주의:

- 전송 직후 같은 endpoint를 다시 호출하면 `already_sent`로 막힌다. 이는 실패가 아니라 중복 전송 방어가 작동한 것이다.
- 이번 문서에는 원문 주문번호와 원문 gclid를 남기지 않는다.

## 추가 전송 가능 후보 검토

기준: VM Cloud live API, 2026-05-28 23:20 KST 조회.

| 범위 | 추가 후보 | 해석 | 권장 |
|---|---:|---|---|
| 최근 24시간 | 0건 | 35,000원 NPay 후보는 이미 sent라 replay 차단됨 | 추가 전송 없음 |
| 최근 7일 | 최소 1건 | 240,000원 결제완료 + gclid 직접 증거 후보가 장부 write 가능 상태 | 다음 제한 전송 후보로 적합 |
| 최근 30일 | 최소 20건 중 다수 | 과거 결제완료 + gclid 직접 증거 후보가 있음. 일부는 이미 sent, 일부는 아직 장부 미기록 | bulk 전송 전 일괄 dedupe/상태 검토 필요 |

현재 장부 상태:

| status | rows | amount |
|---|---:|---:|
| sent | 4 | 340,900원 |
| failed | 1 | 293,206원 |

판단:

- 바로 다음으로 보낼 수 있는 후보는 최근 7일의 240,000원 1건이다.
- 최근 30일 후보는 더 많지만, 오늘 목표가 “주 전환 통로를 빠르게 시작”하는 것이므로 한 번에 대량 전송하지 말고 `1~3건씩 제한 전송 → Google Ads 진단/리포트 반영 확인 → batch 확대`가 안전하다.
- failed 1건은 Google Ads response code가 200이지만 partial failure로 보이는 상태라, 같은 row 재전송 전에 error summary를 먼저 분해해야 한다.

## 2026-05-28 23:59 KST 추가 제한 전송 및 30일 후보 분류

harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
  required_context_docs:
    - data/!data_inventory.md
    - project/google-npay-bridge-write-smoke-and-7d-breakdown-20260528.md
  lane: Red Lane
  allowed_actions:
    - VM Cloud backend deploy
    - VM Cloud upload ledger write smoke
    - Google Ads limited upload 1 approved row
    - targeted ledger correction for parser false-negative
  forbidden_actions:
    - bulk Google Ads upload
    - automatic dispatcher enable
    - production DB schema change
    - raw order/click id exposure in report
  source_window_freshness_confidence:
    source: VM Cloud live API + VM Cloud SQLite upload ledger + Google Ads API response
    window: last_7d and last_30d
    freshness: live API fetched 2026-05-28 23:35~23:59 KST
    confidence: high for 240,000 row send status; medium for old failed row root cause

### 240,000원 후보의 결제 시점과 성격

- 결제일: `2026-05-25 KST`
- 결제수단: 카드
- 금액: `240,000원`
- 후보 근거: 실제 결제완료 주문이며 `payment_success` 원장에 Google click id 직접 증거가 남아 있음
- Google Ads 전송 식별자: direct `gclid` 계열
- 원문 주문번호/click id: 문서에 노출하지 않음

해석:

이 주문은 “구글 광고 클릭 → 자사몰 결제완료 → Google click id 직접 보존” 흐름이 맞는 후보다. NPay bridge 추론 후보가 아니라, 결제완료 원장에 직접 Google click id가 남아 있는 더 강한 후보다.

### 실행 결과

| 항목 | 결과 | 해석 |
|---|---:|---|
| VM Cloud backend 1차 배포 | 완료 | 이미 sent인 과거 row가 앞에 있어도 새 ready row를 건너뛰지 않도록 수정 |
| 장부 write smoke | 완료 | 240,000원 후보 1건을 upload ledger에 `ready`로 기록 |
| Google Ads 제한 전송 | 완료 | Google Ads API response code `200`, result count `1`, request id present |
| 최초 장부 판정 | `failed` | Google Ads 응답 파서가 빈 result object를 실패처럼 잘못 해석 |
| VM Cloud backend 2차 배포 | 완료 | Google Ads 응답 파서 수정 |
| 장부 정정 | 완료 | 해당 240,000원 row를 `sent`로 정정. 재전송이 아니라 오판정 보정 |

주의:

- Google Ads에는 1회만 보냈다.
- 장부 정정은 Google Ads에 다시 보내는 작업이 아니다.
- 같은 row를 다시 보내려 하면 장부 중복 방어가 막아야 정상이다.

### 실패 row 1건 원인 분해

현재 실패 row:

- 금액: `293,206원`
- 결제일: `2026-05-28 KST`
- Google Ads response code: `200`
- 상태: `failed`

확인된 원인:

1. 오늘 240,000원 row에서 확인된 직접 원인은 “Google Ads 전송 실패”가 아니라 “응답 파서가 성공 응답을 실패처럼 읽은 코드 문제”였다.
2. 이 문제는 `backend/src/routes/googleAds.ts`에서 수정했고 VM Cloud에 배포했다.
3. 다만 기존 293,206원 failed row는 당시의 raw result detail이 충분히 남아 있지 않아, 240,000원처럼 바로 `sent`로 정정하지 않는다.

판단:

- 293,206원 row는 `보류 후보`다.
- 재전송 전에는 같은 row가 Google Ads에 이미 반영됐는지, 또는 Google Ads 진단 summary에 오류가 남았는지 먼저 봐야 한다.
- 같은 주문을 중복 전송하면 Google Ads 전환값이 부풀 수 있으므로, raw 성공 증거 없이 바로 재전송하지 않는다.

### 최근 30일 후보 분류

기준: VM Cloud live API `candidate-expansion?window=last_30d`, 2026-05-28 23:55 KST 전후 조회.

| 분류 | 건수 | 금액 | 의미 | 처리 |
|---|---:|---:|---|---|
| 보내도 되는 후보 | 22건 | 4,380,027원 | 실제 결제완료이고 Google click id가 직접 남은 주문 | 장부 dedupe 후 제한 전송 가능 |
| 보류 후보 - NPay bridge strong + Google click id | 3건 | 109,000원 | NPay 실제 결제완료와 버튼 클릭 연결은 강하지만 bridge 장부/자동 규칙을 더 닫아야 함 | no-write 검토 후 승격 |
| 보류 후보 - 기존 failed row | 1건 | 293,206원 | Google Ads response code는 200이나 장부 상태가 failed | 진단 summary 확인 후 정정 또는 재전송 판단 |
| 제외 후보 - 실제 구매지만 Google click id 없음 | 1,716건 | 483,479,789원 | 구매는 맞지만 Google Ads에 보낼 click id가 없음 | Google Ads 전송 불가 |
| 제외 후보 - 주문/클릭 연결 증거 부족 | 562건 | 56,559,632원 | 결제는 맞지만 광고 클릭과 안전하게 연결하기 어려움 | Google Ads 전송 불가 |
| 제외 후보 - 실제 구매 아님 | 0건 | 0원 | pending/cancel 등 구매완료가 아닌 후보 | 전송 금지 |

중요 해석:

- “구매가 많다”와 “Google Ads에 보낼 수 있다”는 다르다.
- Google Ads 오프라인 전환은 실제 결제완료만으로는 부족하고, `gclid/gbraid/wbraid` 중 하나가 주문에 안전하게 붙어 있어야 한다.
- 최근 30일 기준 실제 구매는 많지만, Google click id가 직접 남은 후보는 매우 작다. 지금 병목은 구매 부족보다 click id-주문 연결 증거 부족이다.

### 자동 전송 가능성 판단

현재 상태:

- 240,000원처럼 `실제 결제완료 + 직접 gclid + 금액 > 0 + 장부 중복 없음` 후보는 전송 가능하다.
- Google Ads 응답 파서 수정까지 배포되어, 앞으로 같은 응답을 실패로 잘못 읽을 가능성은 낮아졌다.
- 그러나 자동 전송 dispatcher는 아직 켜지 않았다.

자동 전송으로 넘기려면 필요한 조건:

1. 장부 중복 방어가 `sent/ready/failed` 상태별로 안정적으로 작동해야 한다.
2. Google Ads 진단 summary에서 업로드 오류가 없어야 한다.
3. failed 293,206원 row를 정정할지 재전송할지 닫아야 한다.
4. 처음에는 `ready_exact_gclid`만 대상으로 하루 1~3건 제한 자동 전송이 적절하다.
5. NPay bridge 후보는 별도 bridge 장부가 안정화된 뒤 자동 전송 대상에 넣는다.

운영 판단:

지금 당장 전면 자동 전송은 이르다. 다만 `ready_exact_gclid` 전용 소량 자동 전송은 다음 단계 후보로 준비할 수 있다.

### Google Ads 리포트 반영 상태

2026-05-28 23:59 KST 전후 Google Ads dashboard live API 기준:

- `BI confirmed_purchase_offline`: 3건
- 전환값: `304,000원`
- 해석: 현재 Google Ads 리포트에는 이미 반영된 실제 구매 전환만 보이며, 이번에 보낸 `240,000원`은 아직 리포트 전환값에 반영되지 않은 상태다.

판단:

- Google Ads API upload response는 성공 쪽으로 보이며 장부는 `sent`로 정리했다.
- 다만 Google Ads 보고서에는 지연 반영될 수 있으므로 3시간, 12시간, 24시간 재조회가 필요하다.
- 24시간 후에도 `240,000원`이 반영되지 않으면 오프라인 전환 진단 summary와 conversion action report를 함께 재조회한다.

---

## 2026-05-29 00:43 KST 재조회 - 240,000원 반영 지연 / 293,206원 failed row 보류

### 목표

오늘의 목표는 Google Ads 실제 구매 전용 주 전환을 빨리 안정화하는 것이다.

구체적으로는 다음 3가지를 분리한다.

1. Google Ads 화면/API에 이미 보이는 실제 구매 전환값
2. VM Cloud 장부에는 전송 성공으로 남았지만 Google Ads 리포트에는 아직 안 보이는 전환값
3. 장부에는 실패로 남았고 raw 성공 증거가 없어 건드리면 중복 위험이 있는 전환값

### Google Ads 리포트/API 상태

기준:

- source: Google Ads API live
- 조회 시각: 2026-05-29 00:31~00:43 KST
- 기준 window: `LAST_7_DAYS`, `2026-05-22 ~ 2026-05-28 KST`

현재 Google Ads가 주 전환으로 보고 있는 실제 구매 전용 액션:

- 전환 액션: `BI confirmed_purchase_offline`
- 전환 액션 ID: `7609289411`
- 유형: `UPLOAD_CLICKS`
- 상태: `ENABLED`
- Primary 여부: `true`
- 최근 7일 전환수: `3`
- 최근 7일 전환값: `304,000원`

중요 해석:

- TJ님 화면에서 보이는 `304,000원`과 API가 일치한다.
- 2026-05-28의 `35,000원` 1건은 Google Ads 일자별 조회에서 보인다.
- 2026-05-25에 보낸 `240,000원`은 아직 Google Ads 리포트/진단에 반영되지 않았다.

### Google Ads 오프라인 전환 진단 상태

Google Ads API 진단 리소스:

- `offline_conversion_upload_client_summary`
- `offline_conversion_upload_conversion_action_summary`

조회 결과:

- client: `GOOGLE_ADS_API`
- status: `EXCELLENT`
- total event count: `3`
- successful event count: `3`
- success rate: `1`
- last upload datetime: `2026-05-27 01:06:14.391562`
- conversion action: `BI confirmed_purchase_offline`

해석:

- Google Ads 진단은 아직 2026-05-28 밤에 보낸 `240,000원` 업로드를 카운트하지 않는다.
- 진단 기준으로 현재 “Google이 확실히 받았다고 요약해주는 성공 업로드”는 3건뿐이다.
- 따라서 `240,000원` row는 VM Cloud 장부상 `sent`이지만, Google Ads 리포트/진단 반영은 아직 확인 대기다.

### VM Cloud 장부 상태

source:

- VM Cloud SQLite
- table: `google_ads_confirmed_purchase_upload_ledger`

최근 장부 요약:

| safe_ref | 금액 | 결제일 | 장부 상태 | Google 응답 | 판단 |
|---|---:|---|---|---|---|
| `gads_private_1c6fe7d34f4e04` | 240,000원 | 2026-05-25 | `sent` | HTTP 200 | Google Ads 리포트 반영 대기 |
| `gads_private_0db2168e2bc46f` | 35,000원 | 2026-05-28 | `sent` | HTTP 200 | Google Ads 리포트에 1건 확인 |
| `gads_private_f63f81ed72270c` | 293,206원 | 2026-05-28 | `failed` | HTTP 200 | 보류. raw 성공 증거 없음 |
| `gads_private_29e8ed18c35c77` | 35,000원 | 2026-05-26 | `sent` | HTTP 200 | 기존 성공 후보 |
| `gads_private_31670cbdcef49b` | 234,000원 | 2026-05-24 | `sent` | HTTP 200 | 기존 성공 후보 |
| `gads_private_bb913bed8f4fd5` | 36,900원 | 2026-05-20 | `sent` | HTTP 200 | 기존 성공 후보 |

### 293,206원 failed row 닫기 판단

사람 말로 정리하면:

이 row는 “Google에 보낸 흔적은 있는데, Google이 성공으로 받았다고 확정할 증거가 부족한 주문”이다.

확인된 사실:

- HTTP response code는 `200`이다.
- Google Ads request id도 있다.
- 하지만 장부 상태는 `failed`다.
- Google Ads 진단 summary는 아직 성공 3건만 보여준다.
- 당시 raw result body가 장부에 충분히 남지 않았다.

따라서 지금 할 수 없는 것:

- 바로 `sent`로 상태 정정하면 안 된다.
- 바로 재전송하면 안 된다.

이유:

- 이미 Google이 받았는데 우리가 다시 보내면 전환값이 중복될 수 있다.
- 반대로 Google이 받지 않았는데 sent로 바꾸면 실제 구매 전환을 놓친다.
- raw result body가 없으므로 둘 중 하나를 확정할 근거가 부족하다.

닫기 상태:

- `failed row 293,206원 = 보류 / 재검증 대상`
- 다음 재조회에서 Google Ads 진단이 성공 4건 이상으로 늘거나, 리포트에 해당 금액이 나타나면 정정 가능
- 그렇지 않으면 같은 click/order digest 기준으로 재검증 후 제한 재전송 여부 판단

### 현재 “새로 보낼 수 있는” 후보

VM Cloud no-write smoke 기준:

- 다음 깨끗한 후보: `245,000원`
- 결제일: `2026-05-04 KST`
- safe_ref: `gads_private_aba32aa3646087`
- 조건: 실제 결제완료, 직접 `gclid`, 금액 있음, raw 주문번호/click id 비노출 preview 통과
- write decision: `would_insert_ready_row`
- replay decision: `would_block_duplicate_ready_row`

판단:

- 이 후보는 다음 제한 전송 대상으로 볼 수 있다.
- 다만 2026-05-25의 `240,000원`이 아직 Google Ads에 안 보이고, `293,206원` failed row가 열려 있으므로 바로 대량 전송하지 않는다.

### 왜 소량 제한 전송인가

소량 제한은 “계속 1건씩만 보내자”는 뜻이 아니다.

현재만 소량이 필요한 이유:

1. Google Ads 리포트/진단 반영 지연이 있다.
2. `240,000원`이 VM Cloud 장부에는 sent지만 Google Ads 리포트에는 아직 안 보인다.
3. `293,206원` failed row가 raw 성공 증거 없이 남아 있다.
4. 이 상태에서 20~50건을 한 번에 보내면 어떤 row가 반영됐고 어떤 row가 빠졌는지 다시 분해하기 어렵다.

권장 전송 단계:

1. 지금은 다음 후보 1건만 승인 기반으로 전송한다.
2. 3~12시간 후 Google Ads 리포트/진단에 반영되는지 본다.
3. 반영이 정상이고 failed row가 늘지 않으면 5건 단위로 늘린다.
4. 24시간 정상 확인 후 10건 단위 또는 남은 direct-gclid 후보 일괄 전송으로 확장한다.

즉, 한 번에 다 보내면 안 되는 것이 아니라, 지금은 Google Ads 반영 지연과 failed row가 열려 있어서 작은 단위로 추적 가능한 상태를 유지하는 것이 맞다.
