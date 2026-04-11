# Phase 5.5 (NEW) — ROAS/iROAS 분석 모니터링 대시보드

> **최종 업데이트**: 2026-04-11 (`roasphase.md` source-of-truth 연결 + W7 제거 반영 + 더클린커피 ROAS 비교 blocker 정리)
> **담당**: Codex (백엔드/설계) + Claude Code (프론트/UXUI)
>
> Meta ROAS / Attribution ROAS 정합성 판단은 [data/roasphase.md](/Users/vibetj/coding/seo/data/roasphase.md)를 현재 source로 본다. 앞으로 Meta ROAS headline은 `1d_click` 기준으로 읽고, Meta default는 Ads Manager parity 참고값으로만 둔다.

## 왜 필요한가

Meta 광고비를 쓰고 있지만, 캠페인별 실질 ROAS와 증분 ROAS(iROAS)를 한눈에 볼 수 있는 대시보드가 없다. Phase 5에서 Meta API를 연동하고, Phase 7에서 증분 실험을 실행한 결과를 합쳐 **광고비 대비 실제 순이익**을 실시간으로 추적하는 전용 대시보드가 필요하다.

### 사용자 베네핏

- **대표(TJ)**: 3사이트(바이오컴/더클린커피/AIBIO)의 채널별(Meta/Google/당근) ROAS를 한 화면에서 비교하고, 예산 배분 의사결정을 데이터 기반으로 내림
- **마케터**: 캠페인/광고세트 단위로 노출/클릭/비용/CPC/CPM을 실시간 확인하고, 소재 교체/예산 조정 타이밍을 즉시 판단
- **운영팀**: CRM 실험(P7)의 증분 매출과 광고비를 연결하여, "이 광고비가 실제로 추가 매출을 만들었는가"에 인과적 근거를 갖고 답변
- **전략팀**: 채널별 iROAS 추이를 보고 채널 믹스 최적화 전략을 수립

---

## 현재 상태 및 선행 조건

### Meta API 연동 현황 (0404 업데이트)
- Meta 장기토큰 확보 완료 (60일, ~06/02)
- 광고 계정 7개 확인
- **✅ P5-S1 백엔드 6개 엔드포인트 가동 중** (`routes/meta.ts`): status, accounts, campaigns, insights, insights/daily, overview
- **✅ P5-S2 `/ads` 대시보드 가동 중**: 3사이트 개요 카드, 일별 비용/클릭 차트, 전환 퍼널, 캠페인별 성과 테이블
- **✅ 0408 정렬 완료**: `/ads`의 메인 ROAS는 이제 `/ads/roas`와 같은 attribution/site-summary 기준을 primary로 쓴다. Meta purchase ROAS는 reference only이며, 2026-04-11부터 기본 표시 window는 `1d_click`이다.
- **최우선 운영 기준 중 하나**: `WAITING_FOR_DEPOSIT` 같은 가상계좌 미입금 주문은 `pending`으로만 남기고, `confirmed` 기준 ROAS와 메인 매출에서는 제외한다. 그렇지 않으면 광고 효율이 즉시 과대평가된다.
- AIBIO 실측: 30일간 노출 480,492 / 클릭 18,015 / 비용 ₩1,513,916 / CPC ₩84
- P5.5는 이 기반 위에 **ROAS 계산 로직 + 채널 비교 + iROAS**를 추가하는 단계

### 선행 Phase 의존성
- **P5 (Meta 광고 데이터 연동)**: ✅ P5-S1 백엔드 완료, P5-S2 `/ads` 대시보드 완료. `routes/meta.ts`에 accounts/campaigns/insights/insights-daily/overview 6개 엔드포인트 이미 가동 중. P5.5는 이 기반 위에 ROAS 계산 + 채널 비교 + iROAS를 추가하는 것임.
- **P7 (1차 증분 실험 라이브)**: iROAS 계산에 필요한 control/treatment 실험 결과가 있어야 함
- **P1-S1A (결제 귀속)**: 광고 클릭 → 구매 전환 연결이 되어야 채널별 매출 귀속이 가능. `biocom.kr` fetch-fix, 새 푸터 `checkout_started`, `thecleancoffee.com` fetch-fix v2, `aibio.ai` form-submit v5 live 검증까지 끝났다. `GTM-W7VXS4D8` payment page 오류는 2026-04-11 제거 검증 완료 상태이며, 남은 건 `GA4 (not set)` historical row 진단, CAPI/Pixel 주문 단위 dedup 확인, 더클린커피 token/sync 복구다.

### 0408 계측 품질 메모

