# GTM Preview 필요 여부 verdict (gpt0508-44 작업3)

작성 시각: 2026-05-11 18:25:00 KST
**현재 verdict: `GTM_PARKED_PROVISIONAL`** (자신감 60% — 표본 12)

## 1. 이번에 가능해진 것

GTM Preview 가 필요한지 "감" 이 아니라 **숫자 + 시간 윈도우 기반 규칙**으로 정해졌다. 첫 30분 측정 결과 source_evidence_present_rate 1.0, 채널 4 카테고리 cover → "GTM 보류 (parked)" 방향으로 잠정 verdict. 단 표본 12 가 50 임계보다 작아 24h / 72h 시점 재산출 후 확정.

## 2. 왜 중요한지

GTM 변경은 imweb footer 보다 안전하지만 그래도 publish 시 사이트 전체에 Custom HTML 이 실행. 진짜 필요한지 숫자로 확인 안 하면 불필요한 리스크 떠안음.

## 3. 결정 규칙

| 조건 (24h 기준) | verdict |
|---|---|
| source_evidence_present_rate ≥ 60% AND organic/direct/referral > 0 | **GTM_PARKED** (현재 잠정) |
| 30% ≤ rate < 60% | GTM_PREVIEW_CONDITIONAL_RECOMMENDED |
| rate < 30% | GTM_PREVIEW_STRONGLY_RECOMMENDED |
| total_rows < 50 | INSUFFICIENT_SAMPLE_HOLD (병행) |
| 72h 기준 organic + direct + referral 모두 0 | landing page_view 캡쳐 보강 → GTM Preview 추천 |
| paid_search 만 계속 증가 organic 0 | backend fan-out 이 paid 흐름만 잡고 있을 가능성 → audit |

## 4. 현재 측정값

| 지표 | 값 | 임계 |
|---|---|---|
| source_evidence_present_rate | **1.0** | ≥ 0.6 → parked ✓ |
| organic + direct + referral | 5 (organic_search 2 + referral 2 + self_internal 1) | > 0 ✓ |
| total_rows | 12 | < 50 (sample_too_small) |
| 결합 verdict | **GTM_PARKED_PROVISIONAL** | 표본 부족으로 confidence 0.6 |

## 5. 24h / 72h 분기

| 시점 | row 도착 시나리오 | 결정 |
|---|---|---|
| 24h (2026-05-12 18 KST) | total < 50 | INSUFFICIENT_SAMPLE_HOLD 유지, 72h 까지 대기 |
| 24h | rate ≥ 60% AND organic > 0 | **GTM_PARKED 확정** → packet archive |
| 24h | rate < 60% | GTM_PREVIEW_CONDITIONAL_RECOMMENDED 로 정정 |
| 24h | paid_only growing organic = 0 | GTM_PREVIEW_RECOMMENDED_FAN_OUT_BIAS — backend audit 추가 |
| 72h | final verdict 확정 + packet archive 또는 즉시 실행 분기 | — |

## 6. imweb footer 결정

계속 last resort (parked). GTM 도 보류 결정이면 footer 도 당연히 보류.

## 7. approval 상태

본 packet 은 verdict + update 규칙만. GTM Production publish 본 sprint 와 다음 sprint 모두 금지.

## 8. 다음 액션

| Owner | Action | Claude Code 가능? | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 추천 |
|---|---|---|---:|---:|---:|---:|---|
| Claude Code | 24h 시점 snapshot 재실행 + verdict 정정 | YES | 80 | 90 | 90 | 5 | 진행 (시간 조건) |
| Claude Code | 72h 시점 final verdict | YES | 80 | 60 | 95 | 5 | 진행 (시간 조건) |
| TJ님 | (verdict 가 GTM_PREVIEW_CONDITIONAL/STRONGLY 로 정정될 때만) GTM Container 진입 | NO — Container admin 권한 | 0 | 0 | 0 | 0 | **대기 (verdict 정정 시점에만)** |

산출 JSON: `data/gtm-preview-need-verdict-after-live-snapshot-20260511.json`
