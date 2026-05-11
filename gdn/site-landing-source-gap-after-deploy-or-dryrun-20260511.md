# source evidence gap 재측정 (gpt0508-43 작업5)

작성 시각: 2026-05-11 17:40:00 KST
측정 방식: live (deploy 후 5분) + dryrun 추정 결합
GTM 필요 여부 verdict: **`GTM_PREVIEW_CONDITIONAL_RECOMMENDED`**

## 1. 이번에 가능해진 것

작업 4 deploy 가 끝난 직후 운영 서버에서 직접 `source_evidence_present_rate`, `channel_bucket_distribution`, `unknown_or_hold_count`, `paid_hint_count`, `organic_count`, `direct_count`, `referral_count` 6 가지 분포 지표를 측정할 수 있게 됐다. 본 sprint 시점에는 트래픽 0 건 (deploy 후 5 분) 이라 dryrun 추정으로 결정했고, 그 결과 **"GTM Preview 조건부 추천"** 으로 결정.

## 2. 왜 필요했는지

deploy 직후 "GTM Preview 가 정말 필요한가" 는 느낌이 아니라 숫자로 결정해야 다음 sprint 의 우선순위가 명확해진다.

## 3. 어떻게 작동하는지 (비개발자용)

- 광고/결제 신호 4 곳에서 들어올 수 있는 필드 11 종 (UTM 5 + referrer + landing_url + 광고 click ID 4 + 세션 키 3) 의 평균 "들어올 확률" 을 추정 + 가중치 적용.
- 60% 이상이면 자체 backend 만으로 충분 (GTM 보류).
- 30~60% 면 GTM Preview 만들어 부족한 source 보강 추천.
- 30% 미만이면 GTM Preview 즉시 진행 강력 추천.

## 4. 실제로 확인된 결과

| 측정 | 값 | 비고 |
|---|---|---|
| live total rows (deploy 후 5분) | **0** | 자연 트래픽 도달 0건. ledger 테이블 자동 생성 전. |
| weighted landing quality score (dryrun) | **0.61** | 60% 경계 |
| 평균 source field present rate (dryrun) | **0.43** | 30~60% 범위 |
| channel 분포 추정 | organic ~52% / paid ~23% / direct ~20% / referral ~5% | dryrun 기준 |
| GTM 필요 verdict | **GTM_PREVIEW_CONDITIONAL_RECOMMENDED** | 60% 안팎 — 조건부 |
| imweb footer 직접 수정 | **last resort (parked)** | GTM 이 안전 |

## 5. source gap 원인 분리

| 카테고리 | 항목 |
|---|---|
| **landing source not captured** | organic page_view 단독 landing — backend 가 받는 endpoint 없음 |
| **session lost** | `ga_session_id` 0.6 — cookie 비허용 시 미수신 |
| **paid click source absent** | naver `nclick_id` 0.0 — footer/funnel-capi v3 미캡쳐 추정 |
| **handler missing evidence** | `fbclid` 0.05 — Meta 광고 클릭이 paid-click-intent handler 까지 안 들어옴 |
| **deploy pending** | NO — deploy 완료됨 |

## 6. 아직 안 된 것

- live row delta 측정 (deploy 후 72 시간 정도 자연 트래픽 수집 후 재산출).
- GTM Preview Container 진입 + Custom HTML 태그 임시 활성화 (작업 5 packet ready, **TJ approval 필요 — 본 sprint 와 다음 sprint 모두 publish 금지**).

## 7. 다음 액션

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 72시간 후 site-landing summary 재호출 + 실측 verdict 재산출 | YES | — | 75 | 50 | 80 | 10 | 70 | 진행 (시간 조건) |
| TJ님 | GTM Container 진입 + Custom HTML 임시 Preview (gpt0508-42 작업5 packet 그대로) | NO — Web UI 자동 조작 불가 | Claude Code 가 GTM Web UI 자동 조작 불가, Container admin 권한 TJ | 70 | 60 | 90 | 30 | 65 | 조건부 진행 (72h live verdict 본 후) |
| TJ님 | 본인 브라우저로 사이트 1~2 페이지 방문 + 광고 클릭 1회 시도 | NO — 사용자 본인 트래픽 | 자연 트래픽 가속화로 live verdict 빠르게 수집 가능 | 60 | 80 | 50 | 5 | 60 | 진행 (편의 시) |

산출 JSON: `data/site-landing-source-gap-after-deploy-or-dryrun-20260511.json`
