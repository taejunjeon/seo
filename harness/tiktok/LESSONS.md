# TikTok ROAS Lessons

작성 시각: 2026-05-03 KST (Sprint 23.2 신규)
상태: v0 기준판 — `tiktok/!tiktokroasplan.md` 의 결론 / 발견 / 원인 분해 섹션에서 추출
정본 schema: [[harness/!공통하네스_가이드라인]] §10 (redirect → [[harness/common/HARNESS_GUIDELINES]] §10) + [[harness/npay-recovery/LESSONS_TO_RULES_SCHEMA]]
관련: [[tiktok/!tiktokroasplan]] · [[harness/cross-site-lessons/INDEX]]

## 10초 요약

TikTok ROAS 정합성 작업에서 발견한 교훈을 모은다. 전송 후보를 좁히는 규칙은 빠르게 적용, 넓히는 규칙은 TJ 명시 승인 후만.

## 운영 원칙

1. observation → candidate_rule → approved_rule → deprecated_rule (정본 4 lifecycle)
2. 전송 후보를 좁히는 규칙은 evidence 1-2건으로 candidate_rule 진입 가능
3. 전송 후보를 넓히는 규칙 (예: firstTouch 후보를 strict confirmed 로 승격) 은 TJ 승인 + evidence 3-5건 필수

## Seed Lessons

