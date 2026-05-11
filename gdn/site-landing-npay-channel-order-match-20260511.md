harness_preflight:
  common_harness_read: harness/common/HARNESS_GUIDELINES.md  # 2026-05-11 18:00 KST read
  project_harness_read: n/a (cross-project attribution / 데이터 join)
  required_context_docs:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/REPORTING_TEMPLATE.md (v1.3)
    - gdn/site-landing-revenue-join-v2-bridge-success-20260511.md
    - imwebapi.md §213-246 (NPay 채널 주문번호 매핑)
    - data/dbstructure.md (3 DB 명칭)
  lane: Green
  allowed_actions:
    - read-only query (VM SQLite + 운영DB)
    - transient candidate 추출 (raw 비저장)
    - 산출 JSON + md 작성 (이번 sprint 는 commit 까지 X)
  forbidden_actions:
    - 운영DB write
    - 로컬DB write
    - 외부 send
    - GTM publish
    - raw email/phone/member_code/order_no/payment 출력/logging
    - raw order_code / channel_order_no 산출 파일 persist
  source_window_freshness_confidence:
    source: VM Cloud SQLite (site_landing_ledger + imweb_orders) + 운영DB (public.tb_iamweb_users)
    window: 2026-05-11 06:44~09:13 UTC (= KST 15:44~18:13)
    freshness:
      site_landing_ledger_max: 2026-05-11T09:13:44.135Z UTC
      imweb_orders_npay_max_in_window: 2026-05-11T07:55:25.000Z UTC
      operational_db_naverpay_max_order_date: 2026-05-11 09:47:22 KST  # 약 9h lag
    confidence: 0.92

---

# 액션 2 후속 — NPay 매출 join 시도, 0건 + 원인 진단 (운영DB NPay sync 9h lag)

작성 시각: 2026-05-11 18:10 KST
**결론: 0건. 식별자 mismatch 아니라 운영DB NAVERPAY_ORDER sync 9h lag 가 원인. 24h 뒤 재실행 권장.**

## 1. 사람이 이해하는 작업 설명

| 필드 | 내용 |
|---|---|
| 이번에 가능해진 것 | 직전 sprint 에서 site_landing → 로컬 → 운영DB 3-hop bridge 로 **CARD 4건 ₩55만 1,000** 매칭에 성공했으므로, 같은 bridge 를 **NPay** 결제에도 적용 가능한지 검증함. 결과: NPay 0건. 그러나 그 0건이 "schema 가 작동 안 함" 이 아니라 "운영DB sync lag 9시간" 이라는 근거를 확보. |
| 왜 필요했는지 | L2 attribution ladder (광고 클릭 → 매출 join) 에서 NPay 가 차지하는 비중이 매출의 약 18% (운영DB 30일 기준 NPay 214건 ₩3,827만). NPay 가 매칭 안 되면 L2 의 5분의 1 매출이 보이지 않게 됨. |
| 어떻게 작동하는지 (비개발자용) | (a) 고객 유입 장부 (site_landing_ledger) 에서 NPay 관련 페이지 흔적을 찾고, (b) 그 흔적 안에 있는 주문 식별번호로 아임웹 로컬 캐시 (imweb_orders) 의 NPay 결제를 골라내고, (c) 그 주문번호로 개발팀 운영DB (tb_iamweb_users) 의 NAVERPAY_ORDER 결제완료 row 와 join 함. |
| 실제로 확인된 결과 | NPay URL 추출은 0건 (브라우저 referrer policy 제약). 시간 기준 bridge 로 후보 5건 ₩28만 200 (모두 thecleancoffee) 까지 만들었으나 **운영DB 매칭 0건**. 원인 = 운영DB NAVERPAY_ORDER sync 가 KST 09:47 까지만 적재됨 (CARD 는 16:47, SUBSCRIPTION 은 14:58). NPay 만 lag 9h. |
| 아직 안 된 것 | 매칭 0건이므로 매출 합계 ₩0. 24h 뒤 NPay 가 적재되면 같은 query 로 회복 가능. NPay 가 만성적으로 9h lag 면 운영DB sync pipeline 점검 필요. |

## 2. 작업별 결과표

