# R2 backend deploy smoke 결과 (gpt0508-38 작업1)

작성 시각: 2026-05-11 01:42:00 KST
실행 상태: **DEPLOY_PASS** — write_flag=false 유지로 운영 영향 0, 신규 응답 필드 2개 라이브 노출 확인
자신감: 95%

## 한 줄 결론

`tar+ssh → npm ci → npm run build → pm2 restart seo-backend` 절차로 R2 wire + operationalDbFreshness 패치를 운영 VM에 반영. **deploy 자체는 ledger row delta 0** (`write_flag=false` 유지), 신규 응답 필드 두 개(`npayActualCorrection` 11필드 + `operationalDbFreshness` 6필드) 모두 라이브 노출 확인. 운영DB sync lag도 직전 9시간 → 78분으로 자연 회복.

## 1. timeline (KST)

| 시각 | 이벤트 |
|---|---|
| 01:38:30 | tar+ssh로 backend src/tests/package.json VM /tmp 전송 |
| 01:38:55 | VM 안에서 backup(src.bak_20260510T163857Z, tests.bak_gpt0508-37) + swap |
| 01:39:00 | `npm ci --no-audit --no-fund` (16s, 330 packages) |
| 01:39:18 | `npm run build` (tsc -p tsconfig.json) |
| 01:39:30 | `pm2 restart seo-backend --update-env` + pm2 save (uptime reset → 0s) |
| 01:40:30 | post-deploy smoke 완료 |

## 2. smoke 결과

| 검증 | 결과 |
|---|---|
| `/api/google-ads/status` | HTTP 200, apiVersion v22, customerId 2149990943 |
| `/api/attribution/order-bridge/ledger/summary` | HTTP 200, row_count 4 (pre/post 동일), write_flag_on=false |
| `/api/google-ads/dashboard?date_preset=last_30d` | HTTP 200 |
| 응답에 `npayActualCorrection` 객체 | ✅ 11필드 노출 |
| 응답에 `operationalDbFreshness` 객체 | ✅ 6필드 노출 |
| ledger row_count delta | 0 (write_flag=false 정상) |
| raw_stored_count | 0 |
| platform_send_count | 0 |

## 3. live `npayActualCorrection` (last_30d)

| 필드 | 값 |
|---|---|
| windowDays | 30 |
| npayActualConfirmedPgCount | **209** |
| npayActualConfirmedPgRevenueKrw | **₩37,638,900** |
| internalConfirmedRevenueCurrentKrw | ₩6,203,110 |
| internalConfirmedRevenueWithNpayActualPgKrw | **₩43,842,010** |
| internalConfirmedRoasCurrent | **0.2699** |
| internalConfirmedRoasWithNpayActualPg | **1.9078** |
| npayActualWireStatus | `wired_from_pg_snapshot` |
| googleAdsBudgetFloorNpayExactCount | 9 |
| uploadCandidateCount | **0** |

## 4. live `operationalDbFreshness` (last_30d)

| 필드 | 값 |
|---|---|
| source | `operational_db_tb_iamweb_users` |
| maxOrderDateKst | 2026-05-11 00:22:15.000 KST |
| maxPaymentCompleteKst | 2026-05-10 15:25:08.000 KST |
| syncLagMinutes | **78** |
| status | **lagged** |
| warnings | ["운영DB sync lag 1시간 초과. 카운트는 lag 기준값."] |

직전 sprint(gpt0508-36) 측정 9시간 lag 대비 약 7시간 회복.

## 5. internal summary 부수 변화

| 필드 | gpt0508-36 시점 | 본 deploy 직후 |
|---|---|---|
| platformRoas | 9.58 | 9.97 |
| internalConfirmedRoas | 0.27 | 0.27 |
| platformCost | ₩2,366만 | ₩2,298만 |
| confirmedRevenue | ₩649만 | ₩620만 |
| confirmedOrders | 25 | 23 |
| campaignIdCoverage | 0.84 | 0.84 |

`last_30d` 윈도우가 시간 진행에 따라 조금씩 미끄러진 자연 변동. 본 deploy 자체가 만든 변화 없음.

## 6. invariant 검증

| invariant | 상태 |
|---|---|
| `send_candidate` / `actual_send_candidate` / `upload_candidate_count` | false / false / 0 |
| raw email/phone/order/payment/member_code 응답 | 0 (스캔 hit 0) |
| platform actual send | 0 |
| 운영DB write | 0 |
| `ORDER_BRIDGE_WRITE_ENABLED` | false (deploy 직후 그대로) |
| `ORDER_BRIDGE_RAW_BODY_LOGGING` | false |
| `ORDER_BRIDGE_PLATFORM_SEND_ENABLED` | false |

## 7. rollback 경로 (필요 시)

VM 안에 src/tests 백업 디렉토리 보존:

```bash
ssh taejun@34.64.104.94 'sudo -n -u biocomkr_sns bash -lc "
  cd /home/biocomkr_sns/seo/repo/backend &&
  rm -rf src tests &&
  mv src.bak_20260510T163857Z src &&
  mv tests.bak_gpt0508-37 tests &&
  export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH &&
  npm run build &&
  pm2 restart seo-backend --update-env
"'
```

## 8. 다음 단계

작업 2 — R2 1h canary가 본 deploy 직후 시작됨(`02:41:12 KST` 자동 cutoff). VM nohup 자동 rollback 스케줄러 PID 558993 + Claude Code 백그라운드 회수 ID `brbzrahtz`로 관리. 결과는 작업 2 산출물에서.

## 9. Verdict

`DEPLOY_PASS_NEW_FIELDS_LIVE_INVARIANTS_HELD`

산출 JSON: `data/r2-backend-deploy-smoke-20260511.json`
