# Path B row summary and rollback verification

작성 시각: 2026-05-09 17:28 KST
Status: PASS

## 한 줄 결론

controlled row 1건만 남았고, 서비스 write flag는 OFF로 확인됐다.

## Current summary

```json
{
  "row_count": 1,
  "unique_order_no_hash": 1,
  "unique_email_hash": 1,
  "unique_phone_hash": 1,
  "unique_click_id_hash": 1,
  "raw_stored_count": 0,
  "platform_send_count": 0,
  "duplicate_dedupe_count": 1,
  "write_flag_on": false
}
```

## Rollback verification

실제 rollback은 실행하지 않았다. rollback이 필요한 실패 상황이 아니었기 때문이다.

대신 안전 상태를 확인했다.

- `.env` flag OFF.
- service summary reports `write_flag_on=false`.
- PM2 online.
- unexpected restart after smoke 0.
- raw stored 0.
- platform send 0.

## Backup

Rollback source:

- `/home/biocomkr_sns/seo/deploy-backups/20260509-1719_path_b_limited_storage`

필요 시 복구 대상:

- `dist/orderBridgeIdentityHmac.js`
- `dist/orderBridgeLedger.js`
- `dist/routes/attribution.js`
- `.env`

## 다음 판단

다음은 1h canary 본 실행이 아니라, 먼저 GTM Preview controlled traffic으로 browser evidence를 한 번 더 볼지 결정하는 것이 안전하다.
