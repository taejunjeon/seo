작성 시각: 2026-05-29 01:23 KST
기준일: 2026-05-29
문서 성격: Google Ads 실제 결제완료 전환 245,000원 제한 전송 및 반영 시간 모니터링 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
  required_context_docs:
    - project/google-ads-confirmed-purchase-send-auto-dispatch-result-20260527.md
    - project/google-ads-duplicate-send-ledger-design-20260526.md
    - project/google-ads-vm-confirmed-priority-and-pending-sync-result-20260527.md
  lane: Red_approved
  approved_by: TJ님 chat explicit approval
  approved_action:
    - Google Ads confirmed_purchase limited send 1 row, 245000 KRW
    - VM Cloud upload ledger write for that candidate
    - read-only reflection monitor heartbeat
  allowed_actions:
    - send only the approved 245000 KRW actual-purchase candidate
    - patch VM Cloud candidate scanner to reach unsent candidates after existing sent/failed rows
    - monitor Google Ads report every 15 minutes
  forbidden_actions:
    - expose raw order id or raw click id in report
    - operational DB write
    - send unapproved batch candidates
    - send click-only or non-confirmed purchase rows as purchase
  source_window_freshness_confidence:
    source: VM Cloud SQLite + VM Cloud API + Google Ads API
    window: last_30d, payment_complete_time basis
    freshness: live at 2026-05-29 01:18 KST
    confidence: high for upload response and VM ledger, medium for Google Ads report reflection until platform aggregation catches up
