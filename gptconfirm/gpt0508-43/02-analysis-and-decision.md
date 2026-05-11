# 02 분석 + 결정 (gpt0508-43)

작성 시각: 2026-05-11 17:50:00 KST
범위: 작업 5 (source evidence gap 재측정) + 결정 트리

## 1. 측정 결과 (live + dryrun)

| 항목 | 값 |
|---|---|
| live total rows (deploy 후 5분) | 0 |
| weighted landing quality score (dryrun) | **0.61** |
| 평균 source field present rate (dryrun) | **0.43** |
| channel 분포 (dryrun 추정) | organic ~52% / paid ~23% / direct ~20% / referral ~5% |

## 2. source field 별 present rate (dryrun)

| 필드 | rate | 비고 |
|---|---:|---|
| landing_url | 0.95 | 모든 endpoint 보유 |
| referrer | 0.85 | direct 만 빈값 |
| utm_source / medium / campaign | 0.55 | paid 일 때만 |
| gclid | 0.20 | Google 광고 클릭 시 |
| gbraid / wbraid | 0.05 / 0.03 | Google 일부 |
| fbclid | 0.05 | Meta 광고 |
| naver nclick_id | **0.0** | 캡쳐 갭 |
| client_id | 0.70 | metadata.clientId |
| ga_session_id | 0.60 | cookie 비허용 시 미수신 |
| local_session_id_hash | 0.50 | paid_click_intent 만 |

## 3. GTM 필요 여부 결정 (요청 임계 기준)

| 임계 | verdict |
|---|---|
| 60% 이상 | GTM parked |
| 30~60% 미만 | GTM Preview 조건부 추천 |
| 30% 미만 | GTM Preview 강력 추천 |

weighted landing quality **0.61** → 60% 경계.
평균 source present rate **0.43** → 30~60% 범위.

**최종 결정: `GTM_PREVIEW_CONDITIONAL_RECOMMENDED`**

근거:
- 0.61 은 parked 임계 (60%) 와 조건부 임계 (30~60%) 의 경계.
- live 측정이 더 명확해질 때까지 GTM Preview packet 은 ready 상태로 유지하되 즉시 실행은 보류.
- 다음 결정 트리거: deploy 후 72시간 live 측정 또는 행정/마케팅 캠페인이 organic landing 증가시킨 시점.

imweb footer 직접 수정은 **last resort (parked)** 로 유지.

## 4. gap 원인 분류

| 카테고리 | 항목 |
|---|---|
| landing source not captured | organic page_view 단독 landing — backend 가 받는 endpoint 없음 |
| session lost | `ga_session_id` 0.6 — cookie 비허용 시 미수신 |
| paid click source absent | naver `nclick_id` 0.0 — footer 미캡쳐 추정 |
| handler missing evidence | `fbclid` 0.05 — Meta 광고 클릭이 paid-click-intent handler 까지 미도달 |
| deploy pending | **NO** (deploy 완료) |

## 5. 다음 측정

- 본 sprint 안에서 추가 5~10 분 polling (background) 실행 — 결과 도착 시 00 §3 에 반영. 도착 안 하면 0 row 그대로 기록.
- 72시간 후 자연 트래픽 도착 시 verdict 재산출.

## 6. invariants 유지 (deploy 후도)

`external_send_count=0`, `upload_candidate_count=0`, `gtm_publish=0`, `imweb_footer_edit=0`, `operational_db_write=0`, `raw_pii_in_response=false`.

산출 JSON: `data/site-landing-source-gap-after-deploy-or-dryrun-20260511.json`