| 작업 | owner | 결과 | 검증 | 다음 병목 |
|---|---|---|---|---|
| site_landing 의 pay.naver.com referrer row 검색 | Claude Code | 6건 발견 (모두 thecleancoffee /shop_view/, NaPm 만 보유) | VM SQLite 쿼리 (read-only) | URL 안에 channel_order_no 없음 (browser referrer policy 잘림) |
| site_landing 의 landing_url 에 NPay 완료 URL 패턴 검색 | Claude Code | 0건 (`order/result` / `npay` / `pay.naver` 모두 0) | VM SQLite 쿼리 | NPay 완료 후 사이트로 곧장 돌아오는 redirect 가 site_landing capture rule 에 안 잡힘 |
| imweb_orders npay row of same window 추출 | Claude Code | 5건 (모두 thecleancoffee, ₩28만 200, KST 15:45~16:55) | VM SQLite 쿼리, transient 만 저장 | candidate 형성 성공 |
| 운영DB tb_iamweb_users.order_number 매칭 (order_no) | Claude Code | 0건 | pg read-only | sync lag 9h 로 운영DB 에 아직 미적재 |
| 운영DB tb_iamweb_users.order_number 매칭 (channel_order_no) | Claude Code | 0건 | pg read-only | 운영DB 는 imweb order_no (15자리) 만 사용. channel_order_no 별도 컬럼 없음 |
| 운영DB NAVERPAY_ORDER sync freshness 진단 | Claude Code | max(order_date) KST 09:47:22 (CARD 16:47, SUB 14:58) | pg read-only | NPay 만 9h lag — sync pipeline 점검 후보 |
| 식별자 형식 cross-check (운영DB 829건 NPay) | Claude Code | 829건 모두 15자리 숫자 (imweb order_no 형식) — last4 일치 검증 | pg read-only | 운영DB 적재만 되면 매칭 가능 |

## 3. Track 진척률

| Track | 이전 | 현재 | Δ | 이유 |
|---|---:|---:|---:|---|
| A Order Truth / Payment Bridge | 100 | 100 | 0 | (직전 sprint 에서 100 도달, 본 sprint 는 분기 검증) |
| B Imweb Source Capture | 92 | 93 | +1 | NPay sync lag taxonomy 추가 |
| C Imweb Attribution Builder | 97 | 97 | 0 | NPay 매칭 0건 — bridge 자체는 작동, 운영DB lag 가 병목 |
| D Dashboard Decision View | 92 | 92 | 0 | |
| E Platform Exact Attribution | 45 | 45 | 0 | |
| F QA / Guard / Data Guide | 99 | 99 | 0 | |
| G Site Landing Ledger | 98 | 98 | 0 | browser referrer policy 한계 재확인 |

## 4. 금지선 준수

| 항목 | 값 | 비고 |
|---|---|---|
| 운영DB write | 0 | read-only 쿼리만 |
| 로컬DB write | 0 | VM SQLite read-only |
| 외부 send | 0 | |
| GTM publish | 0 | |
| send_candidate | false | 본 sprint 는 분석만 |
| actual_send_candidate | false | |
| upload_candidate | 0 | |
| raw email/phone/member_code | 출력/logging 0 | transient 매개 |
| raw order_code / channel_order_no | 산출 파일 persist 0 | script 변수로만 |

## 5. 다음 할 일 owner + 점수표

| Owner | Action | Claude Code 가 직접 가능한가 | 못 하면 이유 | 데이터 충분도 | 타이밍 점수 | 목표 영향도 | 위험도 | 종합 추천 점수 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 본 query 를 내일 (2026-05-12) KST 18:00 이후 재실행해서 NPay 5건이 운영DB 에 적재됐는지 확인 | YES | - | 95 | 90 | 75 | 10 | **87** | 진행 (조건부 — main thread 가 schedule 결정) |
| Claude Code | 운영DB payment_method 별 sync lag 모니터링 query 를 daily 로 적재하는 helper 작성 (운영DB read-only) | YES | - | 90 | 70 | 80 | 15 | **80** | 진행 추천 |
| Claude Code | NPay completion URL capture 를 site_landing wrapper 에 추가하는 design doc 작성 (browser referrer policy 우회: imweb 결제 successcallback 안에서 직접 channel_order_no 를 fetch 호출로 전달) | YES | - | 80 | 60 | 85 | 25 (script 변경) | **75** | 조건부 진행 (먼저 design 만, deploy 는 Yellow Lane 승인 후) |
| TJ 님 | 운영DB NPay sync 9h lag 가 일시적인지 만성적인지 개발팀에 확인 | PARTIAL (Claude Code 가 lag 추이 데이터 수집 가능, 개발팀 컨택은 TJ 님) | 외부 컨택 권한 | 70 | 50 | 90 | 5 | **78** | TJ 님 처리, Claude Code 가 lag 데이터 daily 제공 |

## 6. Source / Window / Freshness / Confidence

