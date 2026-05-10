# R2 backend deploy approval packet (gpt0508-37 작업5)

작성 시각: 2026-05-11 01:25:00 KST
Lane: Green packet 작성 / 실제 deploy 는 Yellow 승인 후
자신감: 88%

## 한 줄 결론

R2 wire 코드는 본 sprint에서 patch + typecheck + fixture 6/6 PASS 완료. 운영에 반영하려면 VM SSH로 backend tar+ssh 배포 + `npm ci` + `npm run build` + `pm2 restart seo-backend` 한 번이면 끝이오. **deploy 자체는 `ORDER_BRIDGE_WRITE_ENABLED=false` 기본 유지로 ledger 영향 0**, 라이브 검증은 별도 1h canary로 분리.

## 1. deploy 대상

| 파일 | 변경 |
|---|---|
| `backend/src/routes/attribution.ts` | R2 helper + payment-success 핸들러 wire (+130 LOC) |
| `backend/tests/payment-success-order-bridge-r2-wire.test.ts` | 신규 fixture 6 (+218 LOC) |

backend의 다른 부분 변경 없음. 이미 VM에 있는 helper(`buildOrderBridgeIdentityHmacMaterial`, `recordOrderBridgeLedger`)와 env 플래그를 그대로 재사용.

## 2. VM 정보 (vm/!vm.md 정본 기준)

| 항목 | 값 |
|---|---|
| host | `34.64.104.94` |
| SSH user | `taejun` (key `~/.ssh/id_ed25519`) |
| 운영 user | `biocomkr_sns` (sudo -u 경유) |
| repo | `/home/biocomkr_sns/seo/repo` |
| Node | `/home/biocomkr_sns/seo/node/bin` |
| pm2 앱 | `seo-backend` |
| git on VM | 없음 — tar+ssh 또는 rsync 방식 |

## 3. pre-snapshot (Mac 로컬)

```bash
curl -s -o /tmp/order-bridge-summary-pre-deploy.json \
  https://att.ainativeos.net/api/attribution/order-bridge/ledger/summary

ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH; cd /home/biocomkr_sns/seo/repo/backend && pm2 describe seo-backend --no-color | sed -n 1,30p"'
```

기대값: `write_flag_on=false`, `row_count` 직전 값.

## 4. deploy command (옵션 A, 추천)

vm/!vm.md 4.1과 동일한 tar+ssh 절차.

```bash
# 1) Mac 에서 tar pipe ssh
cd /Users/vibetj/coding/seo/backend
tar czf - --exclude=node_modules --exclude=dist --exclude=data \
          --exclude=logs --exclude=.env --exclude=.DS_Store . \
  | ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
        "rm -rf /tmp/seo-backend-new && mkdir -p /tmp/seo-backend-new && tar xzf - -C /tmp/seo-backend-new"

# 2) VM 에서 src/tests 만 갱신 (data/.env/logs 보존)
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "
    set -euo pipefail
    cd /home/biocomkr_sns/seo/repo/backend
    rm -rf src tests
    cp -r /tmp/seo-backend-new/src .
    cp -r /tmp/seo-backend-new/tests .
    cp /tmp/seo-backend-new/package.json .
    cp /tmp/seo-backend-new/package-lock.json . 2>/dev/null || true
    export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH
    npm ci --no-audit --no-fund
    npm run build
    pm2 restart seo-backend --update-env
    pm2 save
  "'
```

옵션 B는 `capivm/deploy-backend-rsync.sh` (rsync 가 VM에 미설치면 fallback to A).

## 5. post-snapshot

```bash
curl -s -o /tmp/order-bridge-summary-post-deploy.json \
  https://att.ainativeos.net/api/attribution/order-bridge/ledger/summary

ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH; pm2 describe seo-backend --no-color | sed -n 1,30p"'
```

기대값: `write_flag_on=false` 그대로, row_count 변화 없음. payment-success 응답에 `orderBridgeR2` 객체가 노출되기 시작 (`stored=false`, `rejected_reason="write_flag_disabled"`).

## 6. 1h canary (deploy 후 별도 윈도우, 주간 시간대 권장)

deploy 자체로는 ledger 누적이 시작되지 않소. 본 wire의 효과를 측정하려면 별도 윈도우에서 write_flag을 켜야 함.

