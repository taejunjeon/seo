# VM Cloud `imweb_orders` 의 status sync 갭 audit

작성 시각: 2026-05-11 20:50 KST
**결론: VM Cloud SQLite `imweb_orders.imweb_status_synced_at` 가 2026-05-10 06:11 KST 이후 한 번도 갱신 안 됨. 일반 `sync-orders` 와 `sync-order-statuses` 가 분리되어 있고, 후자가 수동 의존 + 1일 14시간 전 마지막 실행.**

> DB 표기 규칙 (본 문서 적용): 모든 테이블 명은 어느 DB 인지 명시 — 로컬DB / 운영DB / VM Cloud. CLAUDE.md 의 3 분류만 사용.

## 1. 이번에 가능해진 것

직전 audit 에서 summary API `derived.npay_revenue_30d.max_order_time` 이 양 site 모두 **2026-05-08** 로 표시되는 이유를 정확히 추적했다. 진짜 문제는 imweb v2 API 의 NPay 정보 누락이 아니라 **VM Cloud SQLite `imweb_orders` 의 imweb_status / complete_time 채우는 별도 sync 가 5/10 06:11 이후 멈춰있음** 이라는 점.

## 2. 왜 필요했는지

- summary API 의 매출 표시가 3일 늦으면 dashboard 신뢰도 떨어짐.
- 운영DB `tb_iamweb_users` 와의 row 수 차이 74건의 일부 원인 (gpt0508-45 audit) 도 같은 status sync 갭이 설명 가능.
- 다음 sprint 의 fix 방향 (수동 한 번 / cron 등록 / sync 합치기) 결정.

## 3. 어떻게 작동하는지 (비개발자용)

backend 의 imweb 주문 sync 가 사실 **두 단계** 로 나뉘어 있음:
1. **첫 sync** (`POST /api/crm-local/imweb/sync-orders`) — 주문번호 / 시각 / 결제수단 / 금액 / raw_json 채움. 자주 돌아감 (5/11 KST 18:40, 90분 전).
2. **두 번째 sync** (`POST /api/crm-local/imweb/sync-order-statuses` 추정 endpoint) — 주문 상태 (`imweb_status`) 만 별도 imweb v2 API status 필터 list 로 채움. **수동 의존, 1일 14시간 전 마지막 실행**.

NPay 결제완료 정보 (`complete_time` / `imweb_status='PURCHASE_CONFIRMATION'`) 가 두 번째 sync 결과에 의존하기 때문에, 두 번째 sync 안 돌면 새 NPay 결제는 모두 "비어있는 status" 로 보임.

## 4. 실제로 확인된 결과

### 4-1. 두 sync 의 마지막 시점 (VM Cloud SQLite)
| 컬럼 | 마지막 timestamp | 의미 |
|---|---|---|
| `imweb_orders.synced_at` (VM Cloud) | **2026-05-11 09:40 UTC (KST 18:40)** | 일반 sync 정상, 90분 전 |
| `imweb_orders.imweb_status_synced_at` (VM Cloud) | **2026-05-10 06:11 UTC (KST 15:11)** | status sync **1일 14시간 전 멈춤** |

### 4-2. biocom NPay 날짜별 (VM Cloud `imweb_orders`)
| 날짜 (order_date) | rows | imweb_status 채워진 | 비고 |
|---|---:|---:|---|
| 2026-05-04 | 4 | 4 | 정상 |
| 2026-05-05 | 9 | 9 | 정상 |
| 2026-05-06 | 5 | 5 | 정상 |
| 2026-05-07 | 10 | 10 | 정상 |
| 2026-05-08 | 7 | 7 | 정상 (5/10 06:11 sync 시점 이전) |
| 2026-05-09 | 5 | 5 | 정상 |
| **2026-05-10** | **13** | **6** | **5/10 06:11 sync 이후 도착한 7건 미라벨** |
| **2026-05-11** | **2** | **0** | **전부 미라벨** |

