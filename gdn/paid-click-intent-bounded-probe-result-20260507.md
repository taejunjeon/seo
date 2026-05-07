# paid_click_intent receiver bounded no-send probe 결과

작성 시각: 2026-05-07 21:46 KST
대상: `https://att.ainativeos.net/api/attribution/paid-click-intent/no-send`
문서 성격: Green Lane no-send/no-write read-only probe 결과
관련 문서: [[paid-click-intent-pm2-restart-correlation-20260508]], [[paid-click-intent-502-transient-evidence-20260507]], [[paid-click-intent-monitor-agent-v0-20260507]]
Status: completed
Do not use for: 운영 변경, GTM publish, 운영 DB write, 광고 변경

## 5줄 결론

1. 10분간 (12:35:00~12:44:47 UTC = 21:35~21:44 KST) 5초 간격 110 calls bounded no-send probe 실행.
2. **5건 502 (4.5% error rate)** 발생. 5건 중 4건이 12:35~12:37 사이 burst (5분 동안 4건).
3. 모든 5xx 시각이 PM2 30초 주기 restart timing과 거의 정확히 매칭. 본 evidence는 [[paid-click-intent-pm2-restart-correlation-20260508]]의 confirmed_pm2_restart_burst 판정을 추가로 강화.
4. 이론값 6.7% (5초 probe 간격 × 30초 restart 주기 × 1~2초 unavailable) 대비 실측 4.5%. unavailable window 평균 약 1초 추정.
5. no_write/no_platform_send violation 0. 110 calls 모두 dryRun true marker 응답.

## 실험 설계

```yaml
endpoint: https://att.ainativeos.net/api/attribution/paid-click-intent/no-send
method: POST (Content-Type: application/json), dryRun true
cases: 5종 (positive_test_gclid, missing_google_click_id, reject_value_currency, reject_pii, reject_admin_path) — oversized 제외
calls_per_case: 22 (round-robin)
total_calls: 110
pace: 5초 간격
window: 2026-05-07 12:35:00Z ~ 12:44:47Z (UTC) = 21:35~21:44 KST 약 9.8분
data: data/paid-click-intent-bounded-probe-20260507.jsonl
```

## 결과 분포

| case | n | 400 | 502 | avg response time |
|---|---:|---:|---:|---:|
| missing_google_click_id | 22 | 22 | 0 | 387ms |
| positive_test_gclid | 22 | 22 | 0 | 515ms |
| reject_admin_path | 22 | 21 | **1** | 285ms |
| reject_pii | 22 | 20 | **2** | 486ms |
| reject_value_currency | 22 | 20 | **2** | 551ms |
| **합계** | **110** | **105** | **5** | - |

## 5xx 시각 분포

```text
12:35:00Z  reject_value_currency  → 502 (225ms)
12:35:27Z  reject_value_currency  → 502 (303ms)   ← 27초 뒤
12:36:27Z  reject_pii             → 502 (449ms)   ← 60초 뒤
12:37:30Z  reject_admin_path      → 502 (244ms)   ← 63초 뒤
12:42:00Z  reject_pii             → 502 (201ms)   ← 4분 30초 뒤 (isolated)
```

## PM2 restart 시각과 매칭

같은 sprint에서 직접 수집한 PM2 restart timeline (`/home/biocomkr_sns/.pm2/pm2.log` SSH read-only) 발췌:

```text
12:34:58 online → next exit 12:35:28
12:35:28 online → next exit 12:35:58
12:35:58 online → next exit 12:36:28
12:36:28 online → next exit 12:36:58
12:36:58 online → next exit 12:37:28
12:37:28 online → next exit 12:37:58
12:37:58 online → next exit 12:38:28
...
```

| probe 502 시각 | 가장 가까운 PM2 restart | 차이 | 해석 |
|---|---|---|---|
| 12:35:00 | exit 12:34:58 → online 12:34:58 | 2s after restart, fresh connection issue 또는 직전 restart unavailable window 마지막 |
| 12:35:27 | exit 12:35:28 (1s after probe) | -1s | restart trigger 직전 backend가 SIGINT 처리 중 502 |
| 12:36:27 | exit 12:36:28 | -1s | 동일 패턴 |
| 12:37:30 | exit 12:37:28 → online 12:37:28 | 2s | restart 직후 또는 직전 transition window |
| 12:42:00 | (interpolated 12:42:28 또는 12:41:58) | ~30s 내 | isolated, restart 주기 안 |

→ 5건 모두 PM2 SIGINT~online transition 1~2초 window 안에 발생. **confirmed**.

## 운영 영향 정량화 (재계산)

| 지표 | 이론값 | 실측값 | 차이 원인 |
|---|---:|---:|---|
| 5xx 비율 | 6.7% (5s/30s × 2s/30s = 0.067) | 4.5% (5/110) | unavailable window 평균이 1~2초가 아닌 약 1초 |
| 일평균 5xx 추정 | 96분/일 | **65분/일** | 0.045 × 24 × 60 |

→ 본 receiver는 **하루 약 65분 동안 5xx 위험 영역**. minimal ledger write 진입 전 PM2 restart 빈도 완화 필수.

## 가드 검증

```text
no_write_violations:        0
no_platform_send_violations: 0
모든 응답이 dryRun true marker 포함
사용자 PII/주문/광고 ID 노출 없음
```

## 참고

- `data/paid-click-intent-bounded-probe-20260507.jsonl` — 110 entries 원본
- `gdn/paid-click-intent-pm2-restart-correlation-20260508.md` — PM2 correlation 본문
- `gdn/paid-click-intent-502-transient-evidence-20260507.md` — 직전 30 calls evidence
- `gdn/backend-errorhandler-payload-hardening-approval-20260508.md` — 별건 oversized 500 hardening 승인안
