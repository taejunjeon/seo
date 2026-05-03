# Project AIBIO — Autonomy Policy (의도치 않은 fork case)

본 파일은 정본 link 없이 Lane 표를 직접 복제한 case 이다. 본 fixture 는 detect 되어야 한다 (WARNING).

작성: 2026-05-03

## 0. 결론 (10초)

세 lane 으로 작업을 분류:

| Lane | 의미 | 승인 요건 |
|---|---|---|
| 🟢 **Green Lane** | reversible / read-only / dry-run / 운영 영향 0 | **승인 불요** — agent 자율 |
| 🟡 **Yellow Lane** | controlled smoke / temporary state / cleanup 필수 | **sprint 1회 승인** — 시작 후 cleanup 까지 자율 |
| 🔴 **Red Lane** | 운영 비가역 / 외부 플랫폼 영향 / 자동 운영 전환 | **매 작업마다 명시 승인** |

## 1. Green Lane

### 허용

| 카테고리 | 예시 |
|---|---|
| 문서 | runbook, design doc |
| read-only | DB SELECT, BigQuery SELECT |
| dry-run | mode=dry_run POST |
| audit | tsc, lint |

## 2. Yellow Lane

### 허용 (sprint 1회 승인 후)

| 카테고리 | 조건 |
|---|---|
| smoke window open | max_inserts ≤ 5 |
| temporary env flag | sprint 종료 시 즉시 제거 |

## 3. Red Lane

### 매 작업마다 명시 승인

| 작업 | 사유 |
|---|---|
| GA4 send | 외부 플랫폼 dispatch |
| permanent env flag ON | 운영 상태 영구 변경 |

## 4. Lane ramping

| 상황 | 동작 |
|---|---|
| Green Lane PASS | 자동 진행 |
| Yellow Lane sprint 승인 | cleanup 까지 자율 |
| Red Lane | 명시 승인 |

## 5. Risk-widening

Yellow / Red lane 의 "확장" 은 별도 명시 승인 필요:

| 시도 | 분류 | 처리 |
|---|---|---|
| smoke window max_inserts 5 → 10 | risk-widening | 멈춤 |
| GTM Preview 가 아닌 sandbox container | risk-widening | 멈춤 |
| 외부 send 1건만 test | Red Lane | 매번 승인 |
| smoke duration 30 → 60분 | risk-widening | 멈춤 |
| dispatcher 의 새 fetch endpoint 추가 | risk-widening | 멈춤 |
| backend schema 변경 | Red Lane | 매번 승인 |

## 6. 적용 흐름

1. sprint 시작: lane 분류 (Green Lane / Yellow Lane / Red Lane)
2. 분류 보고: TJ 에게 lane + 핵심 작업 요약
3. TJ 응답: Green Lane → 자동 진행, Yellow Lane → 1회 승인, Red Lane → 매 작업
4. sprint 진행: 정책 안에서 자율 / 멈춤 / 보고
5. sprint 종료: 보고서 + lesson 등록 + audit + commit/push

## 7. 본 정책 자체의 변경

본 정책 변경은 TJ 명시 승인 필요 (Red Lane). agent 자율 변경 안 함.

## 8. 보충 시나리오

- 시나리오 A: Green Lane 작업이 도중에 Yellow Lane 으로 escalate 되는 경우 — 즉시 멈춤 + TJ 보고
- 시나리오 B: Yellow Lane 의 cleanup 단계 누락 — sprint 미완 처리
- 시나리오 C: Red Lane 작업 중 외부 플랫폼 응답 비정상 — 즉시 멈춤 + rollback

## 9. 부록 — 기록 의무

각 sprint 의 lane 분류 결정과 그 시점은 본 sprint 의 결정 문서 첫 부분 yaml block 에 기록한다.

## 10. 기타

본 파일은 fork 의심 fixture — Lane phrase 다수 + 정본 link 미언급. preflight-check 가 WARNING 으로 detect 해야 한다 (80-249줄 범위 + Lane 표 5개 이상 + 정본 link 0).
