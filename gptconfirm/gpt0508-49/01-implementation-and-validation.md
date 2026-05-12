# gpt0508-49 Implementation And Validation

## 무엇이 가능해졌나

더클린커피 NPay 매출을 summary API가 읽을 수 있는 local code path가 생겼다. 기존에는 `site=thecleancoffee`가 무조건 `bridge_pending`이었지만, 이제 로컬 코드 기준으로는 VM Cloud `imweb_orders`에서 Imweb v2 NPay 주문만 집계해 `actual_confirmed` 후보로 주입할 수 있다.

## 바뀐 파일

| 파일 | 변경 내용 |
|---|---|
| `backend/src/npayActualConfirmedPgReader.ts` | site router 추가. biocom은 운영DB `PAYMENT_COMPLETE`, coffee는 `imweb_v2_vm_cloud_imweb_orders` 사용 |
| `backend/src/siteLandingLedger.ts` | `included_with_warning`, coffee source, gross/excluded/status_blank/freshness/GA4 guard 필드 수용 |
| `backend/src/routes/attribution.ts` | actual reader의 source/detail 필드를 summary API response로 전달 |
| `backend/tests/npay-actual-confirmed-pg-reader.test.ts` | coffee reader fixture 추가 |
| `backend/tests/site-landing-npay-actual-source.test.ts` | `included_with_warning` summary 주입 회귀 테스트 추가 |
| `backend/tests/site-landing-summary-api.test.ts` | coffee summary API response shape와 raw order id 비노출 테스트 추가 |

## 구현 정책

- `biocom`: 기존 운영DB `public.tb_iamweb_users`의 `NAVERPAY_ORDER + PAYMENT_COMPLETE + 취소/반품 제외 + 금액 양수` 로직 유지.
- `thecleancoffee`: VM Cloud/로컬 SQLite `imweb_orders`에서 `site='thecleancoffee'`, `pay_type='npay'`, 최근 30일, `payment_amount > 0`, `imweb_status NOT IN ('CANCEL','RETURN','EXCHANGE')` 로직 사용.
- `complete_time`: legacy diagnostic only. blank를 미결제로 판정하지 않는다.
- `imweb_status`: lifecycle/status guard. 단독 결제완료 확정 source로 쓰지 않는다.
- `GA4`: actual 매출 source가 아니라 `already_in_ga4_guard_only_not_actual_source`로만 표시한다.
- `status blank`: 포함하되 `included_with_warning`으로 내려주고 count/amount/freshness warning을 같이 표시한다.

## 테스트 커버리지

필수 fixture 요구사항을 다음 테스트가 막는다.

| 요구사항 | 커버 |
|---|---|
| coffee_npay_purchase_confirmation_included | reader fixture |
| coffee_npay_delivering_included_or_warning | reader fixture |
| coffee_cancel_excluded | reader fixture/API fixture |
| coffee_return_exchange_excluded | reader fixture |
| coffee_status_blank_policy | reader fixture/API fixture |
| coffee_complete_time_blank_not_unpaid | reader fixture |
| ga4_guard_not_actual_source | reader fixture/API fixture |
| raw_order_id_never_output | reader fixture/API fixture |
| biocom_reader_regression | reader regression |
| coffee_summary_api_response_shape | summary API fixture |

## 검증 명령

```bash
cd backend
npm run typecheck
npx tsx --test tests/npay-actual-confirmed-pg-reader.test.ts tests/site-landing-npay-actual-source.test.ts tests/site-landing-summary-api.test.ts
```

결과는 typecheck PASS, targeted tests 16/16 PASS다.

## 서버 영향

로컬 코드만 변경했다. VM Cloud backend deploy/restart는 실행하지 않았다. 운영DB write, VM Cloud write, 외부 플랫폼 send/upload, GTM publish, Imweb footer/header 변경은 모두 0이다.
