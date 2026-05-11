# 01 site_landing_ledger core result (gpt0508-41)

작성 시각: 2026-05-11 14:55:00 KST
범위: 작업 2 + 작업 3 + 작업 4 + 작업 5 통합
fixture 결과: 12 + 9 + 18 = **39/39 PASS**

## 1. 신규 코드

| 파일 | 라인 | 역할 |
|---|---|---|
| `backend/src/siteLandingLedger.ts` | 372 | schema + bootstrap + record + summarize |
| `backend/src/siteLandingChannelClassifier.ts` | 178 | UTM/referrer/click_id 기반 채널 분류 |
| `backend/src/routes/attribution.ts` (편집) | +95 | POST `/api/attribution/site-landing` 신규 endpoint |
| `backend/tests/site-landing-ledger.test.ts` | 196 | 12 fixture PASS |
| `backend/tests/site-landing-channel-classifier.test.ts` | 110 | 18 fixture PASS |
| `backend/tests/site-landing-receiver.test.ts` | 138 | 9 fixture PASS |
| `backend/scripts/site-landing-summary-dryrun-20260511.ts` | 130 | summary dry-run |

## 2. site_landing_ledger 스키마 핵심

```sql
CREATE TABLE site_landing_ledger (
  landing_id TEXT PRIMARY KEY,           -- sll-<uuid>
  site TEXT NOT NULL DEFAULT 'biocom',
  landed_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  referrer_host TEXT, referrer_full_url TEXT,
  is_self_domain INTEGER,
  landing_url TEXT, landing_path TEXT,
  utm_source/medium/campaign/term/content,
  click_id_type, click_id_value_or_hash,
  click_id_storage_mode TEXT,            -- 'hash' | 'raw' | 'none'
  ga_session_id, client_id, local_session_id_hash,
  channel_classified TEXT,               -- 8개 카테고리
  source_breakdown TEXT,                 -- host / utm_source
  dedupe_key TEXT UNIQUE,                -- 10분 bucket + sessionKey + url + utm
  duplicate_count INTEGER,
  expires_at TEXT                        -- TTL 30일 default
);
```

핵심 invariant:
- raw email/phone/order_no/payment 패턴 8 정규식으로 차단
- raw click_id 는 허용 (storage_mode='raw' 명시), TTL 30일 자동 만료
- dedupe = 10분 bucket + landing_url + sessionKey 우선 + utm + referrer

## 3. /api/attribution/site-landing receiver

| 동작 | 결과 |
|---|---|
| Method | POST |
| Body 필수 | `landingUrl` |
| Body 선택 | `referrerHost`, `referrerFullUrl`, `utm.*`, `clickId.{type,valueOrHash,storageMode}`, `sessionKey.*`, `landedAt`, `landingPath` |
| 응답 | `{ ok, mode:"no_send_internal_write_only", deduped, channel_classified, source_breakdown, click_id_storage_mode, is_self_domain, invariants_held }` |
| raw PII | 4 정규식 패턴 (주민번호 / 전화 / 이메일 / 카드) 일치 시 400 reject |
| external send / GTM publish | 0 |

## 4. channel_classified 분류 룰 우선순위

1. `clickIdType` 가 gclid/gbraid/wbraid → paid_search (google.com) / ttclid → paid_social (tiktok) / nclick_id → paid_search (naver)
2. UTM medium cpc/cpm/paid/ads/sem + source = paid_social/paid_search
3. UTM medium organic_social/organic_search/social
4. referrer 가 자기 도메인 (biocom.kr / biocom.imweb.me / www.biocom.kr) → self_internal
5. referrer 없음 → direct
6. 검색 엔진 host (naver/daum/kakao/google/bing/yahoo/baidu/syndicatedsearch.goog 등) → organic_search
7. 소셜 host (instagram/facebook/youtube/tiktok/twitter/threads/pinterest) → organic_social
8. 기타 외부 host → referral

GA4 default channel grouping 과 호환되되 한국 채널 (naver/daum/kakao) 명시 추가.

## 5. funnel-capi v3 server-side mirror 검토 결과

| 항목 | 결과 |
|---|---|
| imweb footer 수정 없이 backend 단독 mirror 가능? | **불가** — landing 시점 단독 발사하는 endpoint 가 backend 에 없음 |
| 기존 `/api/attribution/{marketing-intent,payment-success,checkout-context,paid-click-intent}` handler 안에서 best-effort fan-out 가능? | **가능** — 모든 endpoint 가 referrer/utm/sessionKey 를 이미 수신 중. recordSiteLanding 호출 추가만 필요 |
| 본 sprint 안 wire? | **보류** — Yellow 영역. 다음 sprint deploy 와 함께 wire 권장 |
| 자동 mirror 완전 자동화 위한 추가 작업 | imweb footer 또는 GTM 의 page_view trigger 에서 `/api/attribution/site-landing` 호출 (footer/GTM 수정 별도 approval 필요) |

본 sprint scope (Green code + no footer/GTM) 안에서는 endpoint 와 helper 만 준비. footer 수정 없이도 backend handler fan-out 만으로 marketing-intent/payment-success path 에서 부분 mirror 가능 — 다음 sprint deploy 의 1차 wire 후보.

## 6. fixture 결과 요약

| 영역 | PASS | duration |
|---|---|---|
| ledger schema + record + dedupe + TTL | 12/12 | 233ms |
| channel classifier (clickId/UTM/host/한국채널) | 18/18 | 166ms |
| receiver endpoint (UTM/organic/direct/raw click/hash click/PII 차단/dedupe/invariants) | 9/9 | 638ms |
| **합계** | **39/39** | **1.04s** |

전체 typecheck `npx tsc --noEmit` exit 0.

## 7. invariants

| invariant | 결과 |
|---|---|
| send_candidate / actual_send_candidate | false / false |
| upload_candidate | 0 |
| external_platform_send | 0 |
| GTM Production publish | 0 |
| imweb footer 직접 수정 | 0 |
| 운영DB write | 0 |
| raw email/phone/member_code/order_no/payment | 0 (저장도 logging 도 0) |
| raw click_id 저장 | 허용 (storage_mode='raw' 명시 + TTL 30d + 로그/frontend/export/외부 전송 0) |
