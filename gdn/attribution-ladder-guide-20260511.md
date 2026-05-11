# Attribution Ladder Guide v1 (gpt0508-41 작업1)

작성 시각: 2026-05-11 14:50:00 KST
Lane: Green doc — 향후 모든 sprint 가 L1→L5 ladder 단계에 따라 우선순위 결정
자신감: 90%
관련 정본: [`attribution-data-source-decision-guide-20260511.md`](attribution-data-source-decision-guide-20260511.md) (data source 정본은 그쪽, 본 가이드는 *attribution 깊이의 단계*)

## 한 줄 결론

attribution 은 한 번에 click_id exact 까지 가는 게 아니라 **L1 referrer/UTM/landing 기반 아임웹 수준 유입 분석 → L2 sessionKey 전환 연결 → L3 click_id paid 광고 분석 → L4 Google Ads click_view campaign_id exact → L5 플랫폼 전송 후보** 5 단계의 ladder 로 본다. L1~L2 는 빠르게 넓게 구축, L3~L5 는 천천히 정확하게 고도화.

## 1. Ladder 단계

### L1 — referrer/UTM/landing 기반 아임웹 수준 유입 분석

목표: 광고/organic 무관 모든 landing 을 자체 DB 에 잡는다. 아임웹 "유입 사이트 / 유입 경로 분석 / 마케팅 성과 측정 (UTM)" 3 기능 재현.

신호:
- `document.referrer` 호스트 / 풀 URL
- `is_self_domain` 매칭 (biocom.kr / biocom.imweb.me / www.biocom.kr)
- UTM 5 필드 (`source/medium/campaign/term/content`)
- `landing_url` / `landing_path`
- `ga_session_id` / `client_id` / `local_session_id_hash`

저장: VM Cloud SQLite `site_landing_ledger` (gpt0508-41 신규)
표시 후보: 자체 dashboard "유입 분석" 카드 — read-only summary
판단 우선순위: **가장 먼저 채워야 할 layer**. 자체 추적 % 의 약 40%p 가 여기에 달림.

### L2 — sessionKey 기반 전환 연결

목표: L1 landing row 와 R2 ledger / 운영DB 주문 / 회원 가입을 같은 sessionKey 로 join 한다.

신호: `ga_session_id`, `client_id`, `local_session_id_hash`, `order_no_hash`, `member_code` (hash only)

저장: site_landing_ledger ↔ order_bridge_ledger ↔ tb_iamweb_users HMAC join

판단 우선순위: L1 다음. 단순 PV 가 아니라 **전환 funnel** 으로 사용하려면 필수.

### L3 — click_id 기반 paid 광고 분석

목표: gclid / gbraid / wbraid / ttclid / nclick_id 가 있는 row 만 별도 ledger (`paid_click_intent_ledger`) 에 유지. 광고 budget 정합성 baseline.

저장 정책:
- 기본: `click_id_hash` (sha256, raw 폐기)
- **fallback (gpt0508-41 신규)**: hash 작업이 병목이면 raw click_id 저장 허용 (`click_id_storage_mode='raw'`). 단 TTL 30일, 로그/frontend/export/외부 전송 금지, access 제한.

판단 우선순위: 이미 60~70% 구축됨. 본 sprint 에서는 L1/L2 우선이라 L3 신규 작업 없음 (raw click_id 허용 정책만 신설).

### L4 — Google Ads click_view campaign_id exact

목표: click_id 가 실제 Google Ads click_view 30d snapshot 에 매칭되는지 확인하여 campaign_id 까지 확정.

신호: ledger `click_id_hash` → Google Ads click_view exact lookup (`googleAdsClickViewExactLookup`)
저장: cross_reference_evidence `A_via_ledger_budget_floor` 카테고리

판단 우선순위: L3 위에 얹는 정확도 layer. 천천히 고도화.

### L5 — 플랫폼 전송 후보

목표: 위 L1~L4 evidence 가 충분한 row 만 Google Ads / Meta / TikTok upload 후보로 표시.

저장: cross_reference_evidence `actual_send_candidate` flag

판단 우선순위: 본 sprint 범위 아님. 모든 invariant `actual_send_candidate=false` 유지.

## 2. 단계별 현재 점수 (gpt0508-41 시작 시점)

| L | 영역 | 점수 | gap |
|---|---|---|---|
| L1 | referrer/UTM/landing 자체 저장 | **~10%** (funnel-capi v3 캡쳐만, 자체 ledger 0) | 가장 큰 gap |
| L2 | sessionKey 전환 연결 | ~30% (R2 ledger ↔ 운영DB join 가능, organic landing 없음) | L1 채워야 의미 |
| L3 | click_id paid 광고 분석 | ~65% (paid_click_intent + R2) | 안정화 진행 중 |
| L4 | Google Ads click_view exact | ~70% (helper PASS, peak canary 실측 대기) | 측정 신호 필요 |
| L5 | 플랫폼 전송 후보 | 0% (정책상 본 sprint 아님) | — |
| 종합 | | **약 55~60%** | 목표 85% |

## 3. 본 sprint (gpt0508-41) 의 ladder 위치

- 작업 2~6: **L1 + L2 집중**
- 작업 1: 본 가이드 (모든 sprint 가 ladder 단계로 talk 하도록 정렬)
- L3/L4/L5: 변경 없음 (이미 진행 중인 layer 유지)

## 4. 정책 (raw click_id 저장)

본 sprint 신규:

| 항목 | 허용 |
|---|---|
| `click_id_value` raw 저장 (`storage_mode=raw`) | ✅ — TTL 30일 |
| 로그 출력 (`console.log`, app log) | ❌ |
| frontend 응답에 raw 노출 | ❌ |
| export / 다운로드 | ❌ |
| 외부 플랫폼 전송 | ❌ |
| 분석 DB 외 다른 위치 복제 | ❌ |
| access 권한 | 백엔드 서버 + DB 직접 접근만 |

email / phone / member_code / order_no / payment **raw 저장 또는 logging 은 본 가이드와 무관하게 계속 금지**.

## 5. 가이드 사용법

- 새 sprint 가 attribution / tracking / ROAS 영역 작업을 시작할 때 본 ladder 의 어느 L 인지 한 줄로 명시.
- 보고서 첫 줄 yaml block 에 `ladder_level: L1|L2|L3|L4|L5` 추가 권장.
- L 단계가 두 개에 걸치면 둘 다 명시.
- click_id exact 가 안 되어 막힐 때 → 본 가이드의 L1 부터 채울지 검토.

## 6. 다음 액션

### Claude Code 가 할 일 (gpt0508-41 안)

- 작업 2~6 진행 (site_landing_ledger 구축).
- 본 가이드의 L1 점수를 10% → 60% 이상으로 끌어올린다.

### TJ 님이 할 일

- 본 ladder 단계 동의 여부.
- L5 플랫폼 전송 단계는 별도 approval — 본 sprint 와 무관.

## 7. Verdict

`LADDER_V1_DEFINED_L1_FOCUS_FOR_GPT0508_41`

산출 JSON: [`data/attribution-ladder-guide-20260511.json`](../data/attribution-ladder-guide-20260511.json)
