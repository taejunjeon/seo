# Google Ads 실제 구매 전환 validate-only 16건 및 5건 제한 전송 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - project/google-ads-293206-failed-row-and-30d-batch-classification-20260529.md
    - project/google-ads-confirmed-purchase-send-auto-dispatch-result-20260527.md
    - vm/!vm.md
  lane: Red_approved
  allowed_actions:
    - VM Cloud backend deploy/restart
    - Google Ads validate-only upload
    - VM Cloud upload ledger write
    - Google Ads limited actual upload max_5
    - VM Cloud ledger failure reason update without raw identifiers
  forbidden_actions:
    - raw_order_id_or_raw_click_id_report_exposure
    - Google Ads settings mutation
    - operational PostgreSQL write
    - GTM publish
  source_window_freshness_confidence:
    source:
      - VM Cloud SQLite google_ads_confirmed_purchase_upload_ledger
      - Google Ads API UploadClickConversions
      - Google Ads dashboard-summary API
    window:
      failed_single: 293206 KRW failed row
      candidate_window: last_30d
      actual_send_batch: top_5_validated_candidates
    freshness:
      backend_deployed_at_kst: 2026-05-29 02:06
      actual_send_at_kst: 2026-05-29 02:10
      google_ads_report_checked_at_kst: 2026-05-29 02:12
    confidence: high
