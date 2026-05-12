# Implementation And Validation

## 변경 파일

- `backend/src/siteLandingLedger.ts`
- `backend/src/npayActualConfirmedPgReader.ts`
- `backend/src/routes/attribution.ts`
- `backend/tests/site-landing-npay-actual-source.test.ts`
- `data/!data_inventory.md`
- `data/dbstructure.md`

## 구현 요약

`summarizeSiteLanding`에 NPay actual source 옵션을 추가했습니다. route는 운영DB read-only aggregate를 조회해 biocom summary에 넣고, 실패하면 API 자체를 500으로 떨어뜨리지 않고 `unavailable` 경고로 남깁니다.

thecleancoffee는 운영DB site 격리가 검증될 때까지 `bridge_pending`입니다. 이 방어선 때문에 잘못된 매출 승격을 하지 않습니다.

## 검증

- TypeScript typecheck: PASS.
- 핵심 fixture/API/reader 테스트: 12/12 PASS.
- raw PII 패턴: 테스트 응답 내 email/phone/jumin 패턴 0.
- send/upload/platform actual send: 0.
- 운영DB write: 0.
- GTM publish: 0.
- imweb footer 변경: 0.

## 산출물

- `data/option-c-source-sufficiency-audit-20260512.json`
- `gdn/option-c-source-sufficiency-audit-20260512.md`
- `data/summary-api-npay-actual-source-patch-20260512.json`
- `gdn/summary-api-npay-actual-source-patch-20260512.md`
- `data/summary-api-npay-actual-source-fixtures-20260512.json`
- `gdn/summary-api-npay-actual-source-fixtures-20260512.md`
- `data/option-c-dry-run-npay-summary-recalculation-20260512.json`
- `gdn/option-c-dry-run-npay-summary-recalculation-20260512.md`
- `data/seo-data-location-inventory-option-c-update-20260512.json`
- `gdn/seo-data-location-inventory-option-c-update-20260512.md`
- `data/option-c-summary-api-deploy-approval-20260512.json`
- `gdn/option-c-summary-api-deploy-approval-20260512.md`
