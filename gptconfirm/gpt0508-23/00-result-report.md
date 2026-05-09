# gpt0508-23 결과 보고서 — 실제 광고 클릭 기반 Path B no-send bridge

작성 시각: 2026-05-10 01:38 KST

## 한 줄 결론

실제 Google 광고 클릭에서 시작한 바이오컴 주문완료 화면에서 Path B가 주문 hash, 로그인 identity hash, client/session, click hash를 모두 잡았다. 다만 가상계좌 입금 전 주문이므로 결제완료 구매가 아니며, Google Ads 업로드와 `send_candidate=true`는 계속 금지다.

## 완료한 것

1. TJ님이 제공한 Tag Assistant evidence를 raw order/gclid 없이 정리했다.
2. 실제 Google 광고 클릭 기반 `click_id_hash_present=true`를 기록했다.
3. 주문완료 화면에서 `email_hash_present=true`, `order_no_hash_present=true`, `client_session_present=true`를 확인했다.
4. Path B no-send response가 `response_status=200`, `would_store=false`, `would_send=false`, `platform_send_count=0`임을 기록했다.
5. VM Cloud summary를 read-only로 확인했다.
6. reliability v2에 실제 광고 클릭 evidence를 추가했다.
7. confirmed payment 다음 단계 승인안을 작성했다.

## 진척률 %

- 전체 Path B bridge 기준 진척률: 약 99.7%. 실제 광고 클릭 기반 no-send bridge까지 PASS했다.
- 이번 batch 기준 진척률: 100%. evidence 정리, reliability 반영, 다음 승인안 작성, gptconfirm 패키징을 완료했다.
- 운영 전송 기준 100%까지 남은 단계: 실제 결제완료 구매 검증 여부 판단, test_order exclusion 유지, Google Ads upload gate 별도 승인.
- 다음 병목: 이번 주문은 가상계좌 입금 전이라 confirmed paid purchase가 아니다.
- 사람이 이해할 수 있는 1문장 설명: 광고 클릭에서 주문완료 화면까지 연결은 확인됐지만, 돈이 실제로 들어온 결제완료 주문은 아직 확인하지 않았다.

## 검증 결과

- 실제 광고 클릭 기반 no-send bridge: PASS
- order hash present: PASS
- email identity hash present: PASS
- client/session present: PASS
- click hash present: PASS
- raw echo 0: PASS
- Path B platform send 0: PASS
- VM Cloud write flag OFF: PASS
- Google Ads upload candidate 0: PASS
- confirmed paid purchase: HOLD, 가상계좌 미입금

## 하지 않은 것

- 가상계좌 입금은 하지 않았다.
- Google Ads confirmed_purchase upload는 하지 않았다.
- GA4/Meta/Google Ads/TikTok/Naver 신규 전송은 하지 않았다.
- `send_candidate=true`는 만들지 않았다.
- raw email/phone/member_code/order/payment를 repo artifact에 저장하지 않았다.
- GTM Production publish는 하지 않았다.

## 현재 영향/서버·커밋 상태

- VM Cloud write flag는 OFF다.
- VM Cloud summary 기준 raw_stored_count=0, platform_send_count=0이다.
- 이번 batch 작성 전 최신 커밋은 `ecf2759`였다.
- 커밋/푸시는 검증 후 진행한다.

## 남은 리스크

- 기존 live purchase tag는 가상계좌 주문완료에서 발화했다. 이는 기존 사이트 동작이며 Path B 신규 전송과 분리해야 한다.
- 가상계좌 미입금 주문을 결제완료 구매로 해석하면 안 된다.
- test_order가 내부 confirmed ROAS나 Google Ads upload 후보에 섞이면 안 된다.

## 확인하면 좋은 문서

1. `gptconfirm/gpt0508-23/01-real-paid-click-order-preview-result.md`
   - 실제 광고 클릭에서 주문완료까지 어떤 bridge가 확인됐는지 보는 핵심 evidence다.
2. `gptconfirm/gpt0508-23/02-reliability-v2-real-click-updated-result.md`
   - reliability v2 채점표가 어떻게 바뀌었는지 확인하는 문서다.
3. `gptconfirm/gpt0508-23/03-confirmed-payment-next-step-approval.md`
   - 다음에 실제 결제완료 테스트를 할지, 여기서 test_order 제외로 멈출지 판단하는 문서다.

## HOLD Reducer

| 항목 | 값 |
|---|---|
| hold_reason | confirmed paid purchase가 아님 |
| hold_reason_category | approval_required |
| auto_green_followups_available | YES |
| auto_green_followups_done | VM Cloud summary read-only 확인, reliability v2 evidence 갱신, confirmed payment next-step 승인안 작성 |
| remaining_blocker | 실제 결제/입금 여부는 TJ님 비용·운영 판단 |
| next_lane | Yellow/Red depending on payment test |
| tj_action_required | YES, paid confirmation test를 할지 판단할 때만 |
| codex_next_green_action | test_order exclusion guard와 upload block 문서/스크립트 보강 |

## GTM Workspace Lifecycle

| 항목 | 값 |
|---|---|
| Default Workspace used | NO |
| fresh_workspace_created | 기존 승인 범위의 Preview workspace 사용 |
| workspace_capacity_preflight | PASS in prior batch |
| old_workspace_backup_done | N/A |
| live_version_unchanged | YES, 신규 Production publish 없음 |
| submit_create_version_publish | 0 |
| VM Cloud write flag ON after fresh workspace | NO, write flag OFF |
| Preview success treated as Production publish approval | NO |

## 다음 할일

### TJ님이 할 일

1. 이번 가상계좌 주문을 입금하지 않고 test_order 제외로 남길지 판단
- 추천/자신감: 88%
- Lane: Yellow 판단
- 무엇을 하는가: 이번 실제 광고 클릭 기반 주문을 결제하지 않고 테스트 주문으로 제외할지 결정한다.
- 왜 하는가: Path B click bridge는 이미 확인됐고, 입금하면 실제 결제/취소/회계 영향이 생긴다.
- 어떻게 하는가: 별도 입금 없이 주문을 테스트 주문으로만 기록한다. 필요하면 관리자에서 취소/미입금 상태를 확인한다.
- 성공 기준: 해당 주문이 upload/ROAS 후보에 들어가지 않는다.
- 실패 시 해석/대응: 입금하면 confirmed payment test로 분류가 바뀌므로 별도 결과보고가 필요하다.
- Codex가 대신 못 하는 이유: 입금/취소/관리자 확인은 외부 운영 화면과 비용 판단이 포함된다.
- 승인 필요: 실제 입금/결제까지 가려면 YES.

### Codex가 할 일

1. test_order exclusion guard를 다음 upload builder 쪽까지 확장 설계
- 추천/자신감: 91%
- Lane: Green
- 무엇을 하는가: 테스트 주문 evidence가 Google Ads upload 후보와 내부 ROAS 계산에 섞이지 않도록 block rule을 문서/스크립트 설계에 반영한다.
- 왜 하는가: 실제 광고 클릭 테스트는 좋은 evidence지만 성과 데이터로 쓰면 안 된다.
- 어떻게 하는가: `exclude_from_upload=true`, `exclude_from_budget_roas=true`, `block_reason` 기준을 input builder 문서와 dry-run 결과에 연결한다.
- 성공 기준: test evidence는 confidence에는 쓰지만 upload candidate는 0으로 남는다.
- 승인 필요: NO, 문서/로컬 dry-run 설계.
