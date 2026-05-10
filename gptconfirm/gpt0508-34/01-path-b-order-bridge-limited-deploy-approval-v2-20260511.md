# Path B order_bridge limited deploy 승인안 v2 (gpt0508-34)

작성 시각: 2026-05-10 22:05:00 KST
Lane: 본 산출물은 Green(packet 작성). 실제 deploy는 Yellow 승인 게이트.
자신감: 88% (canary 시간대 트래픽 변동 + ledger summary 캐시 반영 지연이 미지 영역)

## 5줄 결론

1. campaign_id missing 2,121건은 “기존 데이터 재검색”으로는 더 줄지 않는다. 주문완료 시점에 hash-only ledger row가 실제 누적돼야 한다.
2. 이미 backend에 `POST /api/attribution/order-bridge/identity-hmac/no-send`가 있고 `ORDER_BRIDGE_WRITE_ENABLED` 플래그 하나로 hash-only canary write가 켜진다. 코드 변경 없이 env flag만 1h 동안 켜는 안이다.
3. 200건 상한 + raw body logging false + platform send false + GTM Production publish 없음으로 blast radius를 작게 잡는다.
4. rollback은 env flag을 즉시 false로 복귀 + 필요시 SQLite row 삭제 한 줄로 끝난다. smoke는 ledger summary endpoint diff 한 번이다.
5. 추천 옵션은 “1h canary + 24h 관찰”이고, 승인되면 즉시 실행 가능한 명령·문구를 본 문서 7~9절에 그대로 박았다.

## 1. 왜 v2인가

v1(gpt0508-31)은 “Path B 코드는 있지만 ledger를 켜지는 않는다”까지였다. gpt0508-33 결과 missing 2,121건이 다음 sprint에 또 그대로 남는다는 게 데이터로 확인됐다. 같은 분석을 한 번 더 하지 말고, ledger 누적을 실제로 시작해 다음 sprint부터 exact bridge row가 자라게 한다.

## 2. 현재 상태 (read-only 점검 결과)

| 항목 | 값 |
|---|---|
| 엔드포인트 | `POST /api/attribution/order-bridge/identity-hmac/no-send` |
| 엔드포인트 파일 | `backend/src/routes/attribution.ts:2882` |
| Ledger 모듈 | `backend/src/orderBridgeLedger.ts` |
| Hash 모듈 | `backend/src/orderBridgeIdentityHmac.ts` |
| Hash 버전 | `hmac_sha256_identity_v1` |
| 현재 ledger row | 4건 (preview 누적, would_store=true는 0건) |
| `ORDER_BRIDGE_WRITE_ENABLED` | false |
| `ORDER_BRIDGE_WRITE_MAX_ROWS` | 200 |
| `ORDER_BRIDGE_RAW_BODY_LOGGING` | false (절대 true 금지) |
| `ORDER_BRIDGE_PLATFORM_SEND_ENABLED` | false (본 packet 범위 밖) |
| `ORDER_BRIDGE_IDENTITY_HASH_SECRET` | set (없으면 503) |

## 3. 변경 범위

**바뀌는 것**
- 환경변수 1개: `ORDER_BRIDGE_WRITE_ENABLED=true` (1h 동안만)

**바뀌지 않는 것**
- 코드 변경 0
- 스키마 마이그레이션 0
- raw body logging false
- platform send false
- GTM publish 0
- 운영 PG write 0 (로컬 SQLite ledger만)

## 4. 데이터 안전성

| 항목 | 보장 |
|---|---|
| Response에 raw email/phone/order 노출 | 안 됨 (preview는 hash present 여부만 반환) |
| Log에 raw body 저장 | 안 됨 (`ORDER_BRIDGE_RAW_BODY_LOGGING=false`) |
| Ledger 컬럼에 raw 저장 | 안 됨 (`email_hash` / `phone_hash` / `order_no_hash` / `click_id_hash` / `client_session`만) |
| Platform 실제 전송 | 안 됨 (`platform_send_count` 강제 0) |
| GTM Production publish | 안 됨 |
| 운영 PG write | 안 됨 (`tb_*` 운영 테이블 read-only 유지) |

## 5. blast radius / rollback

- blast radius: `small_local_sqlite_only`. ledger row 200건 상한이 코드에 박혀 있어 자동 차단.
- rollback 1줄: `ORDER_BRIDGE_WRITE_ENABLED=false` 환경변수 복귀.
- 필요 시 추가 1줄: `DELETE FROM order_bridge_ledger WHERE site='biocom' AND created_at >= '<canary_start_kst>'` (better-sqlite3 admin shell).

## 6. canary window 제안

| 항목 | 값 |
|---|---|
| 기간 | 1h |
| 시작 조건 | TJ + ChatGPT 승인 후 평일 11:00 KST |
| 사이트 | biocom only |
| max_rows | 200 (코드 enforced) |
| 자동 stop | raw_stored_count > 0 / platform_send_count > 0 / row_count > 200 / 5xx > 1% / TJ 명령 |
| 관찰 기간 | 직후 24h |

## 7. smoke command (canary 진입 시 그대로 실행)

```
# pre-snapshot
curl -s -o /tmp/order-bridge-summary-pre.json https://att.ainativeos.net/api/attribution/order-bridge/ledger/summary

# 환경변수 1h 켜기 (VM Cloud admin shell)
ORDER_BRIDGE_WRITE_ENABLED=true pm2 restart attribution

# 1h 후 post-snapshot
curl -s -o /tmp/order-bridge-summary-post.json https://att.ainativeos.net/api/attribution/order-bridge/ledger/summary

# diff 검증 (수동)
jq '.summary.row_count' /tmp/order-bridge-summary-pre.json /tmp/order-bridge-summary-post.json
jq '.summary.raw_stored_count, .summary.platform_send_count' /tmp/order-bridge-summary-post.json
```

기대값: row_count 증가 ≥ 1, raw_stored_count == 0, platform_send_count == 0.

## 8. 24h 관찰 체크리스트

- ledger_summary row_count 추세 (선형 증가가 정상)
- duplicate_dedupe_count 비율 (과도하게 높으면 dedupe 과적합)
- raw_stored_count == 0 유지
- platform_send_count == 0 유지
- endpoint 4xx/5xx 분포 (특히 503 hash_secret_missing 없음)
- response에 raw 노출 0건

## 9. 승인 문구 (사람이 복사해서 붙여 넣을 수 있게)

**승인:**
```
[승인] gpt0508-34 작업1 Path B order_bridge limited deploy v2:
ORDER_BRIDGE_WRITE_ENABLED=true 1h canary 진행, raw body logging false 유지,
platform send false 유지, max_rows 200, rollback 명령 사전 등록,
post-canary 24h 관찰 후 PASS/FAIL 보고.
```

**보류:**
```
[보류] gpt0508-34 작업1 보류. 사유: <TJ 코멘트>
```

승인 필요 주체: TJ + ChatGPT operator.

## 10. 추천 옵션과 자신감

- 추천: **Yellow canary 1h + 24h 관찰**
- 자신감: **88%**
- 미지 영역: canary 1h 동안 실주문 호출 트래픽 변동, ledger summary endpoint 캐시 반영 지연.

산출 JSON: `data/path-b-order-bridge-limited-deploy-approval-v2-20260511.json`
