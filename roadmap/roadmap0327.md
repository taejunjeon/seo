# Revenue CRM/실험 로드맵

기준일: 2026-03-27 (최종 업데이트: 2026-04-11 #31 — W7 제거 검증 + ROAS 정합성 phase 문서 연결 + 더클린커피 ROAS 비교 blocker 정리)

> 이 문서는 **Phase별 요약**만 담는다. 각 Phase의 상세 내역은 개별 문서를 참조.
>
> 원본 전체 로드맵: `roadmap0327_full_backup_0403.md` (2,480줄)
>
> Meta ROAS / Attribution ROAS 정합성 판단은 [data/roasphase.md](/Users/vibetj/coding/seo/data/roasphase.md)를 현재 source로 본다. 앞으로 Meta ROAS headline은 `1d_click` 기준으로 읽고, Meta default는 Ads Manager parity 참고값으로만 둔다. 리인벤팅 W7 제거 검증은 [data/redelete.md](/Users/vibetj/coding/seo/data/redelete.md)를 source로 본다.

---

## 전체 Phase 진행 현황

| Phase | 제목 | 완료 | 상세 문서 | 핵심 산출물 |
|-------|------|------|----------|-----------|
| **P0** | 구조 고정 · 데이터 계약 | **100%** | [phase0.md](phase0.md) | customer_key, 이벤트 명세, ontology |
| **P1** | CRM 실험 원장 MVP | **100%/90%** | [phase1.md](phase1.md) | 실험 장부, status-aware attribution ledger, live row + UTM |
| **P1.5** | AIBIO 광고 최적화 | **90%/진행중** | [../aibio/aibio.md](../aibio/aibio.md) | GTM 정리, Meta/Google/당근 광고 계획, 50명 유입 목표 |
| **P2** | 상담 원장 · 상담사 가치 | **100%** | [phase2.md](phase2.md) | callprice API 10개, /callprice 대시보드 |
| **P2.5** | 프리-구매 리드 마그넷 | **10%** | [phase2_5.md](phase2_5.md) | 진단형 퀴즈 설계 |
| **P3** | 실행 채널 연동 | **85%** | [phase3.md](phase3.md) | S1~S3 완료, S4 발송 UI 75%, **S5 커피 재구매 관리 80%**, **S6 SMS 발송 70%**. 아임웹 캠페인 분석 완료 → SMS fallback 기회 확인 |
| **P4** | 재구매 코호트 · 북극성 | **95%** | [phase4.md](phase4.md) | 90일 재구매 순매출 ₩45M, /cohort 대시보드 |
| **P5** | Meta 광고 데이터 연동 | **100%** | [phase5.md](phase5.md) | ✅ S1 백엔드 + S2 대시보드 + **S3 CAPI 운영 전환 완료 (0405)**. 125건 실전 전송 성공 |
| **★ P5.5** | **ROAS/iROAS 모니터링 대시보드** | **100% + 정합성 검증 진행** | [phase5_5.md](phase5_5.md) | ✅ S1 ROAS 백엔드 + S2 대시보드 + **S3 iROAS 엔진** 완료. 운영 판단은 [roasphase.md](/Users/vibetj/coding/seo/data/roasphase.md)의 Meta/Attribution 정합성 체크 기준을 따른다 |
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
├── ✅ 최우선 운영 기준 고정: `WAITING_FOR_DEPOSIT` 등 가상계좌 미입금 주문은 `pending`으로만 남기고 `confirmedRevenue`/메인 ROAS에서는 제외
├── ✅ CAPI 자동화 완료 (30분 주기 서버 내장 sync)
├── ✅ status-aware attribution ledger 완료 (SQLite + `payment_status` + Toss sync route)
├── ✅ biocom fetch-fix caller live 검증 (`orderId 202604081311774`, `snippetVersion 2026-04-08-fetchfix`, `ga_session_id 1775652461`)
├── ✅ biocom Imweb local sync 실실행 (`imweb_orders` latest 5,750건)
├── ✅ Toss settlement backfill 실실행 (latest local `toss_settlements` 20,388건)
├── ✅ biocom reconcile age bucket 분해 (`0-1일 45.77% / 31일+ 76.71%`)
├── ✅ `/api/toss/sync` completion signal 추가 (`runId / pagesRead / rowsAdded / done`)
├── ✅ `/ads` 메인 ROAS를 attribution 기준으로 정렬 (`/ads/roas`와 primary source 통일)
├── ✅ public backend 최신 dedupe 정책 배포 (`caller-coverage` public `200`, AIBIO 10분 이내 재제출 적재 확인)
├── ✅ AIBIO form-submit v5 live 검증 (`2026-04-08 23:22:56 / 23:23:26 KST` 연속 제출 모두 `201`)
├── ✅ thecleancoffee payment_success fetch-fix v2 live 검증 (`orderId 202604080749309`, `snippetVersion 2026-04-08-coffee-fetchfix-v2`, all-three `1건`)
├── ✅ biocom 리인벤팅 W7 제거 검증 완료 (`GTM-W7VXS4D8` 호출과 `Cannot read properties of null (reading 'includes')` 오류 사라짐)
├── GA4 `(not set)` 원인 좁히기: BigQuery raw export + hourly compare + caller coverage 일일 루틴 고정
├── P3 마감: 첫 operational live (세그먼트 선택 → 알림톡/SMS 발송 → 전환 추적)
├── 더클린커피 ROAS 비교 준비: coffee Meta token 재발급 + Imweb/Toss local sync 최신화 + pending status sync 후 coffee KPI 재산출
├── 일일 데이터 정합성 체크 루틴 고정 (`ledger` / `sync-status` / `toss-join` / `crm-phase1` / `roasphase`)
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

## 0406 데이터 정합성 체크 반영

`data/datacheck0406.md`와 `gptfeedback_0406_2reply.md` 기준으로, P1 운영 판단 숫자는 이제 아래 순서로 읽는다.

1. `GET /api/attribution/ledger`
   - source-of-truth for `payment_status`, `confirmedRevenue`, `pendingRevenue`, `canceledRevenue`
2. `POST /api/attribution/sync-status/toss?dryRun=true`
   - pending row가 Toss 상태와 실제로 닫히는지 preview 확인
3. `GET /api/attribution/toss-join`
   - paymentKey/orderId 기준 조인율 확인
4. `GET /api/crm-phase1/ops`
   - CRM 화면용 요약, GA4 `(not set)` 비교, next action 확인

현재 0406 로컬 기준 핵심 수치:

- attribution ledger `344건`
- `payment_success 342건`
- capture mode: `live 335 / replay 5 / smoke 4`
- payment status: `pending 276 / confirmed 65 / canceled 1`
- status별 금액: `confirmed ₩13,465,104 / pending ₩584,216,825 / canceled ₩78,088`

이 루틴은 `P1 숫자를 믿어도 되는가`를 매일 확인하는 최소 check로 본다.

## 0411 ROAS 정합성 체크 반영

[data/roasphase.md](/Users/vibetj/coding/seo/data/roasphase.md) 기준으로, 이제 Meta ROAS headline은 `1d_click`로 읽는다. Meta default는 Ads Manager parity 참고값이고, 운영 판단은 `Attribution confirmed`, `confirmed+pending`, `Meta 1d_click`, `Meta attribution window별 ROAS`, `site-wide ceiling`, `CAPI/Pixel 중복 위험`을 같이 읽는다.

현재 biocom 최근 7일(2026-04-04 - 2026-04-10) 운영 판단값:

- Attribution confirmed ROAS: `1.05x`
- Attribution confirmed+pending ROAS: `1.07x`
- Meta `1d_click` purchase ROAS: `3.11x`
- Meta default purchase ROAS: `4.80x` (보조 참고값)
- Meta purchases `525건`이 내부 site confirmed orders `381건`보다 많아, window 차이뿐 아니라 Purchase 이벤트 중복/정의 차이를 주문 단위로 확인해야 한다

더클린커피는 아직 같은 품질로 비교하면 안 된다.

- coffee Meta token은 설정되어 있지만 Meta가 만료 토큰으로 거절한다
- `thecleancoffee_imweb` live `payment_success` 81건이 전부 `pending`이고 confirmed가 0건이다
- coffee Imweb local cache 최신 주문은 2026-04-04 10:38 KST, Toss coffee local transaction 최신은 2026-02-23 16:21 KST라 최신 ROAS 비교력이 낮다
- 따라서 순서는 `coffee Meta token 재발급 -> coffee Imweb/Toss sync 최신화 -> pending status sync -> biocom과 같은 window별 ROAS 비교`가 맞다

## 0408 운영 검증 반영

`data/datacheck0406.md`와 `gptfeedback_0408_1reply.md` 기준으로, 이번 턴에는 "문서상 계획"이 아니라 실제 실행 결과를 아래처럼 확보했다.

1. `GET /api/attribution/caller-coverage`
   - baseline은 `payment_success 452건`, `ga_session_id / client_id / user_pseudo_id` all-three `0%`에서 시작했다
   - 현재 local/public 최신 기준 `payment_success 560건`, all-three coverage `8건 (1.43%)`, biocom 단독 기준 `491건 중 7건 (1.43%)`, thecleancoffee 단독 기준 `62건 중 1건 (1.61%)`까지 올라왔다
   - public `https://att.ainativeos.net/api/attribution/caller-coverage`도 이제 `200`으로 열려 있고, 최신 backend dedupe 정책이 실제 운영 프로세스에 반영됐다
2. `POST /api/crm-local/imweb/sync-orders` (`site=biocom`)
   - latest local `imweb_orders 5,750건`, `firstOrderAt 2026-01-27`, `lastOrderAt 2026-04-07`
   - biocom도 이제 coffee처럼 `Imweb ↔ Toss` reconcile 숫자를 바로 볼 수 있고, age bucket으로 최근 지연과 오래된 누락을 분리해서 읽을 수 있다
3. `POST /api/toss/sync?store=biocom&mode=backfill`
   - latest local `toss_settlements 20,388건`, `totalPayout ₩4,720,106,642`
   - 정산 원장은 크게 확장됐고, `/api/toss/sync` 응답에는 `runId / startedAt / finishedAt / pagesRead / rowsAdded / done` completion signal이 추가됐다. 다만 장거리 backfill의 완료 응답/최종 coverage 산출은 아직 별도 점검이 필요하다
4. `GA4 property access`
   - `304759974 (biocom)`, `326949178 (coffee)`, `326993019 (aibio)` 3개 property Data API access를 모두 확인
   - coffee viewer 추가는 실제 조회 가능 상태로 검증됐다
5. `live footer / console check`
   - `biocom.kr`는 fetch-fix caller가 실제 homepage HTML에 반영됐고, latest live `payment_success 491건`, `ga_session_id 11건`, `client_id/user_pseudo_id 7건`, all-three `7건`까지 확인됐다
   - `thecleancoffee.com`는 `snippetVersion=2026-04-08-coffee-fetchfix-v2` 기준 실제 가상계좌 주문 `202604080749309`가 `2026-04-08 23:53:44 KST`에 `pending`으로 적재됐고, `ga_session_id / client_id / user_pseudo_id` 3종이 모두 들어온 첫 live row를 확인했다
   - `aibio.ai`는 쇼핑몰 purchase가 아니라 `form_submit`을 표준 원장으로 보고, `snippetVersion=2026-04-08-formfetchfix-v5` 기준 live `6건`, `2026-04-08 23:22:56 / 23:23:26 KST` 30초 간격 재제출 모두 `201` 저장을 확인했다
   - 같은 payment_complete 페이지에서 `gtm.js?id=GTM-W7VXS4D8 ... includes` 오류가 관찰됐고, public 컨테이너 파싱 기준 culprit은 리인벤팅 W7 `tag_id 44` `Custom HTML`의 `c.includes("RETOUS_")`로 좁혀졌다
   - 2026-04-11 기준 리인벤팅 CRM 협업 종료에 따라 W7 코드는 제거됐고, live HTML/Headless Chrome 검증에서 `GTM-W7VXS4D8` 호출과 기존 `Cannot read properties of null (reading 'includes')` 오류가 사라졌다
6. `payment_status / GA4 (not set) 운영 해석`
   - attribution ledger는 이미 `pending / confirmed / canceled`를 분리해서 읽을 수 있고, `WAITING_FOR_DEPOSIT` 같은 가상계좌 미입금 주문은 `pending`으로 남는다
   - 다만 최신 주문은 바로 `confirmed`가 되지 않는다. 예를 들어 coffee `202604080749309`는 현재 `pending`이고, `POST /api/attribution/sync-status/toss?dryRun=true&limit=5` 시점에는 아직 `unmatched`였다
   - 따라서 `GA4 (not set)` 문제도 이제 "결제완료 caller가 전혀 식별자를 못 보낸다" 단계는 지났다. 실마리는 보였고, 다음은 `BigQuery raw export + hourly compare + caller coverage + 새 푸터 이후 live row`로 historical row와 최신 계측 품질을 분리해 읽는 것이다

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
| 계정 | 현재 상태 | 비고 |
|------|---------|------|
| AIBIO 리커버리랩 | Meta API 조회 가능 | 기존 30일 실측 노출/클릭/비용은 별도 AIBIO 문서 기준으로 본다 |
| 바이오컴 | 최근 7일 spend/ROAS 조회 가능 | 상세 수치는 [roasphase.md](/Users/vibetj/coding/seo/data/roasphase.md) 기준 |
| 더클린커피 | Meta API 비교 보류 | coffee token 만료 + confirmed 0건 + local order/PG cache stale 복구 후 비교 |

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
| Meta Marketing API | ⚠️ 사이트별 상태 분리 필요 | biocom은 조회 가능, 더클린커피 coffee token은 2026-04-11 기준 만료 오류로 재발급 필요 |
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
| 결제/폼 추적 | ✅ fetch-fix live + Toss 검증 | ✅ payment_success fetch-fix v2 live + all-three 첫 row 확인 | ✅ form_submit v5 live + 10분 이내 재제출 적재 |
| 회원 sync | ✅ 69,681명 | ✅ 13,236명 | ✅ 100명 |
| SMS 동의 | 47.5% | (사이트별 미분리) | |
| Meta 광고 | ✅ 조회 가능, ROAS 정합성 검증 중 | ⚠️ token 만료 + confirmed 0건으로 비교 보류 | ✅ 조회 가능, 별도 AIBIO 문서 기준 |
| Cloudflare | ✅ att.ainativeos.net (공유) |

---

## 참고 문서

- 원본 전체 로드맵: `roadmap0327_full_backup_0403.md`
- API 연동 현황: `api.md`
- 알리고 템플릿 관리: `aligo.md`, `crm/crmreport.md`
- 커피 원가 분석: `coffee/gptprocoffee.md`
- 아임웹 회원 consent: `imweb/memberagree.md`
