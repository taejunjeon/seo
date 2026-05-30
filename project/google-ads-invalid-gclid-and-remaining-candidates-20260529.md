작성 시각: 2026-05-29 02:39 KST
기준일: 2026-05-29
문서 성격: Google Ads 실제 구매 전환 남은 후보와 invalid gclid 원인 분해

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
    - project/google-ads-validate-only-16-and-batch5-result-20260529.md
    - project/google-ads-293206-failed-row-and-30d-batch-classification-20260529.md
    - vm/!vm.md
  lane: Green_read_only_and_validate_only
  allowed_actions:
    - VM Cloud SQLite read-only
    - VM Cloud API no-write plan query
    - Google Ads validate-only upload
    - local documentation
  forbidden_actions:
    - Google Ads actual conversion send
    - VM Cloud DB write
    - operational PostgreSQL write
    - deploy/restart
    - GTM publish
    - raw order id or raw click id exposure
  source_window_freshness_confidence:
    source:
      - VM Cloud SQLite google_ads_confirmed_purchase_upload_ledger
      - VM Cloud Google Ads candidate builder API
      - Google Ads validate-only response
    window: last_30d, site=biocom
    freshness: checked 2026-05-29 02:39 KST
    confidence: high for counts and invalid cause traits, medium for future sendability until next validate-only immediately before send
```

## 10초 요약

“11건 보낸 것 외에 12건이 더 남았다”가 아니다.

현재 장부에 실제 전송 완료로 찍힌 것이 총 11건이고, 실패가 1건, 아직 장부에 올리지 않은 후보가 11건이다. 이 남은 11건 중 4건은 Google Ads가 해석할 수 없는 테스트 gclid라서 제외해야 한다. 따라서 다음에 실제로 검토할 수 있는 후보는 7건, 1,704,927원이다.

## 현재 장부 상태

Source: VM Cloud SQLite `google_ads_confirmed_purchase_upload_ledger`

기준 시각: 2026-05-29 02:39 KST

- sent: 11건 / 2,154,900원
- failed: 1건 / 293,206원
- 아직 장부에 올리지 않은 후보: 11건 / 1,775,627원

## 숫자가 헷갈린 이유

직전 작업에서 “16건 validate-only”를 했다.

- 그 16건 중 12건은 통과 가능 후보였다.
- 그중 상위 5건은 실제 Google Ads로 보냈고, 지금 장부의 `sent` 11건 안에 포함됐다.
- 그래서 16건 중 아직 남은 것은 11건이다.
- 남은 11건 안에는 통과 가능 후보 7건과 invalid gclid 4건이 섞여 있다.

정리하면 아래와 같다.

- 이미 보낸 것: 총 11건
- 이미 실패로 닫힌 것: 1건
- 앞으로 더 추릴 것: 11건
- 그중 제외해야 하는 것: 4건
- 다음 batch 후보: 7건

## invalid gclid 4건 원인

Google Ads validate-only에서 4건이 `UNPARSEABLE_GCLID`로 확인됐다.

쉬운 뜻:

Google Ads가 이 값을 “진짜 Google 광고 클릭 ID”로 읽지 못했다. 구매 주문 자체가 가짜라는 뜻은 아니다. 주문은 실제 결제완료 조건을 통과했지만, 같이 붙은 gclid가 테스트용 문자열이었다.

원문 gclid는 문서와 대화에 노출하지 않았다. 서버 안에서만 특징을 검사했다.

확인된 특징:

- 4건 모두 2026-05-15 결제완료 후보
- 4건 모두 `payment_success_ledger`에서 나온 homepage/card 결제 후보
- 4건 모두 gclid 길이 19자
- 4건 모두 테스트/스모크 계열 문자열 패턴
- 공백, URL 전체, `%xx` 인코딩, 한글, 따옴표, 파이프 같은 깨진 문자는 없음
- 즉 “저장 중 깨진 값”이라기보다 “테스트용 gclid가 실제 전송 후보로 올라온 것”에 가깝다

## invalid gclid 제외 대상

raw 주문번호와 raw gclid는 노출하지 않고 safe ref만 남긴다.

- `gads_private_dafd48e1d7de42`: 11,900원 / 2026-05-15
- `gads_private_cc717e65226754`: 35,000원 / 2026-05-15
- `gads_private_5ab3b60016be52`: 11,900원 / 2026-05-15
- `gads_private_d932ec590af0cb`: 11,900원 / 2026-05-15

합계: 70,700원

권장 처리:

- Google Ads 실제 전송 후보에서 제외
- 후보 생성기에는 `looks_like_synthetic_gclid` 필터를 추가하는 것이 맞다
- 이미 실제 전송된 row는 아니므로 Google Ads 리포트 오염은 없다

## 다음 batch 후보

남은 11건에서 invalid 4건을 제외하면 다음 후보는 7건이다.

- 2026-05-10: 245,000원
- 2026-05-11: 245,000원
- 2026-05-15: 245,000원
- 2026-05-17: 245,000원
- 2026-05-17: 234,927원
- 2026-05-18: 245,000원
- 2026-05-19: 245,000원

합계: 1,704,927원

주의:

이 7건도 바로 보내기보다, 전송 직전에 다시 validate-only를 한 번 더 돌린 뒤 통과분만 장부 ready write 후 실제 전송해야 한다.

## 발견한 표시 버그

현재 `/api/google-ads/confirmed-purchase/limited-upload?validate_only=1&allow_unwritten=1` 응답은 partial failure가 하나라도 있으면 실패 상세가 없는 row도 `validation_failed`처럼 보일 수 있다.

실제 판단은 `failureSummary`가 있는 row만 실패로 봐야 한다. 이번 11건 validate-only에서 실패 상세가 붙은 것은 4건이었다.

개선안:

- validate-only 응답에서 row별 Google Ads 실패 index가 없으면 `validated_or_not_failed`로 표시한다.
- 화면에서도 “전체 partial failure”와 “row별 실패”를 분리한다.

## 하지 않은 것

- Google Ads 실제 전송 없음
- VM Cloud 장부 write 없음
- 운영DB write 없음
- GTM publish 없음
- deploy/restart 없음
- raw 주문번호, raw gclid 노출 없음

## 다음 판단

1. invalid gclid 4건은 이번 batch에서 제외한다.
2. 남은 7건은 다음 전송 후보로 둔다.
3. 전송 직전 validate-only를 다시 실행한다.
4. 통과분만 VM Cloud 장부에 ready로 쓰고, 실제 전송은 최대 5건 단위로 진행한다.
