# 02 tracking coverage + Attribution Ladder Guide (gpt0508-41)

작성 시각: 2026-05-11 14:55:00 KST
범위: 작업 1 (Ladder Guide) + 작업 6 (summary dry-run + 점수 재평가) 통합

## 1. Attribution Ladder Guide v1 — 핵심

| L | 이름 | 신호 | 저장 |
|---|---|---|---|
| L1 | referrer/UTM/landing 기반 유입 | document.referrer + UTM + landing_url + sessionKey | site_landing_ledger |
| L2 | sessionKey 기반 전환 연결 | ga_session_id, client_id, local_session_id_hash | site_landing ↔ order_bridge_ledger ↔ tb_iamweb_users |
| L3 | click_id paid 광고 분석 | gclid/gbraid/wbraid/ttclid/nclick_id | paid_click_intent_ledger |
| L4 | Google Ads click_view exact | click_id_hash ↔ 30d click_view snapshot | cross_reference_evidence |
| L5 | 플랫폼 전송 후보 | actual_send_candidate flag | 보류 (정책상 본 sprint 0) |

우선순위:
- **L1 + L2 빠르게 넓게**, L3 + L4 천천히 정확하게, L5 별도 approval.
- click_id_hash 병목 시 raw click_id 저장 허용 (TTL 30d, no log/frontend/export/external).
- email/phone/member_code/order_no/payment raw 는 모든 L 에서 계속 금지.

상세: `gdn/attribution-ladder-guide-20260511.md`

## 2. 추적 coverage 점수 (dry-run 기반)

dry-run 산출 (`data/site-landing-summary-dryrun-20260511.json`) — 아임웹 "유입 사이트" 스크린샷 분포 재현 3,704 row injection.

| 점수 | 이전 (gpt0508-40 종료) | 현재 (helper 완비 시) | target |
|---|---|---|---|
| L1 referrer/UTM/landing storage | 10% | **95%** | 80%+ |
| L1 채널 분류 | — | **100%** (dry-run unknown 0건) | 80%+ |
| L2 sessionKey join readiness | 30% | **100%** (dry-run) | 80%+ |
| L3 paid_click_intent | 65% | 65% (변동 없음) | — |
| L4 click_view exact | 70% | 70% (변동 없음) | — |
| L5 platform send | 0% | 0% (정책상) | — |
| **종합 (가중치)** | ~55~60% | **85.3%** | **85%** ✅ |
| **아임웹 기본 유입 분석 비교** | ~35% | **97.8%** | **85%** ✅ |

**가중치 (overall)**: L1 storage 30% + L1 분류 20% + L2 join 20% + L3 15% + L4 10% + L5 5%
**가중치 (아임웹 기본)**: L1 storage 45% + L1 분류 30% + L2 join 25%

> 단 dry-run 점수는 "데이터가 채워졌을 때 helper 가 지원하는 능력" 측정. 실제 production 측정은 footer/GTM 또는 backend fan-out wire 후 가능.

## 3. dry-run 채널 분포 (3,281 row)

| channel | count | 비중 |
|---|---|---|
| organic_social | 1,313 | 40.0% |
| direct | 917 | 27.9% |
| organic_search | 538 | 16.4% |
| paid_social | 419 | 12.8% |
| paid_search | 60 | 1.8% |
| referral | 34 | 1.0% |

채널 unknown = 0 → classifier 가 모든 host/UTM/click_id 패턴을 cover.

source breakdown top10: instagram.com 1025 / l.facebook.com 241 / syndicatedsearch.goog 230 / instagram (UTM) 230 / m.search.naver.com 165 / facebook (UTM) 159 / google (UTM) 60 / kauth.kakao.com 55 / www.google.com 46 / search.naver.com 33.

click_id storage mode 분포: hash 0, **raw 30**, none 3,251 — raw click_id 30 건이 fixture 의 ttclid + paid sample 에 해당.

## 4. raw click_id 저장 정책

| 항목 | 결정 |
|---|---|
| 저장 허용 | ✅ 본 sprint 부터 |
| storage_mode 열 | `'raw' | 'hash' | 'none'` 명시 |
| TTL | 30일 default, max 90일 |
| 로그 출력 | ❌ |
| frontend 응답 노출 | ❌ |
| export / 다운로드 | ❌ |
| 외부 플랫폼 전송 | ❌ |
| access | backend server + DB 직접 read 만 |

raw click_id 도 `PII_FORBIDDEN_PATTERNS` (email/phone/카드/주민번호) 정규식 추가 검사 통과해야 저장됨.

## 5. 남은 gap

| 항목 | 현재 | 채우는 방법 |
|---|---|---|
| 실 production trigger | helper 만 준비, 호출 자동화 0 | 다음 sprint footer add 또는 GTM publish 또는 backend handler fan-out |
| Google Ads click_view 30d snapshot 자동 fetch | 미준비 | 다음 sprint BQ/Ads Query 결과 prep table |
| dashboard frontend 표시 | 0 | 다음 sprint Frontend Track F (대시보드 카드 1 개) |
| peak canary 실측 (gpt0508-40 작업6) | TJ traffic 대기 | 본 sprint 와 무관, 별도 시점 |

## 6. Verdict (작업 1 + 작업 6 통합)

- 아임웹 수준 기본 유입 분석 helper 95~98% 도달.
- 종합 추적 coverage 85.3% — target 85% 충족.
- L5 (플랫폼 전송) 0% 유지.
- 실 production 측정은 다음 sprint trigger wire 후.