- `biocom.kr` 실제 주문 `202604081311774`가 `pending`으로 적재되며 `snippetVersion=2026-04-08-fetchfix`, `ga_session_id=1775652461`까지 확인됐다.
- `thecleancoffee.com`도 `snippetVersion=2026-04-08-coffee-fetchfix-v2` 기준 실제 주문 `202604080749309`에서 `ga_session_id / client_id / user_pseudo_id` 3종이 모두 들어온 첫 live row가 확인됐다.
- `aibio.ai`는 `payment_success`가 아니라 `form_submit`이 표준 전환이며, `snippetVersion=2026-04-08-formfetchfix-v5` 기준 10분 이내 재제출도 별도 적재된다.
- recent live row 기준 `client_id / user_pseudo_id`는 이미 ledger metadata에 보존된다. 이제 남은 핵심은 historical row와 biocom payment page 오류 구간을 분리해 `GA4 (not set)`을 줄여 읽는 운영 루틴이다.
- 2026-04-11 기준 리인벤팅 CRM 협업 종료에 따라 `GTM-W7VXS4D8`는 제거됐고, live HTML/Headless Chrome 검증에서 기존 `Cannot read properties of null (reading 'includes')` 오류가 사라졌다. 상세 검증은 [data/redelete.md](/Users/vibetj/coding/seo/data/redelete.md)를 본다.

### 0411 ROAS 정합성 운영 메모

- biocom 최근 7일(2026-04-04 - 2026-04-10)은 Attribution confirmed ROAS `1.05x`, confirmed+pending ROAS `1.07x`, Meta `1d_click` ROAS `3.11x`, Meta default purchase ROAS `4.80x`다.
- Meta purchases `525건`이 내부 site confirmed orders `381건`보다 많다. 따라서 단순 window 차이뿐 아니라 주문 단위 Purchase 중복, Pixel/CAPI `event_id` 공유 여부, 같은 채널 내 중복 전송을 확인해야 한다.
- 더클린커피는 아직 biocom처럼 비교하면 안 된다. coffee Meta token은 만료 오류로 조회 실패하고, `thecleancoffee_imweb` live `payment_success` 81건은 전부 `pending`이며 confirmed가 0건이다.
- 더클린커피 비교 순서는 `coffee Meta token 재발급 -> Imweb orders 최신 sync -> Toss/local PG sync 또는 direct fallback -> pending status sync -> window별 ROAS 표 고정`이다.

---

## 스프린트별 완성도

| Sprint  | 목표                           | 담당                     | 완료       | 선행                                                                     |
| ------- | ---------------------------- | ---------------------- | -------- | ---------------------------------------------------------------------- |
| P5.5-S1 | Meta 광고 성과 API + ROAS 집계 백엔드 | Codex (백엔드/설계)         | **100%** | ✅ `routes/ads.ts` 구현 완료 (0404). 4개 엔드포인트 가동 중. Meta ROAS 2.44x 실데이터 확인 |
| P5.5-S2 | ROAS 대시보드 프론트                | Claude Code (프론트/UXUI) | **100%** | ✅ `/ads/roas` 페이지 구현 완료 (0404). 채널비교 + 사이트별 ROAS + 일별 추이 + 파이차트        |
| P5.5-S3 | iROAS 계산 엔진 (P7 연동)          | Codex (백엔드) + Claude Code (프론트) | **100%** | ✅ 백엔드 4 API + 프론트 iROAS 섹션 완료 (0404). 증분 매출 ₩9.1M 실데이터. 광고비 연결은 P7 실험 시 |

---

## 상세 내용

### P5.5-S1: Meta 광고 성과 API + 백엔드 집계

**담당**: Codex (백엔드/설계)

#### 핵심 기능

1. **Meta Ads Insights 집계 API**
   - `GET /api/ads/meta/campaigns` — 캠페인별 일자별 성과 (노출/클릭/비용/CPC/CPM/CTR)
   - `GET /api/ads/meta/adsets` — 광고세트별 성과
   - `GET /api/ads/meta/ads` — 개별 광고(소재)별 성과
   - `GET /api/ads/meta/accounts` — 광고 계정 7개 목록 및 상태

2. **3사이트별 분리 집계**
   - 바이오컴(biocom.kr) 광고 계정
   - 더클린커피(thecleancoffee.com) 광고 계정
   - AIBIO(리커버리랩) 광고 계정
   - 각 사이트별 캠페인 매핑 테이블 관리

3. **ROAS 계산 로직**
   - `ROAS = 광고 귀속 매출 / 광고비`
   - 광고 귀속 매출: UTM/fbclid 기반 주문 매칭 (P1-S1A attribution ledger 활용)
   - 일별/주별/월별 ROAS 집계
   - 캠페인/광고세트/소재 단위 ROAS 분해

4. **채널 비교 집계**
   - Meta 광고 성과 (API 연동)
   - Google Ads 성과 (P1.5 GTM + Google Ads API)
   - 당근 광고 성과 (수동 입력 — API 없음)
   - 채널별 통합 비교 API: `GET /api/ads/channel-comparison`

5. **데이터 적재 스케줄**
   - `meta_campaign_daily` 테이블에 일배치 적재 (P5-S1 구현 활용)
   - Google Ads 일별 비용/전환 적재 (별도 API 연동 또는 수동)
   - 당근 주간 수동 입력 테이블

---

### P5.5-S2: ROAS 대시보드 프론트

**담당**: Claude Code (프론트/UXUI)

