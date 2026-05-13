# `/total` 페이지 직관성 + 정보 전달 평가

작성 시각: 2026-05-13 19:05 KST
평가 대상: `http://localhost:7010/total` (frontend) ← `http://localhost:7020/api/total/monthly-channel-summary?month=2026-05&site=biocom` (backend)
평가 시점 데이터: 2026-05 dry-run, 내부 확정 ₩2억 380만, 채널 5개, 플랫폼 4개

> DB 표기 규칙: 모든 테이블 명은 어느 DB 인지 명시 (운영DB / VM Cloud / 로컬DB).

## 1. 사람이 이해하는 평가 요약

### 잘 된 것 (강점)
- 첫 4 KPI 카드 (decisionHero) 가 의사결정 frame 을 명확히 잡음 — **"예산 판단 가능 매출 / 참고용 보정 매출 / 미분류 매출 / 데이터 연결 경고"** 4 분할.
- 채널 표의 "운영 액션" 컬럼에 green/yellow/red 배지 — 사람이 즉시 어떤 채널을 보강할지 판단 가능.
- 플랫폼 카드마다 **"참고값" 라벨 + ROAS 값 + 합산 금지 메시지** 가 한 묶음 — 광고 ROAS 와 내부 매출 섞임 방지의 핵심 설계가 일관됨.
- TikTok local_cache 강경고 / Naver blocked 가 카드 안 빨간 배경으로 즉시 보임.
- collapsible details (주의사항 / Source freshness / sourceDiagnostics) 로 첫 화면 노이즈 줄임.
- 금액이 ₩2억 380만 / ₩4,000만 같은 **한국어 만/억 단위** 일관 사용 — 사용자 정책 (K/M 금지) 준수.

### 개선 필요 (약점 — 사용자 관점)
1. **decisionHero 4 카드 + 그 아래 ①~⑤ KPI 5 카드 = KPI 9 개가 위에 깔림.** 첫 4 카드와 ① 카드 (내부 확정) 가 사실상 같은 값 — 한 사람이 동시 보기 어려움.
2. **"예산 판단 가능 매출" 의 계산식 미노출** — `confirmed_net_revenue_ab (₩2억 380만) + budgetCorrectionAmount (현재 0)` 합. 보정값이 0 이 아닐 때 ① 카드와 다른 이유 화면에 안 보임.
3. **미분류 매출 ₩1억 2,825만 (전체의 62.9%, 632 주문) 이 가장 큰 카테고리** 인데 화면에 한 줄로 "유입 증거 부족" 만 — 운영자가 "그래서 이거 어디서 왔는데?" 답을 화면 안에서 못 찾음.
4. **A/B vs 후보 차이 섹션이 분석가 용어 (candidate/confirmed/review_revenue_c)** — 비개발자 안 읽힘. "예외 매출 ₩97만 (가상계좌 토스 매칭 못 한 1건)" 정도 한 줄이 더 직관적.
5. **"contract version v0.2 / spine v0.2 / evidence v0.4 / mode=dry_run" 메타** 가 상단과 하단 두 번 표시 — 운영자 관심사 아님. 한 번이면 충분.
6. **채널 표의 "A confidence / B confidence" 컬럼이 ₩금액** — 비중 % 가 더 직관. 또는 "강·중·약 신뢰" 같은 라벨.
7. **"primary_channel" 영어 코드 (paid_meta / paid_naver / npay / unknown)** 가 한국어 라벨 옆에 표시 — 운영자에게 영어 코드 노이즈.
8. **stale 경고 (현재 ga4_bigquery_raw + npay_intent + naver platform 등 다수)** 가 collapsible — 클릭해야 보임. 빨간 색이라 펼쳐서 노출하는 게 자연스러움.
9. **플랫폼 카드의 "gap (플랫폼 − 내부)"** 가 양수일 때 의미 — "광고 플랫폼이 자기 attribution 기준 더 주장한 매출" 인데 라벨로 자명하지 않음. **"플랫폼 over-claim"** 같은 운영 용어가 더 직관적.
10. **반응형 / 모바일** 미검증 — `kpiRow` grid 5 columns 가 좁은 화면 (< 1024px) 에서 깨질 가능성.

## 2. 화면 구조 (현재)

| # | 섹션 | 라벨 | 평가 |
|---|---|---|---|
| 1 | H1 + subtitle | "총 월별 채널 매출 ( /total )" | ✓ |
| 2 | 컨트롤 (월 선택 + 조회) + meta | site=biocom · queried · mode=dry_run · contract | meta 너무 자세함 |
| 3 | decisionHero 4 카드 | 예산 판단 / 참고용 보정 / 미분류 / 데이터 연결 경고 | ★ 강점 |
| 4 | 주의 (collapsible) | 5 bullet | OK |
| 5 | 예산 판단 보류 source (collapsible if >0) | stale 목록 | **펼친 상태가 default 권장** |
| 6 | 보정 라인 (lines.length=0 일 때 미노출) | site/source 별도 line | 데이터 없으면 OK |
| 7 | ① ~ ⑤ KPI 5 카드 | 내부 확정 / 분류 완료 / 미분류 / 채널 수 / Source 경고 | **decisionHero 와 일부 중복** |
| 8 | A/B vs 후보 차이 | 분석가 용어 | 비개발자 이해 어려움 |
| 9 | 채널별 내부 확정 매출 표 | 8 컬럼 (채널/주문/매출/비중/액션/A conf/B conf/참고) | 강점 — A/B conf 컬럼 개선 후보 |
| 10 | 플랫폼 참고값 카드 4 개 | Meta / TikTok / Google / Naver | 강점 — gap 라벨 개선 후보 |
| 11 | 미분류 사유 drilldown (있을 때) | reason/주문/매출 | 데이터 있어야 의미 |
| 12 | Source freshness (collapsible) | source/role/status/freshness/queried | OK |
| 13 | sourceDiagnostics (collapsible) | scope/source/freshness/window | OK |
| 14 | headline / API 메타 | contract/window/primary_sum_matches_revenue | 비개발자 안 읽음 |

