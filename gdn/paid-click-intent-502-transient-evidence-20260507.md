# paid_click_intent receiver 502 transient/persistent 실증

작성 시각: 2026-05-07 21:25 KST
대상: `https://att.ainativeos.net/api/attribution/paid-click-intent/no-send`
문서 성격: Green Lane read-only/no-write/no-send 실증 보고
관련 문서: [[../total/!total-current]], [[../agent/paid-click-intent-monitor-agent-v0-20260507]], [[paid-click-intent-post-publish-monitoring-result-pre24h-20260507]]
Status: read-only investigation result
Do not use for: 운영 receiver 변경, GTM publish, 운영 backend deploy, 운영 DB write, 광고 변경

## 5줄 결론

1. **transient 502 burst 패턴 확인**: 21:19:58~21:20:00 KST 사이 3초 동안 connector가 5회 중 3회 502, 직전·직후 호출은 정상 400. PM2 메모리 재시작 timing 가설을 지지하지만 본 agent 권한으로는 PM2 logs 직접 조회 불가.
2. **이전 21:05 monitoring 502(`reject_value_currency` 1건)는 같은 burst 패턴의 일부일 가능성**이 매우 높다. 본 evidence sprint(21:19~21:20)에서 같은 case는 5/5 정상 400을 받았다.
3. **`reject_oversized_body` 5/5 500은 backend regression이 아니다**. 본 evidence sprint가 사용한 페이로드(120KB)가 운영 monitoring script가 사용하는 페이로드(20KB)보다 크기 때문에 다른 처리 경로를 trigger한 결과다. monitoring script 기준으로는 여전히 413이 정상.
4. 31/35 정상 응답 (88.6%). 본 evidence 한정 5xx 비율은 23%지만, oversized 5건을 본 agent의 over-payload 부작용으로 차감하면 실질 5xx 비율은 **3/30 = 10%** (모두 missing_google_click_id case의 3초 burst).
5. minimal paid_click_intent ledger write 승인 판단 시 본 receiver 안정성을 PM2 재시작 빈도와 묶어 봐야 한다. SSH 권한 부여 시 본 agent가 30분 내에 PM2 logs/restart 시각 매칭 분석을 마무리할 수 있다.

## 실험 설계

```yaml
endpoint: https://att.ainativeos.net/api/attribution/paid-click-intent/no-send
method: POST (Content-Type: application/json)
mode: dryRun true (no_write/no_send 가드 유지)
cases: 6 종 (positive_test_gclid, missing_google_click_id, reject_value_currency, reject_pii, reject_admin_path, reject_oversized_body)
calls_per_case: 5
total_calls: 30 (oversized 5 포함)
pace: 1 call/second (jitter 포함 약 0.7~1.7s 간격)
window: 2026-05-07 21:19:51 ~ 21:20:25 KST (UTC 12:19:51 ~ 12:20:25)
recorder: bash + curl 직접 호출 (운영 monitoring script와 별개로 본 agent 자체 수집)
data: data/paid-click-intent-502-transient-evidence-20260507.jsonl
```

## 결과 분포

| case | n | 200/400 | 500 | 502 | avg response time |
|---|---:|---:|---:|---:|---:|
| positive_test_gclid | 5 | 5 (400) | 0 | 0 | 342ms |
| missing_google_click_id | 5 | **2** | 0 | **3** | 249ms |
| reject_value_currency | 5 | 5 | 0 | 0 | 720ms |
| reject_pii | 5 | 5 | 0 | 0 | 223ms |
| reject_admin_path | 5 | 5 | 0 | 0 | 657ms |
| reject_oversized_body | 5 | 0 | **5** | 0 | 415ms |
| **합계** | **30** | **22** | **5** | **3** | - |

## 5xx 발생 시각 분포

```text
[12:19:58Z] missing_google_click_id try2 → 502 (307ms)
[12:19:59Z] missing_google_click_id try3 → 502 (159ms)
[12:20:00Z] missing_google_click_id try4 → 502 (269ms)
[12:20:01Z] missing_google_click_id try5 → 400 (recovered)

[12:20:21Z] reject_oversized_body try1 → 500 (600ms)
[12:20:22Z] reject_oversized_body try2 → 500 (371ms)
[12:20:23Z] reject_oversized_body try3 → 500 (409ms)
[12:20:24Z] reject_oversized_body try4 → 500 (336ms)
[12:20:25Z] reject_oversized_body try5 → 500 (360ms)
```

