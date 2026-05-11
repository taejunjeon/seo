# paid_search campaign sanity check (gpt0508-44 작업5)

작성 시각: 2026-05-11 18:30:00 KST

## 1. 이번에 가능해진 것

운영에 도착한 첫 paid_search 7 row 의 campaign 이름이 **무엇을 의미하는지** 와 **어떤 보고용으로 안전한지** 가 판별됐다. campaign_id exact 매칭 시도는 하지 않았고, Google Ads upload / send / conversion action 변경 0 invariant 유지.

## 2. 왜 중요한지

UTM `utm_campaign` 값을 그대로 budget 정합성 판단에 쓰면 큰 오류 가능. 이번 sprint 시점에는 채널 분포 보고 정도만 안전.

## 3. 확인 결과

| campaign | count | 유형 | 채널 보고용? | budget 판단용? |
|---|---:|---|---|---|
| `googleads_shopping_supplements_dangdang` | 4 | UTM 원본 | ✅ | ❌ (campaign_id exact 필요) |
| `googleads_shopping_supplements_youngdays` | 3 | UTM 원본 | ✅ | ❌ |
| `b2026051144755feeb63db` | 3 | imweb 자동 ID (오인 노출) | ❌ | ❌ |
| `1` | 1 | UTM 오작성 / unknown | ❌ | ❌ |

## 4. campaign_source_type 정의

| type | 의미 |
|---|---|
| `utm_campaign` | URL 의 `utm_campaign=` 그대로 들어온 사람 작성 값 |
| `mapped_name` | campaign_id 가 사람이 읽는 name 으로 매핑된 값 (Ads API export) |
| `inferred` | 다른 column 에서 추정한 값 (imweb 자동 ID 등) — 부정확 |
| `unknown` | 분류 불가 |

## 5. 안 한 것 (정책 검증)

- Google Ads `click_view` API 호출 0
- Google Ads conversion action 변경 0
- campaign_id exact match 시도 0
- platform send / upload 0

## 6. 다음 액션

| Owner | Action | Claude Code 가능? | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 추천 |
|---|---|---|---:|---:|---:|---:|---|
| Claude Code | 채널 보고에 `googleads_*` 2 캠페인만 사용 | YES | 90 | 90 | 70 | 10 | 진행 |
| TJ님 | Google Ads click_view CSV export 또는 API credentials | NO — Google 계정 권한 | 50 | 30 | 70 | 30 | 보류 (campaign_id exact 는 다음 sprint) |

산출 JSON: `data/paid-search-campaign-sanity-check-20260511.json`