## 3. 사용자 관점 정보 전달 평가 (10 점 기준)

| 지표 | 점수 | 근거 |
|---|---:|---|
| 첫 시야 (above the fold) 의사결정 핵심 | **8/10** | decisionHero 가 강력. 단 ① 카드 중복으로 시선 분산. |
| 한국어 금액 단위 일관성 | **10/10** | 모두 만/억. fmtKRW 정상. |
| 광고 플랫폼 vs 내부 매출 분리 | **9/10** | "참고값" 명시 + gap 라벨 + 합산 금지 메시지. 모범 사례. |
| 미분류 매출 처리 | **5/10** | 62.9% 가 미분류인데 화면 안 drilldown 약함. drilldown 데이터 자체 부재. |
| stale / 경고 가시성 | **6/10** | collapsible 이라 클릭해야 보임. 빨간 카운트 KPI 는 있음. |
| 비개발자 친화성 | **5/10** | "candidate including_c / quarantine_revenue_d / contract_version" 같은 분석가 용어 그대로 노출. |
| 정보 밀도 / 노이즈 비율 | **6/10** | KPI 9 개 + 메타 2 곳 중복. 첫 화면 압축 여지. |
| 반응형 / 모바일 | **미검증** | grid 5 columns 모바일 깨짐 의심. |
| 종합 | **7/10** | 의사결정 frame 은 강하나 "보완 차원" (미분류 / 모바일 / 비개발자 라벨) 약함. |

## 4. 우선순위 개선 후보

| # | Action | 효과 | LOC | Claude Code 가능 | 추천 점수 |
|---|---|---|---:|---|---:|
| 1 | ①~⑤ KPI 카드 중 decisionHero 와 중복되는 ① 카드 제거 / 또는 decisionHero 흡수 | 첫 시야 노이즈 -20% | ~10 | YES | **85** |
| 2 | 미분류 ₩1.28억 그 자리에 **drilldown 표 자동 노출** (channel_summary 의 unknown row 또는 unknown_reasons) | 미분류 정보 가치 +50% | ~25 | YES | **82** |
| 3 | stale 경고 collapsible 의 default open (stale > 0 일 때) | 운영자 즉시 인지 | ~5 | YES | **80** |
| 4 | "primary_channel" 영어 코드 비중 줄이기 (작은 회색 → 툴팁만) | 비개발자 노이즈 -10% | ~5 | YES | **70** |
| 5 | A/B vs 후보 차이 섹션을 "예외 처리된 매출 ₩97만 (가상계좌 1건)" 한 줄 + 펼치기로 압축 | 분석가 용어 노출 -50% | ~30 | YES | **68** |
| 6 | 플랫폼 카드 "gap" 을 "플랫폼 over-claim" 으로 라벨 변경 + 색상 차분 | 광고 ROAS 오해 방지 | ~5 | YES | **65** |
| 7 | "A confidence / B confidence" 컬럼을 ₩금액 대신 비중 % 또는 "강/중/약" 라벨로 | 채널 표 가독성 +15% | ~15 | YES | **62** |
| 8 | contract version / mode 메타를 footer 한 줄로 압축 | 상단 노이즈 -10% | ~5 | YES | **55** |
| 9 | 모바일 반응형 검증 + grid breakpoint 추가 | 모바일 사용성 +20% | ~30 | YES | **52** |
| 10 | "조회" 버튼 색상 강조 + 월 선택 자동 조회 | 컨트롤 직관성 +10% | ~5 | YES | **45** |

## 5. 다음 액션

| Owner | Action | Claude Code 직접 가능 | 못 하면 이유 | 데이터 충분도 | 타이밍 점수 | 목표 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 개선 #1+#2+#3 묶음 (decisionHero 정리 + 미분류 drilldown 노출 + stale default open) | YES — frontend 60~80 LOC | — | 90 | 90 | 85 | 10 | **84** | 진행 |
| Claude Code | 개선 #4+#5+#6+#7+#8 묶음 (라벨 정리 + A/B 압축 + over-claim + confidence 라벨) | YES — frontend 50 LOC | — | 80 | 80 | 70 | 10 | **72** | 진행 (#1 후) |
| Claude Code | 개선 #9 모바일 반응형 검증 + breakpoint | YES — CSS 추가 | — | 70 | 60 | 50 | 10 | **57** | 보류 (필요 시) |
| TJ님 | 본 평가 결과 검토 + 우선순위 확정 | NO — Claude Code 도 분석은 가능하지만 의사결정 권한 TJ | 어떤 카드/라벨/색상 강화할지 사용자 의사 | 70 | 90 | 80 | 5 | **75** | 검토 후 진행 |

본 평가 자체는 read-only. 코드 변경 / commit 0.
