# Revenue CRM/실험 로드맵

기준일: 2026-03-27 (최종 업데이트: 2026-04-06 #24 — Toss biocom/coffee multi-store 키 반영, coffee orderId 크로스 검증 + local backfill 5,043건 완료, P5.5 전체 완료 유지)

> 이 문서는 **Phase별 요약**만 담는다. 각 Phase의 상세 내역은 개별 문서를 참조.
>
> 원본 전체 로드맵: `roadmap0327_full_backup_0403.md` (2,480줄)

---

## 전체 Phase 진행 현황

| Phase | 제목 | 완료 | 상세 문서 | 핵심 산출물 |
|-------|------|------|----------|-----------|
| **P0** | 구조 고정 · 데이터 계약 | **100%** | [phase0.md](phase0.md) | customer_key, 이벤트 명세, ontology |
| **P1** | CRM 실험 원장 MVP | **100%/85%** | [phase1.md](phase1.md) | 실험 장부, PG attribution, live row + UTM |
| **P1.5** | AIBIO 광고 최적화 | **90%/진행중** | [../aibio/aibio.md](../aibio/aibio.md) | GTM 정리, Meta/Google/당근 광고 계획, 50명 유입 목표 |
| **P2** | 상담 원장 · 상담사 가치 | **100%** | [phase2.md](phase2.md) | callprice API 10개, /callprice 대시보드 |
| **P2.5** | 프리-구매 리드 마그넷 | **10%** | [phase2_5.md](phase2_5.md) | 진단형 퀴즈 설계 |
| **P3** | 실행 채널 연동 | **85%** | [phase3.md](phase3.md) | S1~S3 완료, S4 발송 UI 75%, **S5 커피 재구매 관리 80%**, **S6 SMS 발송 70%**. 아임웹 캠페인 분석 완료 → SMS fallback 기회 확인 |
| **P4** | 재구매 코호트 · 북극성 | **95%** | [phase4.md](phase4.md) | 90일 재구매 순매출 ₩45M, /cohort 대시보드 |
| **P5** | Meta 광고 데이터 연동 | **100%** | [phase5.md](phase5.md) | ✅ S1 백엔드 + S2 대시보드 + **S3 CAPI 운영 전환 완료 (0405)**. 125건 실전 전송 성공 |
| **★ P5.5** | **ROAS/iROAS 모니터링 대시보드** | **100%** | [phase5_5.md](phase5_5.md) | ✅ S1 ROAS 백엔드 + S2 대시보드 + **S3 iROAS 엔진** 모두 완료. ROAS 2.85x, 증분 매출 ₩9.1M |
| **P6** | 카카오 CRM 실행 레이어 | **0%** | [phase6.md](phase6.md) | 카카오 고객파일, 발송 로그 |
| **P7** | 1차 증분 실험 라이브 | **0%** | [phase7.md](phase7.md) | iROAS 첫 산출, checkout abandon 실험 |
| **P8** | UX 정성 데이터 · 도구 판단 | **0%** | [phase8.md](phase8.md) | Hotjar/BigQuery 도입 판단 |
| **P9** | AI Agent 고도화 | **0%** | [phase9.md](phase9.md) | 제1원칙 CSO, 피드백 루프, Evolve |

---

## 우선순위 실행 순서 (0405 업데이트)

```
✅ 완료 (0404~0405)
├── P5 전체 완료: S1 백엔드 + S2 대시보드 + S3 CAPI 운영 전환 (125건)
├── P5.5 전체 완료: S1 ROAS 백엔드 + S2 /ads/roas 대시보드 + S3 iROAS 엔진
├── P3-S5 커피 재구매 관리: 후보 1,049명, 프론트 UI 가동
├── P3-S6 SMS 발송: 채널 토글 + 080 수신거부 + fallback
└── GA4 3사이트 연동 + 생일 필드 sync + 아임웹 캠페인 분석

현재 진행 중 (이번 주)
├── ✅ CAPI 자동화 완료 (30분 주기 서버 내장 sync)
├── P3 마감: 첫 operational live (세그먼트 선택 → 알림톡/SMS 발송 → 전환 추적)
├── 더클린커피 Meta 계정 권한 확보 + coffee KPI 재산출
├── CAPI 효과 검증: 04/12 전환 증가, 04/19 CPA 하락 확인
└── Meta Conversion Lift 실험 시작 (iROAS 정밀 측정)

다음 배치 (이번 달)
├── P7: 첫 증분 실험 라이브 (체크아웃 이탈 holdout 실험)
├── P4 마감: 월별 코호트 히트맵
├── P2.5: 리드 마그넷 "3분 피로 자가진단" 설계
└── 아임웹 쿠폰 API 연동 (재구매 쿠폰 발급 자동화)

중기 (다음 달)
├── P6: 카카오 CRM
├── P8: BigQuery/Hotjar 판단
└── 캠페인별 재구매율/상담연결률 산출 (UTM 커버리지 개선 후)

장기
└── P9: AI Agent 고도화 — Unify → Hypothesize → Uncover → Evolve
```

### 0404 아임웹 CRM 캠페인 분석 요약

더클린커피 아임웹 "카카오 메시지 자동화"에서 **장바구니 이탈 1시간 리마인드** 캠페인이 실행 중이다.
구매 전환율 25%는 업계 상위이나, **발송 성공률 50%가 병목**(카카오 채널 미구독).
우리 솔루션의 SMS fallback으로 실패분을 복구하면 매출 ~2배 가능.
상세: [phase3.md > 더클린커피 아임웹 CRM 캠페인 현황 분석](phase3.md)

---

## ★ Phase 5.5 — ROAS/iROAS 모니터링 대시보드 (신규)

> **왜 상위 우선순위인가**: Meta API 장기토큰(60일)이 확보되었고, AIBIO는 이미 월 ₩148만 집행 중인데 전환율이 0.006%다. 광고비가 매일 나가고 있으므로, ROAS를 보지 않으면 돈을 태우고 있는지 투자하고 있는지 알 수 없다.

| Sprint | 목표 | 담당 | 완료 | 선행 |
|--------|------|------|------|------|
| P5.5-S1 | Meta 광고 성과 API 백엔드 (`routes/ads.ts`) | Codex | **100%** | ✅ ROAS/채널비교/사이트요약 4개 API |
| P5.5-S2 | ROAS 모니터링 대시보드 프론트 (`/ads/roas`) | Claude Code | **100%** | ✅ 채널비교+사이트ROAS+일별추이+파이차트 |
| P5.5-S3 | iROAS 계산 엔진 + 프론트 | Codex + Claude Code | **100%** | ✅ 4 API + 프론트 iROAS 섹션. 증분 매출 ₩9.1M |

**P5.5-S1 스펙:**
- `GET /api/meta/accounts` — 광고 계정 목록 (7개)
- `GET /api/meta/campaigns?account_id=...` — 캠페인 목록
- `GET /api/meta/insights?account_id=...&date_preset=last_30d` — 성과 데이터 (노출/클릭/비용/CPC/CPM/전환)
- `GET /api/meta/insights/daily?account_id=...` — 일별 추이

**P5.5-S2 대시보드 스펙:**
- 사이트별 탭 (바이오컴 / 더클린커피 / AIBIO)
- 캠페인별 KPI 카드 (노출, 클릭, 비용, CPC, CPM, ROAS)
- 일별 비용/클릭 추이 차트
- 전환 퍼널 (노출 → 클릭 → 랜딩뷰 → 전환)
- **ROAS = 매출 / 광고비** (Toss 매출 + attribution 데이터 조인)

**P5.5-S3 iROAS 스펙 (P7 이후):**
- iROAS = (treatment 매출 - control 매출) / 광고비
- Meta 광고로 유입된 고객 → attribution 원장에서 추적 → 증분 매출 계산
- 채널별 비교: Meta vs Google vs 당근 vs 자연유입

**현재 확보된 데이터:**
| 계정 | 30일 노출 | 30일 클릭 | 30일 비용 | CPC |
|------|---------|---------|---------|-----|
| AIBIO 리커버리랩 | 469,873 | 17,575 | ₩1,482,522 | ₩84 |
| 바이오컴 | - | - | - | 최근 미집행 |
| 더클린커피 | - | - | - | 캠페인 없음 |

---

## 지표 체계

| 구분 | 지표 | 현재 상태 |
|------|------|-----------|
| 회사 북극성 | 90일 재구매 순이익 | 임시: 환불 반영 순매출 ₩45M |
| 팀 OMTM | Incremental Gross Profit | callprice 1차 근사치 |
| **실행 지표 1** | **iROAS (증분 광고수익률)** | **P5.5 + P7에서 구현 예정** |
| 실행 지표 2 | unsubscribe/complaint rate | 채널톡/알리고에서 추출 |
| 실행 지표 3 | identity match rate | 41.7% (callprice 기준) |
| 진단 지표 | 재구매 코호트 M+1/2/3 | /cohort 대시보드 가동 중 |

---

## Growth OS 프레임워크

```
STEP 01 — Unify (데이터 통합)         → Phase 0~2 ✅
STEP 02 — Hypothesize (가설 수립)     → Phase 9 (AI Agent)
STEP 03 — Uncover (실행 및 증분 검증)  → Phase 7 + P5.5
STEP 04 — Evolve (AI 피드백 루프 진화) → Phase 9

= 선형적 성장이 아닌, 기하급수적 성장을 위한 AI 네이티브 조직의 OS
```

---

## API/인프라 현황

| 서비스 | 상태 | 비고 |
|--------|------|------|
| Toss Payments | ✅ 연동 완료 | 바이오컴 + 더클린커피 MID 분기, 거래/정산/결제 상세 |
| Meta Marketing API | ✅ 장기토큰 (60일, ~06/02) | 7개 광고 계정, insights 조회 가능 |
| 아임웹 API | ✅ 3사이트 연동 | 회원 83,017명 consent 동기화 |
| 알리고 | ✅ 알림톡 + SMS | live 발송 확인, 템플릿 생성/검수 API |
| ChannelTalk | ✅ Webhook 수신 중 | 101건 수신, 실시간 이벤트 적재 |
| Cloudflare Tunnel | ✅ 고정 URL | att.ainativeos.net |
| GA4 | ✅ 연동 | 3사이트 측정 ID 확인 |
| Google Ads | ✅ AIBIO 계정 | AW-10976547519 |
| 카카오 | ✅ REST/Admin 키 | 채널 친구 API는 제한적 |
| 당근 | ❌ API 없음 | 수동 관리 |

---

## 3사이트 체계

| | 바이오컴 | 더클린커피 | AIBIO |
|---|---------|----------|-------|
| 결제 추적 | ✅ live + Toss 검증 | ✅ live + UTM | ⏸ 쇼핑몰 대기 |
| 회원 sync | ✅ 69,681명 | ✅ 13,236명 | ✅ 100명 |
| SMS 동의 | 47.5% | (사이트별 미분리) | |
| Meta 광고 | 미집행 | 캠페인 없음 | ✅ 월 ₩148만 |
| Cloudflare | ✅ att.ainativeos.net (공유) |

---

## 참고 문서

- 원본 전체 로드맵: `roadmap0327_full_backup_0403.md`
- API 연동 현황: `api.md`
- 알리고 템플릿 관리: `aligo.md`, `crm/crmreport.md`
- 커피 원가 분석: `coffee/gptprocoffee.md`
- 아임웹 회원 consent: `imweb/memberagree.md`