```bash
END_ISO=$(date -u -v+1H +%Y-%m-%dT%H:%M:%SZ)
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  "sudo -n -u biocomkr_sns bash -lc '
    set -euo pipefail
    cd /home/biocomkr_sns/seo/repo/backend
    cp -p .env .env.bak_canary_\$(date -u +%Y%m%dT%H%M%SZ)
    sed -i \"s|^ORDER_BRIDGE_WRITE_ENABLED=.*|ORDER_BRIDGE_WRITE_ENABLED=true|\" .env
    sed -i \"s|^ORDER_BRIDGE_WRITE_CANARY_UNTIL=.*|ORDER_BRIDGE_WRITE_CANARY_UNTIL=${END_ISO}|\" .env
    export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH
    pm2 restart seo-backend --update-env
  '"
```

코드 안 `ORDER_BRIDGE_WRITE_CANARY_UNTIL` 자동 cutoff가 1h 후 reject 시작. 추가로 nohup 스케줄러로 자동 .env 원복(gpt0508-35 절차)도 같이 띄우면 안전.

## 7. 4-signal canary 검증 (작업 1 decision tree 적용)

| 신호 | 기대값 |
|---|---|
| 1. ledger row delta | payment-success 호출 수 × ~1.0 (5분 dedupe 약간 감소) |
| 2. Path B endpoint call | 0 (직접 호출 없음, R2가 backend 안에서 호출) |
| 3. payment-success call | 주간 1h 약 50~100 |
| 4. paid_click_intent receiver | 정상 누적 |
| 5. 운영DB / imweb fresh order | sync lag 감안 |
| raw_stored_count | 0 유지 |
| platform_send_count | 0 유지 |
| duplicate_dedupe_count | 점진 증가 |

verdict 분기:
- 모두 정상 + ledger delta 가 있으면 `CANARY_COMPLETE_PASS`
- ledger delta 0인데 payment-success 호출 다수 → `LEDGER_WRITE_REJECTED` (response의 `orderBridgeR2.rejected_reason` 분석)
- raw>0 또는 send>0 → `CANARY_COMPLETE_FAIL` 즉시 rollback

## 8. rollback

### 8-1. 빠른 비활성 (코드 유지, ledger 만 멈춤)

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "cd /home/biocomkr_sns/seo/repo/backend && sed -i s/ENABLED=true/ENABLED=false/ .env && export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH && pm2 restart seo-backend --update-env"'
```

### 8-2. 코드 revert

```bash
# Mac 로컬
git revert --no-edit <R2_wire_commit_sha>
# 또는 specific 파일만
git checkout <pre_R2_commit_sha> -- backend/src/routes/attribution.ts backend/tests/payment-success-order-bridge-r2-wire.test.ts
# 그리고 4절 deploy 명령 다시 실행
```

## 9. 실패 조건 vs 대응

| 조건 | 대응 |
|---|---|
| `npm run build` 실패 | rollback to pre_R2 commit + 원인 분석 |
| pm2 restart 후 5xx 폭주 | ORDER_BRIDGE_WRITE_ENABLED=false 토글 + `pm2 logs seo-backend --lines 200` |
| raw email/phone/order leakage 의심 | 즉시 `ORDER_BRIDGE_WRITE_ENABLED=false` + 운영 로그 grep + ledger row 삭제 (별도 승인 후) |
| duplicate row 폭주 | 5분 dedupe 정책 점검, dedupeKey 로직 재검토 |

## 10. 승인 문구 (TJ 복사용)

**승인:**
```
[승인] gpt0508-37 작업5 R2 backend deploy:
backend/src/routes/attribution.ts + backend/tests/payment-success-order-bridge-r2-wire.test.ts
를 VM 운영 backend 에 tar+ssh 절차로 deploy.
ORDER_BRIDGE_WRITE_ENABLED=false 기본 유지로 deploy 자체는 ledger row 영향 0.
별도 1h canary 윈도우(주간 시간대) 에서
ORDER_BRIDGE_WRITE_ENABLED=true + ORDER_BRIDGE_WRITE_CANARY_UNTIL=<+1h ISO> 박고
row 누적 검증.
raw 0 / platform send 0 / GTM publish 0 / 운영DB write 0 invariant 유지.
실패 조건 발생 시 즉시 rollback.
```

**보류:**
```
[보류] gpt0508-37 작업5 deploy 보류. 사유: <TJ 코멘트>
```

## 11. Verdict

`DEPLOY_APPROVAL_PACKET_READY`

산출 JSON: `data/payment-success-r2-backend-deploy-approval-20260511.json`