#### 0408 보정 메모

- `/ads`와 `/ads/roas` 숫자가 다르게 보였던 이유는 source가 달랐기 때문이다.
  - `/ads/roas`: `GET /api/ads/site-summary` 기반 attribution confirmed revenue / ad spend
  - `/ads`: 기존에는 `GET /api/meta/overview` 기반 Meta purchase event ROAS
- 0408부터는 `/ads` 상단 메인 카드도 attribution/site-summary를 primary로 쓰고, Meta purchase ROAS는 보조 참고값으로만 노출한다.
- 0408부터는 `/ads`, `/ads/roas` 둘 다 `confirmed ledger` 기준이며, 오늘/최근 1~2일 수치는 `pending`과 PG 확정 지연 때문에 잠정치로 읽어야 한다는 경고를 같이 노출한다.
- 따라서 **운영 의사결정용 ROAS source-of-truth는 이제 `/ads`와 `/ads/roas`에서 동일**하다고 본다.

#### 화면 구성

1. **채널별 ROAS 요약 카드**
   - Meta / Google / 당근 채널별 ROAS KPI 카드
   - 기간 선택 (일/주/월)
   - 3사이트(바이오컴/더클린커피/AIBIO) 필터

2. **캠페인 성과 테이블**
   - 캠페인명 / 노출 / 클릭 / CTR / 비용 / CPC / CPM / 매출 / ROAS
   - 정렬/필터/검색 기능
   - 캠페인 클릭 시 광고세트/소재 드릴다운

3. **ROAS 추이 차트**
   - 일별/주별 ROAS 라인차트
   - 채널별 비교 오버레이
   - 비용 vs 매출 듀얼 축 차트

4. **채널 믹스 파이차트**
   - 전체 광고비 중 채널별 비중
   - 전체 광고 귀속 매출 중 채널별 비중
   - ROAS 기준 채널 효율 순위

5. **3사이트별 분리 뷰**
   - 탭 또는 필터로 사이트별 전환
   - 사이트별 캠페인 성과 테이블
   - 사이트별 ROAS 비교

---

### P5.5-S3: iROAS 계산 엔진 (P7 연동)

**담당**: Codex (백엔드/설계)

#### 핵심 개념

**iROAS(증분 ROAS)**는 단순 ROAS와 다르다.
- ROAS = 광고 귀속 매출 / 광고비 (광고를 클릭한 사람의 매출)
- iROAS = **증분** 매출 / 광고비 (광고가 **없었다면 발생하지 않았을** 매출만 계산)

#### 계산 방식

```
iROAS = (treatment_revenue - control_revenue) / ad_spend

여기서:
- treatment_revenue: 광고/CRM 메시지를 받은 그룹의 매출
- control_revenue: 아무 메시지도 받지 않은 대조군의 매출
- ad_spend: 해당 캠페인의 Meta/Google/당근 광고비
```

#### P7 실험 결과 연동

- P7-S1에서 실행된 control/treatment 실험 결과를 읽어옴
- 실험별 증분 매출(Incremental Revenue)을 광고비와 연결
- 시나리오별 iROAS 산출:
  - 체크아웃 이탈 리마인드 → iROAS
  - 미구매 재접촉 → iROAS
  - 윈백 메시지 → iROAS
  - 리커버리랩 방문 쿠폰 → 오프라인 iROAS

#### API 설계

- `GET /api/ads/iroas/experiments` — 실험별 iROAS 목록
- `GET /api/ads/iroas/experiments/:key` — 특정 실험의 iROAS 상세
- `GET /api/ads/iroas/channel-comparison` — 채널별 iROAS 비교
- `GET /api/ads/iroas/trend` — iROAS 추이 (실험 사이클별)

#### 대시보드 연동 (P5.5-S2에 추가)

- iROAS 전용 섹션: 실험별 증분 매출 vs 광고비 비교 차트
- ROAS vs iROAS 비교 카드: "광고 클릭 매출"과 "증분 매출"의 차이를 시각화
- 채널별 iROAS 순위: 어느 채널의 광고비가 실제로 가장 효율적인가

---

## 완료 기준

- [ ] Meta 캠페인별 노출/클릭/비용/CPC/CPM 데이터가 대시보드에 표시됨
- [ ] 3사이트별 분리된 ROAS가 확인 가능함
- [ ] 채널별(Meta/Google/당근) ROAS 비교가 한 화면에서 가능함
- [ ] P7 실험 결과와 연동된 iROAS가 계산되어 표시됨
- [ ] ROAS vs iROAS 차이가 시각적으로 구분됨

---

## 남은 리스크

- Google Ads API 연동이 별도로 필요 (현재 P1.5에서 GTM만 설정)
- 당근 광고는 API가 없어 수동 입력에 의존 — 데이터 지연/누락 가능
- iROAS는 P7 실험이 완료되어야 의미 있는 값이 나옴 — 그 전까지는 ROAS만 표시
- Meta 광고 계정 7개의 사이트별 매핑이 정확해야 사이트별 분리가 가능
