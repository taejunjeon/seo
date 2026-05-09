# gpt0508-24 End-of-day status — Path B unpaid vbank exclusion

작성 시각: 2026-05-10 01:53 KST

## 한 줄 결론

오늘은 추가 결제 없이 종료한다. 실제 Google 광고 클릭에서 주문완료 화면까지 Path B no-send bridge는 PASS지만, 가상계좌 미입금 주문은 `unpaid_vbank_controlled_evidence`로 upload/ROAS 후보에서 제외한다.

## 완료한 것

1. unpaid vbank exclusion guard를 문서화했다.
2. `payment_status != confirmed` 기반 block rule로 정리했다.
3. `test_order`라는 무거운 플로우보다 `source_order_status`, `payment_method`, `paid_at` 기준으로 차단하도록 설계했다.
4. ConfirmedPurchasePrep / Google Ads upload builder에 붙일 block reason 설계를 정리했다.
5. 내일 P0 로드맵을 작성했다.
6. VM Cloud summary를 read-only로 재확인했다.
7. `total/!total-current.md`에 오늘 종료 상태를 반영했다.

## 진척률 %

- 전체 Path B bridge 기준 진척률: 약 99.7%. 실제 광고 클릭 기반 bridge는 PASS했다.
- 이번 batch 기준 진척률: 100%. 종료 상태 정리와 exclusion guard 설계를 완료했다.
- 운영 전송 기준 100%까지 남은 단계: 결제완료 confirmed guard를 builder/dry-run에 연결하고, Google Ads upload gate를 별도 승인으로 유지한다.
- 다음 병목: unpaid/confirmed 상태를 자동 차단하는 builder-level block reason 패치.
- 사람이 이해할 수 있는 1문장 설명: 광고 클릭 연결은 됐지만 돈이 들어온 주문은 아니므로, 이 증거는 품질 확인에만 쓰고 매출/업로드 후보에서는 빼야 한다.

## 현재 상태 확인

- VM Cloud write flag: OFF
- Path B platform send: 0
- raw stored count: 0
- Google Ads upload: 0
- send_candidate: false
- actual_send_candidate: false
- GTM Production publish: 없음
- 실제 결제/입금: 없음

## builder 반영 설계

### ConfirmedPurchasePrep

- source row가 confirmed가 아니면 candidate input에 넣지 않는다.
- unpaid vbank evidence는 evidence-only로 남기고 upload 후보에서 제외한다.
- 권장 block reason: `payment_status_not_confirmed`, `unpaid_vbank_controlled_evidence`, `missing_paid_at`.

### Google Ads upload builder

- `payment_status !== "confirmed"`이면 `payment_status_not_confirmed`.
- `payment_method=vbank|virtual_account` + `paid_at missing`이면 `unpaid_vbank_controlled_evidence`.
- 해당 reason이 있으면 `would_be_google_ads_upload_candidate_after_approval=false`.

## 하지 않은 것

- 실제 가상계좌 입금은 하지 않았다.
- 카드 결제 confirmed payment test는 하지 않았다.
- Google Ads confirmed_purchase upload는 하지 않았다.
- Google Ads/GA4/Meta/TikTok/Naver 신규 전송은 하지 않았다.
- `send_candidate=true` 또는 `actual_send_candidate=true`는 만들지 않았다.
- raw email/phone/member_code/order/payment 저장 또는 logging은 하지 않았다.

## 검증 결과

- VM Cloud summary read-only: PASS
- raw_stored_count=0: PASS
- platform_send_count=0: PASS
- write_flag_on=false: PASS
- JSON parse: PASS 대상
- wiki link validation: PASS 대상
- harness preflight: PASS 대상

## 다음 할일

### Codex가 할 일

1. builder-level unpaid/confirmed block reason 패치
- 추천/자신감: 90%
- Lane: Green
- 무엇을 하는가: ConfirmedPurchasePrep / Google Ads upload builder에 `payment_status_not_confirmed`와 `unpaid_vbank_controlled_evidence`를 명시 block reason으로 연결한다.
- 왜 하는가: bridge evidence와 실제 결제완료 upload 후보를 자동으로 분리하기 위해서다.
- 어떻게 하는가: 로컬 코드/fixture를 수정하고 typecheck + fixture smoke를 실행한다.
- 성공 기준: unpaid vbank row가 evidence로는 남고 upload 후보는 0으로 유지된다.
- 승인 필요: NO, 로컬 코드/테스트.

### TJ님이 할 일

1. 오늘은 추가 입금/결제하지 않기
- 추천/자신감: 92%
- Lane: Yellow/Red 보류
- 무엇을 하는가: 이번 가상계좌 주문은 입금하지 않고 테스트 evidence로만 둔다.
- 왜 하는가: 이미 click/order bridge는 확인됐고, 입금하면 결제/취소/정산 영향이 생긴다.
- 어떻게 하는가: 별도 조치 없이 미입금 상태를 유지한다. 필요하면 내일 관리자에서 취소 여부만 확인한다.
- 성공 기준: 이 주문이 confirmed purchase, upload, ROAS 후보에 섞이지 않는다.
- 승인 필요: 실제 결제나 입금은 별도 승인 필요.
