---
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  lane: Yellow approved VM Cloud backend deploy/restart plus guarded VM Cloud SQLite update
  allowed_actions:
    - VM Cloud backend source deploy/restart
    - backend typecheck/build
    - VM Cloud SQLite attribution_ledger update for safe 운영DB PAYMENT_COMPLETE bridge candidates only
    - 운영DB public.tb_iamweb_users read-only query
    - Imweb v2 API fallback dry-run
    - fixture/test
    - pre/post snapshot
  forbidden_actions:
    - 운영DB write/import
    - pending 전체 confirmed
    - Meta CAPI 추가 send
    - FREE 0원 Purchase send
    - NPay 미조인 강제 편입
    - Google Ads/GA4/TikTok/Naver send/upload
    - GTM publish
    - Imweb header/footer change
    - raw identifier output
  source_window_freshness_confidence:
    source: "운영DB PostgreSQL dashboard.public.tb_iamweb_users read-only + VM Cloud SQLite attribution_ledger"
    window: "VM Cloud attribution_ledger logged_at >= 2026-05-14T04:00:00.000Z"
    freshness: "2026-05-14 21:14 KST"
    confidence: 0.94
---

# Biocom VM Cloud confirmed bridge patch result

작성 시각: 2026-05-14 21:14 KST

## 10초 요약

바이오컴 오후 결제완료 신호가 VM Cloud에서 계속 `pending`으로 남는 문제를 막기 위해, 운영DB 결제완료 원장과 정확히 붙는 row만 VM Cloud에서 `confirmed`로 올리는 bridge를 배포했다.
단, 이 bridge가 Meta CAPI 전송까지 자동으로 이어지지 않도록 `metaCapiAutoSendAllowed=false` marker를 남겼다.
결과는 20건 / 4,824,615원 confirmed 반영, 추가 Meta 전송 0건, 운영DB write 0건이다.

## 무엇이 가능해졌나

VM Cloud가 받은 바이오컴 결제완료 후보 중 운영DB `dashboard.public.tb_iamweb_users`의 `PAYMENT_COMPLETE`와 정확히 붙는 row를 자동으로 pending에서 벗길 수 있게 됐다. 이 작업은 Meta에 구매 이벤트를 보내는 작업이 아니라, VM Cloud 보조 원장의 결제 상태를 안전하게 바로잡는 작업이다.

## 실제 숫자

- Pre-snapshot: 2026-05-14 13:00 KST 이후 VM Cloud 바이오컴 `payment_success` pending 59건, confirmed 0건.
- Dry-run: safe confirmed 후보 20건 / 4,824,615원.
- Apply: VM Cloud SQLite `attribution_ledger` 20건 written.
- Post-snapshot: confirmed 20건 / pending 41건.
- Bridge marker: 20건 모두 `metaCapiAutoSendAllowed=false`.
- Meta 자동 후보: bridge row 0건.
- Meta CAPI 추가 전송: 0건.

## 제외한 것

- 운영DB에서 아직 결제완료 근거가 없는 row: 40건.
- 다른 source row: 5건.
- FREE 0원 row: 1건.
- Imweb API fallback에서 보인 1건은 dry-run 참고로만 두고 이번 bridge apply에는 넣지 않았다.

## 중요한 수정

첫 VM Cloud dry-run에서 `order_section_item_no`를 NPay channel key처럼 해석해 일반 주문이 `npay_excluded`로 빠지는 문제가 보였다. apply 전에 `raw_data->>'channelOrderNo'`만 NPay channel key로 보도록 수정했다. 그래서 일반 카드/정기결제 row가 안전 후보로 복구됐다.

## Rollback readiness

백업 위치:

- `/home/biocomkr_sns/seo/repo/.deploy-backups/biocom-confirmed-bridge-20260514T2103KST`

파일 rollback:

```bash
sudo -n -u biocomkr_sns bash -lc 'cd /home/biocomkr_sns/seo/repo && cp .deploy-backups/biocom-confirmed-bridge-20260514T2103KST/backend/src/routes/attribution.ts backend/src/routes/attribution.ts && cp .deploy-backups/biocom-confirmed-bridge-20260514T2103KST/backend/src/metaCapi.ts backend/src/metaCapi.ts && cd backend && npm run build && pm2 restart seo-backend --update-env'
```

상태 rollback은 bridge marker만 대상으로 해야 한다. 전체 pending 원복은 금지다.

## 검증

- 로컬 `npm run typecheck`: PASS.
- 로컬 `npm run build`: PASS.
- 로컬 `npx tsx --test tests/attribution.test.ts`: 37/37 PASS.
- VM Cloud `npm run typecheck`: PASS.
- VM Cloud `npm run build`: PASS.
- VM Cloud health: PASS.
- `git diff --check` 대상 파일: PASS.
- 외부 send/upload: 0.
- 운영DB write/import: 0.
- raw identifier output: 0.

## 다음 행동

1. 24시간 동안 VM Cloud pending이 다시 쌓이는지 monitor한다.
2. 운영DB 미확인 40건은 바로 confirmed로 올리지 않는다.
3. Imweb v2 API fallback은 2차 승인안으로 분리한다.