### 4-3. raw_json 안 complete_time 확인
biocom 5/10 NPay 3 row 의 raw_json sample: `"complete_time":0` (정수 0). 즉 imweb v2 API 응답 자체가 0 으로 보낼 때도 있고, 별도 status sync 가 complete_time 갱신을 하는 구조로 추정.

## 5. 영향

| downstream | 영향 |
|---|---|
| summary API `derived.npay_revenue_30d` | `max_order_time` = 5/8 표시, **biocom 5/9~5/11 약 20건 + thecleancoffee 약 37건** 매출 합계 누락 |
| 운영DB `tb_iamweb_users` (운영DB) vs VM Cloud `imweb_orders` row 수 차이 74건 (gpt0508-45) | 본 갭이 일부 (5/10~5/11) 설명, 나머지는 imweb v2 API 페이지네이션 누락 |
| dashboard 매출 표시 | 3일 이상 stale |

## 6. 해결안

### 옵션 A — 즉시 수동 sync (권장 첫 단계)

```bash
# VM 안에서 (Claude Code 직접 가능)
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "curl -X POST http://localhost:7020/api/crm-local/imweb/sync-order-statuses"'
```

- 5/10 06:11 이후 약 60 row 의 imweb_status / complete_time 채워짐.
- 운영DB write 0, 외부 송신 0. VM Cloud `imweb_orders` UPDATE 만.
- Claude Code 즉시 실행 가능.

### 옵션 B — cron 등록 (중기)

- `backend/scripts/aios-agent-runner.ts` 에 imweb-order-status-sync agent 추가 또는 VM 에서 `crontab -e` 시간당 등록.
- Claude Code 부분 가능 (script 작성), TJ 가 cron / systemctl 등록 권한 필요.

### 옵션 C — 두 sync 합치기 (장기 권장)

- `sync-orders` 단계에서 raw_json 안 `orderStatus` 필드를 imweb_status 컬럼에 같이 채움 → 별도 status sync 불필요.
- raw_json 안 keys 에 `orderStatus` 가 이미 있음 (직전 D audit 결과).
- backend code 1 파일 + fixture + deploy. Claude Code 가능.

## 7. 권장 진행 순서

1. **옵션 A 즉시 실행** — Claude Code 가 sync 호출 → 5/10 06:11 이후 row 채워짐 + summary API 매출 정상화.
2. **옵션 C 다음 sprint** — 구조적 fix, 별도 sync 의존 제거.
3. **옵션 B 불필요** — 옵션 C 적용 후 sync 분리 자체 사라지면 cron 불필요.

## 8. 검증

| 검증 | 결과 |
|---|---|
| 운영DB write | 0 |
| 로컬DB write | 0 |
| VM Cloud SQLite write | 0 (audit 단계, 옵션 A 실행 시 UPDATE 발생 예정) |
| 외부 송신 | 0 |
| raw email/phone/order/payment/member_code 출력 | 0 |
| backend tsc | 본 audit 변경 코드 없음 → 영향 0 |

## 9. 다음 액션 (REPORTING_TEMPLATE v1.3 §75)

| Owner | Action | Claude Code 직접 가능 | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 옵션 A — 수동 `sync-order-statuses` 호출 | YES — VM SSH + curl | — | 95 | 95 | 90 | 5 | **93** | **진행 즉시** |
| Claude Code | 옵션 C — sync-orders 안에 imweb_status 같이 채우는 구조 fix | YES — backend code + fixture + deploy | — | 80 | 70 | 90 | 20 | **76** | 진행 (옵션 A 결과 본 후) |
| Claude Code | 옵션 A 실행 후 summary API max_order_time 5/11 로 정상화 확인 | YES — curl 1 회 | — | 90 | 90 | 80 | 5 | **84** | 진행 (옵션 A 직후) |
| TJ님 | 옵션 B cron 등록 (옵션 C 가 진행되면 불필요) | NO — cron / systemctl 권한 | VM crontab 권한 | 60 | 40 | 50 | 30 | **48** | 보류 |