| id | status | title | observation | source | candidate_rule / approved_rule | evidence_count | confidence | owner | applies_to |
|---|---|---|---|---|---|---|---|---|---|
| `tiktok-lesson-001` | candidate_rule | 플랫폼 attribution 과 내부 strict confirmed 의 정의가 다르다 | TikTok 플랫폼 구매값 21건 / 7,367,960원 vs 내부 strict TikTok confirmed 0건 / 0원 (window: 2026-04-21 ~ 2026-04-27). gap 7.36M 은 "정상 매출 누락" 이 아니라 "플랫폼 집계 vs 내부 high-confidence 귀속 기준 차이" | tiktok/!tiktokroasplan.md §2026-04-28 7-day gap 재점검 | 다른 site (TikTok 외 Meta/Google Ads/Naver) 도 플랫폼 attribution vs 내부 confirmed 분리 측정. high-confidence 내부 confirmed 만 예산 증액 판단 기준. 플랫폼 값은 reference | 1 (sprint 19~22 evidence + sprint 23 진입 시점) | 0.88 | Codex | * |
| `tiktok-lesson-002` | candidate_rule | v2 event log 의 confirmed 는 광고 귀속이 아니라 "픽셀 처리 결과" 다 | tiktok_pixel_events 의 "결제완료라 Purchase 전송" 154건 = 사이트에서 TikTok Pixel Purchase 호출이 발생했고 서버 결제 confirmed 라 막지 않고 통과시킨 것. **TikTok 광고 귀속 확정 아님** | tiktok/!tiktokroasplan.md §직접 원인 3 + §2026-04-28 핵심 해석 | UI 문구 정정 — "확정 Purchase 허용" → "결제완료라 Purchase 전송". 테이블 헤더 "최종 action" → "픽셀 처리 결과". 운영자 오해 방지 | 2 (TikTok plan v3.21 + 화면 문구 정정) | 0.92 | Codex | * |
| `tiktok-lesson-003` | candidate_rule | TikTok UTM/ttclid 가 있는 결제 페이지 진입 후보가 운영DB 주문 매칭 0/16 인 경우 = "가상계좌 미입금" 이 아니라 "결제 페이지 / 로그인 / 임시 주문 단계" | 최근 7일 16건 모두 payment_success 가 아니라 checkout 단계, 운영DB tb_iamweb_users 에도 주문번호 없음 | tiktok/!tiktokroasplan.md §2026-04-28 §4 + §2026-04-26 직접 원인 2 | TikTok UTM/ttclid 가 있어도 결제 미완료 후보는 strict confirmed 로 승격하지 않음. firstTouch 보조 지표만 | 1 | 0.85 | Codex | * |
| `tiktok-lesson-004` | candidate_rule | TikTok Ads API 미수집 일자의 비용 0원 = 실제 무집행이 아니다 | 2026-04-23 비용 0원 표시 = 실제 무집행 아니라 TikTok Business API 미수집. 2026-04-25 21:43 KST 에 backfill 후 정상 표시 | tiktok/!tiktokroasplan.md §2026-04-26 비용 0원 결론 | 비용 0원 행 발견 시 "실제 무집행" 결론 전 TikTok Business API freshness 먼저 확인. cron 실패 / RL / 권한 만료 점검 | 1 | 0.9 | Codex | * |
| `tiktok-lesson-005` | candidate_rule | DB / 원장 위치는 항상 명시 — TJ 관리 Attribution VM SQLite vs 개발팀 관리 운영DB PostgreSQL vs 로컬 개발 DB | TJ 관리 Attribution VM (`CRM_LOCAL_DB_PATH#attribution_ledger`) 와 개발팀 관리 PostgreSQL (`dashboard.public.tb_iamweb_users`) 와 로컬 개발 DB (`backend/data/crm.sqlite3`) 가 혼용되면 운영자 혼란 | tiktok/!tiktokroasplan.md §2026-04-27 DB/원장 위치 용어 정정 | 모든 숫자 / lesson / 보고서에 source label 명시 (예: "TJ 관리 Attribution VM SQLite", "개발팀 관리 운영DB PostgreSQL", "로컬 개발 DB"). 단순 "DB" 또는 "ledger" 만 쓰지 않음 | 2 (TikTok plan + Coffee sprint 19~22 의 DB scope label 패턴) | 0.95 | Codex | * |
| `tiktok-lesson-006` | candidate_rule | firstTouch 보강은 신규 이벤트부터 적용 — 과거 주문 metadata 복원 0 | source-persistence 1차 구현 (2026-04-27) 후에도 metadata.firstTouch 가 없는 과거 주문은 exact event-level attribution 복원 불가. firstTouch 후보는 high-confidence 확정 매출 아님 — 예산 증액에 strict confirmed 우선 사용 | tiktok/!tiktokroasplan.md §2026-04-27 source-persistence 로컬 구현 결과 §중요한 한계 | 신규 source-persistence / firstTouch / payment 보강 구현 시 "신규 이벤트부터 적용" 명시. 과거 주문 backfill 의 정확도 한계 보고서에 명시 | 1 | 0.88 | Codex | * |
| `tiktok-lesson-007` | candidate_rule | TikTok 예산 / 소재 판단은 7일 누적 전 보수 유지 | 현재 strict TikTok confirmed 0원, 플랫폼 주장 구매와 내부 주문 근거 사이 gap 큰 상태. firstTouch 보강 전 데이터로 "틱톡이 돈을 벌고 있다" 단정 위험 | tiktok/!tiktokroasplan.md §다음 할일 §3 | 신규 채널 / 소재 / 캠페인 진입 시 7일 누적 + firstTouch 후보 confirmed 누적 후 재증액 후보. 그 전까지 소액 측정 / 학습 수준 유지 | 2 (TikTok 진행 + Meta sprint 18 패턴) | 0.87 | Codex | * |
| `tiktok-lesson-008` | candidate_rule | Events API 후보의 TikTok evidence는 주문별로 연결된 row만 인정한다 | production canary 후보 `202605036519253`은 기존 shadow review에서 `ttclid=Y`로 보였지만, 사후 VM API 주문별 재검산에서는 `ttclid=false`, TikTok UTM 없음, `firstTouch.tiktokMatchReasons=[]`, initial referrer `m.search.naver.com`이었다. 원인은 후보 생성 로직이 전체 `marketing_intent`를 훑어 다른 방문자의 TikTok evidence를 섞은 것 | tiktok/tiktok_events_api_production_canary_result_20260504.md §2026-05-04 추가 원인 분석 | `marketing_intent`/`checkout_started` evidence는 order_code/order_no/payment_code/orderId/metadata로 주문에 연결될 때만 인정한다. 연결되지 않은 TikTok click row는 Events API send 후보 근거로 쓰지 않는다. 기존 shadow 후보는 패치된 로직으로 재생성 전까지 승인 근거로 쓰지 않음 | 1 | 0.94 | Codex | tiktok_events_api |

## 승격 기준 (정본 §10)

| 단계 | 기준 |
|---|---|
| `observation` | 1회 관찰, source/window/evidence 있음 |
| `candidate_rule` | 같은 문제를 다음 작업에 적용 가능 |
| `approved_rule` | 반복 확인 + audit 통과, RULES.md 반영 |
| `deprecated_rule` | 더 이상 안 쓰는 규칙 — 이유 + 대체 규칙 기록 |

## 후속 sprint

- 신규 사례 누적 시 본 LESSONS 갱신 (sprint 시작 시 정본 read 후)
- 본 site 의 RULES.md / VERIFY.md / AUDITOR_CHECKLIST.md 신규 (별도 sprint, harness/coffee-data/ 패턴 fork — 단 common 정본 fork 금지)
- cross-cutting 후보 → [[harness/cross-site-lessons/INDEX]] §3 의 표 추가 등록
