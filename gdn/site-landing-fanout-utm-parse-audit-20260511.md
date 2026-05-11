# 액션 3 — utm 파싱 audit (gpt0508-45 follow-up)

작성 시각: 2026-05-11 19:10 KST
audit mode: read-only SQL + backend/footer 코드 inspect
**결론: backend/footer 버그 아님. Google Ads 광고 URL 의 destination 설정 자체가 비정상.**

## 1. 이번에 가능해진 것

site_landing 137 row 중 67% (92 row) 에서 `utm_source = utm_medium = utm_campaign` 동일 값으로 들어온 원인이 backend/footer 의 파싱 버그가 아니라 **Google Ads 광고 destination URL 의 설정 문제** 라는 것을 코드 inspect 로 확정했다.

## 2. 왜 필요했는지

직전 결과 보고 (gpt0508-45 §7) 에서 "fan-out 파싱 버그 의심" 으로 남겨놓은 의문을 풀어야 한다. backend 코드 버그라면 즉시 정정, Google Ads 설정 문제라면 TJ 가 광고 dashboard 에서 수정해야 함.

## 3. 어떻게 작동하는지 (비개발자용)

3 단계로 검증:

1. **데이터 분포 확인** — site_landing 137 row 의 utm 3 필드 일치 패턴 group by.
2. **backend 파싱 코드 검토** — `buildLedgerEntry` 가 utm_source / utm_medium / utm_campaign 를 각각 별도 key 에서 가져오는지.
3. **footer 캡쳐 코드 검토** — imweb footer JavaScript 가 URL query string 의 각 utm 파라미터를 별도 `params.get('utm_*')` 로 추출하는지.

## 4. 실제로 확인된 결과

### 분포 (137 row)
| 패턴 | count | 비중 |
|---|---:|---|
| ALL_THREE_SAME (셋 다 동일) | **92** | 67% |
| NORMAL (셋 다 다름) | 18 | 13% |
| SOURCE_EQ_MEDIUM | 8 | 6% |
| no_utm | 19 | 14% |

### ALL_THREE_SAME 92 row 의 정체
모두 `googleads_shopping_supplements_*` 패턴 (dangdang / youngdays / biobalance / resetday / poongsung 등).

### NORMAL 18 row 의 정체
- thecleancoffee 카카오 알림톡 (kakao + brand-message + `b2026...feeb63db`): 12 row
- biocom 네이버 파워링크 (naver + powerlink + `1`): 1 row
- 기타 5 row

### 코드 검토
| 영역 | 결과 |
|---|---|
| backend `buildLedgerEntry` (attribution.ts:517~519) | 정상 — `firstString(input, ["utmSource","utm_source"])` 등 각각 별도 key |
| footer `collectTrackingParams` (biocomimwebcode.md:1143~1158) | 정상 — `params.get('utm_source')` 등 각각 별도 |
| snapshot SQL `GROUP BY utm_campaign, utm_source, utm_medium` | 정상 — 별도 column |

→ **버그 위치는 backend / footer 가 아니라 Google Ads 광고 URL 의 destination 설정**.

### 추정 원인
Google Ads dashboard 에서 final URL suffix 가 `{campaign}` ValueTrack 매크로를 utm_source / utm_medium / utm_campaign 셋에 동일 적용:

```
실제 도착 URL:
https://biocom.kr/?utm_source=googleads_shopping_supplements_dangdang
  &utm_medium=googleads_shopping_supplements_dangdang
  &utm_campaign=googleads_shopping_supplements_dangdang

정상이라면:
https://biocom.kr/?utm_source=google&utm_medium=cpc&utm_campaign=googleads_shopping_supplements_dangdang
```

## 5. 분류 영향

| 항목 | 결과 |
|---|---|
| 92 row 의 channel_classified | **paid_search (정확)** — utm_medium 매칭은 실패하지만 referrer host=google.com 또는 click_id 로 fallback 분류 |
| source_breakdown 부작용 | utm_source 가 캠페인 이름으로 들어가 `googleads_shopping_supplements_dangdang` 등이 source 자리에 — 분포 표는 봐서 헷갈림 |
| channel 비율 산출 | 영향 없음 (paid_search 로 분류됨) |
| source/medium 분리 분석 | 불가 (셋 다 동일이라 의미 없음) |

## 6. 아직 안 된 것

- Google Ads dashboard 의 destination URL 정정 — **TJ 만 가능** (Web UI 작업).
- classifier 에 `googleads_*` / `metaads_*` prefix 인 utm_source 를 platform 으로 정규화하는 rule 추가 — Claude Code 가 진행 가능 (25 LOC 정도, 보류 추천).

## 7. 다음 액션

| Owner | Action | Claude Code 가능? | 데이터 충분 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---:|---:|---:|---:|---:|---|
| TJ님 | Google Ads dashboard → 광고 final URL suffix 의 utm_source / utm_medium 를 google / cpc 로 정상화 | NO — Web UI 자동 조작 불가 | 90 | 90 | 80 | 30 | 80 | **진행** (광고팀 협업) |
| Claude Code | classifier 에 `googleads_*` / `metaads_*` prefix 정규화 rule 추가 (workaround) | YES | 75 | 60 | 50 | 20 | 60 | 보류 (TJ 정정 후 불필요해질 수 있음) |
| Claude Code | TJ 정정 후 24h site_landing ALL_THREE_SAME 비율 재측정 | YES | 80 | 60 | 70 | 5 | 70 | 진행 (TJ 정정 후 시간 조건) |

산출 JSON: `data/site-landing-fanout-utm-parse-audit-20260511.json`