```

## 한 줄 결론

293,206원 실패 건은 Google Ads의 30일 클릭 인정 기간을 넘은 `EXPIRED_EVENT`로 닫았다. 새 후보 16건은 검증 전용으로 확인했고, 그중 상위 5건 1,329,000원은 실제 Google Ads 전송까지 성공했다.

## 목표

Google Ads에 실제 결제완료 주문만 구매 신호로 보내되, 실패 이유를 사람이 읽을 수 있게 남기고, 한 번에 과도하게 보내지 않도록 5건 제한 batch로 진행한다.

## 진행률

- 실제 구매 전용 Google 주 전환 준비도: 92%
- 이번 제한 batch 실행률: 100%
- 실패 원인 가시화: 293,206원 row 상세 사유 확보 완료
- 남은 병목: 30일 후보 중 invalid gclid 4건 제외/필터 보강, Google Ads 리포트 반영 지연 모니터링

## 완료한 것

### 1. 실패 응답 저장 보강

`backend/src/routes/googleAds.ts`에서 Google Ads partial failure 응답을 더 자세히 파싱하도록 보강했다.

- `conversions[0].gclid`처럼 실패한 row 위치를 저장
- Google Ads request id 존재 여부 저장
- `UNPARSEABLE_GCLID`, `EXPIRED_EVENT` 같은 Google Ads 오류 코드를 요약
- 원문 주문번호와 원문 click id는 응답/문서에 노출하지 않음

### 2. 293,206원 단건 validate-only 재검증

결과:

- 실제 전송 없음
- VM Cloud sent 상태 변경 없음
- Google Ads 응답: HTTP 200 + partial failure
- 실패 코드: `EXPIRED_EVENT`
- 쉬운 의미: 이 주문 자체가 가짜라는 뜻이 아니라, 광고 클릭이 Google Ads 전환 액션의 30일 클릭 인정 기간보다 오래 전이라 Google Ads가 받아주지 않는다는 뜻

처리:

- 해당 failed row의 `last_error`를 사람이 읽을 수 있는 요약으로 보강
- 이 건은 재전송 후보가 아니라 제외/보류가 맞음

### 3. 최근 30일 후보 16건 validate-only

결과:

- 총 16건 / 3,104,627원 검증
- 12건은 Google Ads 형식상 통과 후보로 판단
- 4건은 `UNPARSEABLE_GCLID`

`UNPARSEABLE_GCLID`의 쉬운 의미:

Google Ads가 해당 gclid 문자열을 정상 광고 클릭 id로 해석하지 못했다. 테스트 gclid, 잘린 gclid, 잘못 저장된 값, 또는 Google Ads가 인식할 수 없는 형식일 가능성이 있다.

### 4. 상위 5건 별도 validate-only

실제 전송 전에 상위 5건만 다시 검증했다.

- 5건 모두 통과
- 합계: 1,329,000원
- partial failure 없음
- 실제 Google Ads write 없음

### 5. VM Cloud 장부 5건 ready write

5건을 VM Cloud 장부에 `ready`로 만들었다.

- insertedReadyRows: 5
- 중복 replay 방어 확인: 통과
- 원문 주문번호/click id 노출: 없음

### 6. Google Ads 실제 5건 제한 전송

실제 전송 결과:

- externalSendCount: 5
- Google Ads HTTP status: 200
- partialFailure: false
- resultCount: 5
- VM Cloud ledgerSentRows: 5
- VM Cloud ledgerFailedRows: 0
- 합계: 1,329,000원

전송된 안전 참조/금액:

- `gads_private_c77001980bbe8e`: 349,000원
- `gads_private_752104d8561d03`: 245,000원
- `gads_private_b25dcd71f893a9`: 245,000원
- `gads_private_ca8d48a0401ca3`: 245,000원
- `gads_private_695c4f5024b503`: 245,000원

## Google Ads 리포트 반영 상태

전송 직후 2026-05-29 02:12 KST에 Google Ads dashboard API를 다시 조회했다.

현재 `BI confirmed_purchase_offline` 리포트 반영값:

- 기존 반영 건수: 4건
- 기존 반영 전환값: 340,900원
- 이번 5건 1,329,000원: 아직 리포트에는 미반영

해석:

Google Ads API 전송 성공과 Google Ads 리포트 반영은 시간이 다르다. 이번 5건은 전송 성공 상태이고, 리포트 반영은 모니터링 heartbeat로 계속 확인해야 한다.

## 남은 후보 상태

5건 전송 후 최근 30일 계획 기준:

- 남은 ready 후보: 11건
- 남은 ready 후보 합계: 1,775,627원
- 이 중 4건은 validate-only에서 `UNPARSEABLE_GCLID`로 확인됨

중요:

자동 전송 cron은 `rolling_24h`만 2건씩 보므로, 이번 30일 수동 후보 11건을 바로 자동 전송하지 않는다. 다만 다음 수동 batch 전에 invalid gclid 4건은 제외하거나 먼저 검증해야 한다.

## 하지 않은 것

- Google Ads 전환 액션 설정 변경 없음
- GTM publish 없음
- 운영 PostgreSQL write 없음
- raw 주문번호, raw gclid, raw 결제키 노출 없음
- 남은 11건 실제 전송 없음

## 검증 로그 요약

- 로컬 backend typecheck: 통과
- 로컬 backend build: 통과
- VM Cloud backend typecheck: 통과
- VM Cloud backend build: 통과
- PM2 `seo-backend`: online
- `/health`: ok
- 293,206원 validate-only: 실패 원인 확인
- 16건 validate-only: 12건 가능, 4건 invalid gclid
- 5건 validate-only: 통과
- 5건 actual upload: 성공
- VM Cloud ledger: sent 5건 확인

## 다음 판단

1. 리포트 반영 모니터링
   - 이번 5건 1,329,000원이 Google Ads `BI confirmed_purchase_offline`에 언제 반영되는지 15분 간격 heartbeat로 확인한다.

2. invalid gclid 4건 제외/원인 분해
   - 30일 후보 중 gclid가 Google Ads에서 해석되지 않는 4건을 raw 노출 없이 패턴별로 분해한다.

3. 다음 batch는 바로 전체 전송하지 말고 `validate-only -> 통과분만 전송` 순서로 진행한다.
   - 이유: 실패 row를 줄이고 Google Ads 학습에 깨끗한 실제 구매 신호만 넣기 위해서다.
