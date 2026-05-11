# Google Ads click_view snapshot prep table — design only (gpt0508-42 작업7)

작성 시각: 2026-05-11 16:30:00 KST
Lane: Yellow design only (실행 0)

## 1. 사람이 이해하는 작업 설명

- **무엇을 했는가**: 2차 목표인 campaign_id exact attribution 을 위해 Google Ads `click_view` 30d snapshot 을 자체 prep table 로 가져오는 schema 와 dry-run plan 작성. raw click_id 평문 저장 금지 + hash join 만 사용.
- **왜 했는가**: 본 sprint 의 1차 목표 (아임웹 수준 유입 분석) 를 방해하지 않으면서, Green 영역 design 까지 같은 sprint 안에서 끌고 가라는 운영 철학에 따름.
- **어떻게 했는가**: schema 12 컬럼 + index 3 개 draft / fetch 3 options (GAQL REST / BigQuery / Ads UI manual CSV) / sha256 변환 + 메모리 redaction / join 로직 / 일 1회 cron / Claude Code 가능 여부 검토.
- **결과가 무엇인가**: prep table schema draft 와 dry-run plan 완성. 실행은 TJ 의 Ads API credentials 또는 수동 CSV export 후에만 가능 — 본 sprint 안에서 fetch / write 0.
- **목표에 어떤 영향을 줬는가**: Track E Platform Exact Attribution 45% 유지 (실행 안 했으니 점수 변화 0). 본 design 자체는 Track F (Data Guide) 95% 유지에 기여.
- **남은 병목은 무엇인가**: Google Ads API credentials (developer_token + OAuth2 access_token + customer_id) 또는 BigQuery 권한 또는 Ads UI 수동 CSV export. Claude Code 가 자동 fetch 불가.

## 2. schema draft

```sql
CREATE TABLE google_ads_click_view_prep (
  click_id_hash TEXT PRIMARY KEY,           -- sha256(rawClickId), raw 저장 안 함
  click_id_type TEXT,                       -- gclid | gbraid | wbraid
  campaign_id TEXT,
  campaign_name_safe TEXT,                  -- PII 정규식 통과 후
  ad_group_id TEXT,
  ad_group_name_safe TEXT,
  click_time_iso TEXT,
  device TEXT,
  match_type TEXT,
  fetched_at TEXT,
  expires_at TEXT,                          -- 30d TTL
  raw_click_id_redacted INTEGER DEFAULT 1   -- 항상 1
);
CREATE UNIQUE INDEX idx_gacvp_click_hash ON google_ads_click_view_prep(click_id_hash);
CREATE INDEX idx_gacvp_campaign ON google_ads_click_view_prep(campaign_id, click_time_iso DESC);
CREATE INDEX idx_gacvp_expires ON google_ads_click_view_prep(expires_at);
```

## 3. dry-run plan

1. **fetch** — 3 옵션 중 하나
   - GAQL REST `POST https://googleads.googleapis.com/.../googleAds:search` (credentials 필요)
   - BigQuery `bq query` (GCP 권한 필요)
   - Ads UI 수동 CSV export (TJ 동작)
2. **transform** — raw click_id 즉시 sha256 변환 후 메모리 폐기. campaign_name / ad_group_name PII 정규식 통과 검사.
3. **write** — prep table INSERT/REPLACE. `expires_at = fetched_at + 30d`. `raw_click_id_redacted = 1` 강제.
4. **join with site_landing** — `site_landing_ledger.click_id_value_or_hash` (`storage_mode='hash'`) 와 sha256 비교. match → campaign_id 부여 → cross_reference_evidence A_via_ledger_budget_floor.
5. **cron** — 일 1회 fetch.

## 4. raw click_id 정책 체크

| 항목 | 결과 |
|---|---|
| platform 응답 payload 안 raw click_id 평문 저장 | ❌ |
| transform 단계에서 sha256 변환 후 메모리 redaction | ✅ |
| log 출력 | ❌ |
| export | ❌ |

## 5. Claude Code 가능 여부

| 항목 | Claude Code 가능? | 설명 |
|---|---|---|
| schema draft + index 작성 | YES | 본 문서 |
| fetch script draft (credentials placeholder) | YES | tsx script 작성 가능 |
| sha256 변환 helper | YES | `crypto.createHash` 사용 |
| join SQL 작성 | YES | site_landing_ledger ↔ prep |
| GAQL REST 실제 호출 | NO | OAuth2 access_token + developer_token 이 TJ 계정 |
| BigQuery query 실행 | NO | GCP credentials |
| Ads UI 수동 CSV export | NO | Web UI 자동화 불가 |
| TJ 가 CSV export 한 파일을 받아 prep table 채우기 | YES | 대체 경로 |

TJ 가 진입해야 하는 화면 / 받아야 하는 credentials:
- Google Ads Manager > API Center > Developer Token
- GCP Console > APIs & Services > Credentials > OAuth2 client
- BigQuery Console (대안)
- Ads UI Reports (수동 CSV export 대안)

## 6. 다음 액션

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | fetch script draft (credentials placeholder) + sha256 helper 작성 | YES | — | 80 | 60 | 60 | 15 | 65 | 보류 (Ads credentials 없으면 실행 안 됨, 다음 sprint) |
| TJ님 | Ads UI 에서 click_view 30d CSV export → Claude Code 에 전달 | NO | Web UI 자동화 불가 | 50 | 40 | 60 | 30 | 45 | 보류 (1차 목표 deploy 후) |
| TJ님 | Ads API credentials (developer_token + OAuth2 client + customer_id) 발급 | NO | TJ Google 계정 권한 | 50 | 30 | 70 | 30 | 50 | 보류 (별도 sprint) |

산출 JSON: `data/google-ads-click-view-snapshot-prep-design-20260511.json`