```

## 10초 요약

Google Ads에 실제 결제완료 주문 245,000원 1건을 제한 전송했다.

전송 자체는 Google Ads API 기준 성공했고, VM Cloud 전송 장부에는 `sent`로 남았다. Google Ads 리포트에는 아직 이 245,000원과 직전 240,000원이 반영되지 않았다.

앞으로는 15분마다 리포트를 읽어, 전송 후 실제 리포트에 잡히기까지 걸리는 시간을 자동으로 쌓는다. 10건 정도 쌓이면 평균 반영 시간을 계산한다.

## 무엇이 가능해졌나

`BI confirmed_purchase_offline`은 Google Ads가 입찰 학습에 쓰는 실제 구매 전용 전환 통로다.

이번 작업으로 이전에 이미 보낸 row와 실패 row가 앞에 있어도, 뒤쪽의 새 후보까지 스캔해서 장부에 올리고 보낼 수 있게 했다. 즉 “후보가 있는데 기존 row에 막혀 못 보내는 문제”를 고쳤다.

## 전송 결과

- 전환 액션: `BI confirmed_purchase_offline`
- 전송 금액: 245,000원
- 전송 건수: 1건
- 결제완료일: 2026-05-04 KST
- Google Ads API 응답: HTTP 200
- partial failure: false
- result count: 1
- request id: 있음
- VM Cloud 장부 상태: `sent`
- raw 주문번호 노출: false
- raw click id 노출: false

## 현재 Google Ads 리포트 반영 상태

2026-05-29 01:18 KST 조회 기준:

- `BI confirmed_purchase_offline` 리포트 전환수: 4건
- 리포트 전환값: 340,900원
- 직전 35,000원 전송분: 반영된 것으로 보임
- 2026-05-28 밤 240,000원 전송분: 아직 미반영
- 이번 245,000원 전송분: 아직 미반영

해석:

Google Ads API 전송 성공과 Google Ads 리포트 집계 반영은 같은 순간에 일어나지 않는다. 지금은 전송은 성공했고, 리포트 집계가 뒤따라오는 중으로 보는 것이 맞다.

## 추가 후보 여부

245,000원 1건만 있는 것은 아니다.

최근 30일 실제 결제완료 기준으로 Google click id가 직접 붙은 후보는 22건이다. 이미 보낸 row와 실패 row를 제외해도, no-write 계획 기준으로 16건이 추가 ready 후보로 보인다.

다만 이번 승인 범위는 “245,000원 1건 제한 전송”이었기 때문에, 그 1건만 실제 전송했다. 추가 후보는 별도 batch 기준과 승인 또는 자동 전송 정책이 필요하다.

## 293,206원 실패 row 해석

`HTTP 200`은 Google Ads 서버가 요청을 정상적으로 받아서 응답했다는 뜻이다.

하지만 Google Ads 전환 업로드는 한 요청 안에서 개별 전환 row가 실패할 수 있다. 그래서 HTTP 200만으로 “그 주문 1건이 Google Ads에 구매로 등록됐다”고 볼 수 없다.

`raw 성공 증거 부족`이라는 말은, 이 293,206원 row에 대해 “Google이 이 특정 전환 row를 성공으로 받아들였다”는 개별 성공 결과를 장부에서 확인하지 못했다는 뜻이다. 원문 주문번호나 원문 click id를 저장하지 않도록 설계했기 때문에, 현재 장부에는 실패 hash와 request id만 남아 있다.

닫는 방법:

1. Google Ads 오프라인 전환 진단 summary를 재조회한다.
2. 실패 row의 sanitized error code/message를 저장하도록 장부를 보강한다.
3. raw 주문번호와 raw click id는 계속 노출하지 않는다.

## 반영 시간 모니터링

15분 간격 heartbeat 자동화를 등록했다.

- 자동화 이름: Google Ads reflection monitor
- 자동화 id: `google-ads-offline-conversion-reflection-monitor`
- 기준: VM Cloud `google_ads_confirmed_purchase_upload_ledger`의 `sent` row
- 비교 대상: Google Ads API 리포트의 `BI confirmed_purchase_offline`
- 목표: 앞으로 반영되는 10건의 첫 반영 시각을 모아 평균/중앙값/최소/최대 반영 시간을 계산

현재까지의 관찰:

- 2026-05-26 밤 첫 35,000원 전송분은 약 8시간대에 Google Ads 리포트에서 확인된 것으로 보인다.
- 2026-05-28 밤 240,000원 전송분은 전송 후 약 1시간 10분 시점에는 아직 리포트 미반영이었다.
- 따라서 지금 기준 예상 반영 시간은 “수십 분”보다 “몇 시간” 쪽에 가깝다. 확정 평균은 10건 관찰 후 계산한다.

## 2026-05-29 13:10 KST 추가 — 클릭 날짜 기준 vs 실제 결제 날짜 기준

Google Ads 화면에서 날짜가 헷갈리는 이유를 분리했다.

같은 실제 구매 전환도 Google Ads에서는 두 방식으로 볼 수 있다.

1. 클릭 날짜 기준: 고객이 광고를 클릭한 날에 성과를 붙인다.
2. 실제 결제 날짜 기준: 고객이 실제로 결제한 날에 성과를 붙인다.

2026-05-29 13:10 KST API 조회 결과, `BI confirmed_purchase_offline`은 두 기준 모두 합계가 같다.

- 총 전환수: 9건
- 총 전환값: 1,555,827원
- source: Google Ads API `customer` / `campaign`
- window: 2026-05-01 ~ 2026-05-29
- confidence: high for aggregate total, medium_high for row-level matching because Google Ads report does not expose raw order number

다만 날짜별로는 차이가 난다.

예를 들어 실제 결제 날짜 기준으로 2026-05-17에 245,000원 1건과 234,927원 1건이 잡혔다. 하지만 클릭 날짜 기준으로 보면 그 값 일부가 2026-05-13~2026-05-14 쪽에 나뉘어 보인다. 이것은 Google Ads가 데이터 기반 기여 분석으로 여러 광고 접점에 성과를 나누기 때문이다.

### 245,000원 반복 row 분류

VM Cloud 전송 장부에는 245,000원 `sent` row가 11건 있다.

이번 추가 조회로 아래처럼 나눌 수 있다.

- 이미 반영 가능성 높음: 4건 / 980,000원
  - id 487: 결제 날짜 2026-05-15
  - id 488: 결제 날짜 2026-05-17
  - id 495: 결제 날짜 2026-05-18
  - id 496: 결제 날짜 2026-05-19
- 아직 대기: 7건 / 1,715,000원
  - id 473: 결제 날짜 2026-05-04
  - id 476: 결제 날짜 2026-05-07
  - id 477: 결제 날짜 2026-05-07
  - id 478: 결제 날짜 2026-05-08
  - id 479: 결제 날짜 2026-05-09
  - id 485: 결제 날짜 2026-05-10
  - id 486: 결제 날짜 2026-05-11
- 확인 불가: 0건

해석:

반영된 4건은 결제 날짜와 금액 조합이 Google Ads API의 `conversions_by_conversion_date` 결과와 맞는다. 아직 대기 7건은 Google Ads가 클릭 날짜 기준으로 늦게 배분하거나, 더 오래 걸리거나, 일부가 최종 반영되지 않을 수 있다. 다음 모니터링에서는 이 7건이 결제 날짜 기준 또는 클릭 날짜 기준 중 어디로 나타나는지 계속 본다.

### last-click 하이브리드 판단

last-click은 “마지막 광고 클릭 하나에 구매 성과를 100% 붙이는 방식”이다.

운영 판단용 보조 지표로는 유용하다. 어떤 클릭이 주문과 이어졌는지 사람이 이해하기 쉽고, 245,000원 반복 row처럼 같은 금액이 여러 번 있는 경우에도 추적이 단순해진다.

하지만 지금 Google Ads의 실제 주 전환 액션을 last-click으로 바꾸는 것은 보류한다.

이유:

1. 2026-05-29 13:13 KST API 확인 기준, `BI confirmed_purchase_offline`은 `GOOGLE_SEARCH_ATTRIBUTION_DATA_DRIVEN`으로 설정되어 있고 Primary 전환이다.
2. 현재 Google Ads는 데이터 기반 기여 분석으로 이미 9건/1,555,827원을 반영하고 있다.
3. 데이터 기반 기여 분석은 느릴 수 있지만, Google Ads 입찰 학습에는 더 넓은 광고 경로를 반영한다.
4. last-click으로 바꾸면 보고는 빨라질 수 있지만, PMax나 검색 상단 이전 접점이 과소평가될 수 있다.

추천안:

- Google Ads 설정은 데이터 기반 기여 분석을 유지한다.
- 내부 보고서에는 별도 보조 지표로 `last-click 관점`을 추가한다.
- 예산 판단은 `실제 결제완료 주문만 Google에 알려주는 주 전환값`을 기준으로 보고, 날짜 차이는 클릭 날짜 기준과 결제 날짜 기준을 나란히 표시한다.

## 검증 결과

- 하네스 preflight strict: PASS
- 로컬 typecheck: PASS
- VM Cloud typecheck: PASS
- VM Cloud build: PASS
- VM Cloud backend restart: PASS
- VM Cloud Google Ads auth status: PASS
- VM Cloud upload ledger write: PASS
- Google Ads limited upload: PASS
- Google Ads dashboard read-only reflection check: PASS
- raw 주문번호/클릭ID 미노출: PASS

## 하지 않은 것

- 245,000원 외 추가 후보를 이번 승인 없이 보내지 않았다.
- 293,206원 실패 row를 재전송하지 않았다.
- 운영DB에는 쓰지 않았다.
- GTM Production publish는 하지 않았다.
- raw order id, raw gclid, raw gbraid, raw wbraid는 문서에 남기지 않았다.

## 다음 할일

### Auto Green

1. 15분 간격 리포트 반영 모니터링을 계속한다.
   - 왜: Google Ads API 전송과 리포트 반영 사이의 실제 지연 시간을 숫자로 알아야 한다.
   - 성공 기준: 10건 이상의 `sent_at → first_reflected_at` 차이가 쌓이고 평균/중앙값을 계산한다.

2. 293,206원 실패 row의 sanitized failure reason을 닫는다.
   - 왜: HTTP 200이 있어도 개별 전환 row가 실패할 수 있으므로, 재전송 여부를 판단하려면 실패 이유가 필요하다.
   - 성공 기준: raw 주문번호/클릭ID 없이 Google Ads 진단 또는 저장된 response hash 기준으로 실패 category를 확정한다.

3. 추가 후보를 보내도 되는 후보 / 보류 후보 / 제외 후보로 나눈다.
   - 왜: 후보는 1건만 있는 것이 아니지만, 무작정 모두 보내면 중복·취소·금액 불일치 리스크가 생긴다.
   - 성공 기준: 최근 30일 후보 22건을 sent / failed / ready_unsent / hold / exclude로 분류한다.

### Approval Needed

1. 추가 batch 전송 승인
   - 왜: 현재 장부 기준 ready 후보가 더 있으나, 실제 Google Ads 전송은 Red Lane이다.
   - 추천: 15분 모니터링에서 240,000원과 245,000원이 정상 반영되는 것을 본 뒤 다음 batch를 3-5건으로 넓힌다.