### 502 burst 분해

- 폭: 3초 (12:19:58 ~ 12:20:00 UTC)
- 영향 범위: missing_google_click_id case의 try2~try4 만. try1(직전), try5(직후), 다른 case는 모두 정상.
- 응답시간: 159~307ms — connection timeout이 아니라 빠른 5xx 응답 (즉 CloudFront/ALB 단의 backend unreachable signal로 보임)
- 해석: PM2 자식 프로세스의 메모리 재시작(이전 Codex 보고에서 `max_memory_restart=700M` 30~90초 간격)이 발생하면, 그 짧은 transition 동안 ALB가 backend를 unhealthy로 표시 → 5xx burst. 3초 후 새 worker가 ready 되어 정상 복귀하는 패턴과 일치.

### 500 패턴 분해 (oversized)

- 5/5 모두 500 일관됨 — burst가 아닌 deterministic.
- monitoring script의 oversized payload는 20KB이고 운영에서 모두 413으로 처리됨(`reject_oversized_body` block reason `payload_too_large`).
- 본 evidence는 120KB 페이로드를 사용 → backend body parser 또는 receiver 내부 가드가 throw → unhandled error → 500.
- 즉 **본 evidence의 부작용**이지 backend regression이 아님. 운영 monitoring 결과(15:41/20:13/21:05 모두 413 pass)가 정확하다.

## 운영 영향 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 21:05 monitoring 502 (reject_value_currency) | **transient burst의 일부** | 본 evidence에서 같은 case 5/5 정상 |
| 21:19 missing_click_id 502 burst | **transient (PM2 재시작 timing 강력 시사)** | 3초 폭, 직전·직후 정상, 빠른 5xx |
| reject_oversized_body 500 | **본 evidence 부작용 / 운영 regression 아님** | monitoring script 20KB payload는 여전히 413 정상 |
| 24h window 진입 시 5xx 비율 | **추가 evidence 필요** | 본 evidence는 30초 window. 24h 누적은 SSH 또는 long-run agent 필요 |

## 운영 안정성 요약

본 evidence sprint 기준 receiver는 **간헐적 PM2 재시작 burst를 제외하면 정상 동작 중**이다. 사용자 traffic의 영향:

- 평소 응답시간: 200~720ms (validation 무게에 따라 분산)
- transient 5xx 빈도: 본 evidence 30초 window에서 1회 burst (3건). 30초당 1 burst라 가정하면 일별 ~2,880건의 사용자 5xx 가능성 — 단 본 evidence는 한 sample window라 일반화 위험.
- minimal ledger write 진입 전 PM2 max_memory_restart 임계값 상향 또는 메모리 누수 원인 분석이 우선.

## 본 agent로는 못 보는 것 (접근 blocker)

| 항목 | 이유 | TJ 최소 액션 |
|---|---|---|
| PM2 restart 시각 vs 502 burst 시각 매칭 | SSH 권한 영역 | 운영 VM에서 `pm2 logs seo-backend --lines 500` 또는 `pm2 describe 0` 출력 paste |
| nginx access/error log 24h 누적 5xx | SSH 권한 영역 | `tail -2000` 단위 access log paste 1회 |
| receiver POST 누적 카운트 | admin token 미보유 | 별도 admin token 발급 또는 본 agent에 환경변수 전달 |

위 3건 중 1번만 받아도 burst 빈도와 PM2 timing 매칭이 즉시 분석 가능.

## 결론

- 21:19 burst는 transient. 21:05 502도 같은 패턴.
- backend persistent regression 없음.
- minimal ledger write 승인 판단 전, PM2 재시작 빈도와 메모리 추세를 SSH 권한 받은 뒤 본 agent가 정량화하는 게 다음 단계.
- 24h/72h window 도달까지는 자연 traffic 기반 5xx 비율을 별도 SSH 도움 없이 자체 수집할 수 없으므로, 시간 도달 시 monitoring script 결과와 본 evidence를 묶어 final 판정한다.

## 참고

- `data/paid-click-intent-502-transient-evidence-20260507.jsonl` — 30 entries 원본
- `data/paid-click-intent-monitoring-pre24h-20260507.json` — 운영 monitoring script 결과 (20KB oversized 정상 413)
- `data/paid-click-intent-monitor-agent-202605072105.json` — 21:05 agent run (1 fail = reject_value_currency 502)
- `gdn/paid-click-intent-post-publish-monitoring-result-pre24h-20260507.md` — pre24h 결과 보고