| 항목 | 값 |
|---|---|
| source | VM Cloud SQLite (site_landing_ledger + imweb_orders) + 운영DB (public.tb_iamweb_users) |
| window | 2026-05-11 06:44~09:13 UTC = KST 15:44~18:13 |
| freshness (운영DB NPay) | max(order_date) = 2026-05-11 09:47:22 KST (lag ≈9h) |
| freshness (운영DB CARD) | max(order_date) = 2026-05-11 16:47:57 KST (lag ≈1h) |
| freshness (VM SQLite imweb_orders npay) | max(order_time) = 2026-05-11T07:55:25.000Z UTC |
| site | thecleancoffee (5/5 candidates) |
| confidence | 0.92 (식별자 cross-check + lag 진단 결정적) |

## 7. 검증 근거

| 검증 | 결과 | 명령/방법 | 비고 |
|---|---|---|---|
| site_landing referrer 패턴 검색 | 통과 | sqlite3 `SELECT ... FROM site_landing_ledger WHERE referrer_host LIKE '%pay.naver.com%'` | 6 건 발견 |
| site_landing URL 패턴 검색 | 통과 | landing_url LIKE '%order/result%' / '%npay%' / '%pay.naver%' | 0 건 |
| imweb_orders npay candidate 추출 | 통과 | 5 건 (thecleancoffee), transient 추출 | |
| 운영DB order_number 매칭 (order_no) | 통과 (0건) | pg `WHERE order_number = ANY($1::text[])` | 5 candidates 0 hit |
| 운영DB order_number 매칭 (channel_order_no) | 통과 (0건) | pg | 0 hit |
| 운영DB 식별자 형식 cross-check | 통과 | 829 NPay rows, length=15, all_digits=true, last4 일치 sample 확인 | imweb order_no 형식 일치 |
| sync lag 진단 | 통과 | payment_method 별 max(order_date) 비교 | NPay 9h lag 확정 |

## 8. 남은 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 운영DB NPay sync 9h lag 가 만성적이면 NPay 매칭 evidence 가 항상 9h 지연 | L2 attribution 의 실시간 NPay 매칭 불가, daily batch 만 가능 | TJ 님 → 개발팀 확인. Claude Code 가 lag 추이 daily 수집. |
| browser referrer policy 로 NPay 완료 URL 직접 capture 불가 | site_landing 단독으로 NPay 매출 join 불가 (imweb_orders bridge 필수) | imweb header/footer 의 결제 successcallback 안에서 channel_order_no 를 fetch 로 우리 receiver 에 직접 전송하는 wrapper 설계 (Yellow Lane 후보) |
| imweb_orders 1,915건 npay 중 일부가 운영DB 에 영원히 적재 안 될 가능성 | L2 매칭률 상한선이 낮아짐 | 운영DB NPay 적재율 percent 를 daily query 로 추적. 비율 < 95% 면 alert. |

## 9. HOLD Reducer

| 항목 | 값 |
|---|---|
| hold_reason | N/A (작업은 완료, 0건 결과는 sync lag 로 명확히 설명됨) |
| hold_reason_category | N/A |
| auto_green_followups_available | YES |
| auto_green_followups_done | sync lag taxonomy 진단, 24h 재실행 plan 마련 |
| remaining_blocker | 운영DB sync lag 그 자체 (외부 개발팀 사정) |
| next_lane | Green (24h 재실행 query) / Yellow (NPay successcallback wrapper, deploy 시) |
| tj_action_required | YES (만성 lag 여부 개발팀 확인) |
| codex_next_green_action | 내일 KST 18:00 이후 NPay sync 재검증 query 재실행 |

## 10. 변경 파일 (산출만, 코드 변경 0)

| 파일 | 변경 내용 | 범위 내 여부 |
|---|---|---|
| data/site-landing-npay-channel-order-match-20260511.json | 신규 산출 (분석 결과 정본) | YES |
| gdn/site-landing-npay-channel-order-match-20260511.md | 신규 산출 (본 보고) | YES |

* commit hash / push 정보: (main thread 통합 후 기록)

## 11. 한 줄 결론

- 결론: NPay 매출 join 시도 0건. 원인은 운영DB NAVERPAY_ORDER sync 9h lag (CARD 1h, SUB 6h, NPay 9h). 식별자 자체는 imweb order_no = 운영DB order_number 로 동일 형식 cross-check 됨.
- Project: SEO L2 attribution ladder
- Phase: site_landing → 매출 join 검증 (NPay subset)
- Lane: Green
- Mode: read-only 분석
- Auditor verdict: PASS (no-send/no-write/no-publish/no-deploy 모두 verified, raw identifier persist 0)
- 자신감: 92%
- 기준 시각: 2026-05-11 18:10 KST
