# 01 정정 + 검증 (gpt0508-45)

작성 시각: 2026-05-11 18:30:00 KST
범위: false positive 4건 정정 + site 다중화 + 운영 backfill + snapshot 재확인

## 1. 정정한 것

### 1-1. internal/test 분류 regex 정정
- gpt0508-44 의 `tagInternalTest` 가 utm_campaign 만 보고 `b2026...feeb63db` / `1` 4 건을 internal_test 로 잘못 분류.
- 실제 데이터: 카카오 알림톡 (utm_source=kakao + utm_medium=brand-message) + 네이버 파워링크 (utm_source=naver + utm_medium=powerlink).
- 정정 규칙: utm_source 가 광고 채널 (kakao/naver/google/meta/facebook/instagram/tiktok 등) 이면 무조건 real_customer.

### 1-2. site 다중화 (backend 코드)
- 기존: recordSiteLanding 의 `site: "biocom"` 하드코딩.
- 정정: `SiteKey = "biocom" | "thecleancoffee"` 타입 도입.
- `detectSiteFromUrl(landingUrl)` 추가 — landing URL 의 host 로 자동 site 감지.
- fan-out helper / receiver endpoint / summary API 모두 landing host 기반 site 자동 분기.
- `summary API` query 에 `site=` 파라미터 추가 (default biocom).

### 1-3. classifier 의 self_domain site 별 분기
- SELF_DOMAINS_BY_SITE 매핑: biocom=[biocom.kr, www.biocom.kr, biocom.imweb.me], thecleancoffee=[thecleancoffee.com, www.thecleancoffee.com, thecleancoffee.imweb.me]
- 입력 `site` 가 명시되면 그 site 의 self_domain 만 매칭.

### 1-4. paid medium 확장
- 기존 PAID_MEDIUMS (cpc/cpm/paid/ads/sem/ppc/paid_*) 외에 EXTRA_PAID_MEDIUMS 추가:
  - brand-message / brand_message (카카오 알림톡)
  - powerlink / power-link (네이버 파워링크)
  - biz-message / alimtalk / kakao-message

### 1-5. summary API utm_campaign_top10 확장
- 기존 `[{campaign, count}]` → `[{campaign, source, medium, count}]`
- snapshot script 가 source 정보 활용해 internal_test 판정 정확.

## 2. 변경 파일

| 파일 | 변경 |
|---|---|
| backend/src/siteLandingLedger.ts | SiteKey 타입 + detectSiteFromUrl + SELF_DOMAINS_BY_SITE + summarize 의 site 파라미터 |
| backend/src/siteLandingChannelClassifier.ts | site 별 self_domain + EXTRA_PAID_MEDIUMS + ClassifierInput.site |
| backend/src/siteLandingFanout.ts | landing host 로 site 자동 감지 |
| backend/src/routes/attribution.ts | summary API site 파라미터 + receiver site 자동 감지 |
| backend/scripts/site-landing-live-snapshot-20260511.ts | tagInternalTest 가 utm_source 받음 + site 파라미터 |
| backend/tests/site-landing-multi-site.test.ts | 신규 11 fixture |

## 3. 검증

| 검증 | 결과 |
|---|---|
| backend `npx tsc --noEmit` | exit 0 |
| 전체 site-landing fixture (5 파일) | **64/64 PASS** (회귀 0) |
| 신규 multi-site fixture | **11/11 PASS** |
| VM `npm run build` | exit 0 |
| pm2 restart seo-backend | online |
| `GET /api/attribution/site-landing/summary?site=biocom` | HTTP 200, total 86 |
| `GET /api/attribution/site-landing/summary?site=thecleancoffee` | HTTP 200, total 17 |
| 응답 raw 이메일/전화/주민/카드 정규식 hit | 0 |

## 4. 운영 backfill

기존 row 16 건이 site='biocom' 로 잘못 태깅된 것을 thecleancoffee 트래픽으로 정정.

```sql
UPDATE site_landing_ledger SET site='thecleancoffee'
WHERE site='biocom' AND (referrer_host LIKE '%thecleancoffee.com%' OR landing_url LIKE '%thecleancoffee.com%');
-- 16 rows affected

UPDATE site_landing_ledger SET channel_classified='paid_social', source_breakdown='kakao'
WHERE site='thecleancoffee' AND utm_source='kakao' AND utm_medium IN ('brand-message','brand_message');

UPDATE site_landing_ledger SET channel_classified='paid_search', source_breakdown='naver'
WHERE utm_source='naver' AND utm_medium IN ('powerlink','power-link');
```

## 5. 정정 후 분포

### biocom (24h, 86 row)
| channel | count |
|---|---:|
| paid_search | 68 |
| self_internal | 14 |
| organic_search | 2 |
| paid_social | 1 |
| direct | 1 |

- source_evidence_present_rate: **1.0**
- internal_or_test_traffic_count: **0** (정정 전 4 → 0)
- gtm_verdict_provisional: **GTM_PARKED** (PROVISIONAL 떨어지고 확정 — 표본 86 > 50)

### thecleancoffee (24h, 17 row)
| channel | count |
|---|---:|
| paid_social | 12 (카카오 알림톡) |
| organic_search | 3 |
| self_internal | 1 |
| referral | 1 |

- source_evidence_present_rate: 1.0
- internal_or_test_traffic_count: 0
- gtm_verdict_provisional: INSUFFICIENT_SAMPLE_HOLD (17 < 50)

## 6. 금지선 준수 (gptconfirm 문서 only)

| invariant | 결과 |
|---|---|
| send_candidate / actual_send_candidate / upload_candidate | false / false / 0 |
| GA4 / Meta / TikTok / Naver 운영 전송 | 0 |
| Google Ads upload / conversion action 변경 | 0 |
| GTM Production publish | 0 |
| imweb footer / header 직접 수정 | 0 |
| 운영DB write | 0 (로컬 SQLite 만 backfill) |
| raw email/phone/order_no/payment/member_code | 저장/logging 0 |
| raw click_id storage_mode | hash only (production 검증) |
| ORDER_BRIDGE_RAW_BODY_LOGGING / PLATFORM_SEND_ENABLED | false / false |
| Telegram | 0 (TJ standing skip — 00 §결론 통합) |

## 7. 알려진 추가 발견 (다음 sprint 후보)

- utm_campaign_top10 의 일부 row 에서 `source` / `medium` 가 `campaign` 과 같은 값으로 들어옴 — fan-out 의 AttributionLedgerEntry 의 utm_* 파싱이 같은 값으로 채우는 케이스. 별도 audit 필요.
- thecleancoffee 의 imweb.me 도메인 정확한 값 확인 필요 (현재 추정).
