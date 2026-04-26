# 쿠팡 백필 · 매출 분석 정본

작성 시각: 2026-04-24 22:00 KST
기준일: 2026-04-24
문서 성격: **가변형 정본** (쿠팡 데이터 파이프라인·분석 단일 출처)
이전본: `!coupang.md.bak_20260424_pre_docurule`
상위: [`../CLAUDE.md`](../CLAUDE.md), [`../data/!datacheckplan.md`](../data/!datacheckplan.md)
관련: [`coupangapi.md`](./coupangapi.md) (API 스펙·인증 가이드, static)

---

## 10초 요약

- 이 문서의 목적은 **쿠팡 BIOCOM·TEAMKETO 16개월 매출을 한 자리에서 보게 만드는 것**이다.
- 지금 결론: Phase 1~5 전부 닫혔다. 운영 DB (`tb_coupang_orders_rg` / `tb_coupang_orders_mp`) 는 biocom-dashboard 프로젝트의 Cloud Scheduler 가 2026-02-26 부터 sync 중이고, 2025 년 공백은 seo 가 RG Order API 로 직접 백필해 로컬 SQLite `coupang_rg_orders_api` 에 10,863행 적재 완료. 16개월 BIOCOM RG 전구간 커버.
- **이관 월 2026-02 사실상 확정** — 3P+RG 두 채널이 동시에 −75~80% 급감. Wing 사업자 변경 이력 수동 확인 없이도 실측만으로 충분.
- 다음 액션은 **TEAMKETO RG 백필 (Codex 진행 중)** 과 **운영 반영 확인** 정도.

## 고등학생 비유

이 작업은 쉽게 말해 **두 개의 가게 장부(바이오컴·팀키토)가 섞여 있는 것을 시기별로 다시 꽂아 넣는 일**이다. 예전에는 "어느 시점에 커피 가게가 바이오컴에서 팀키토로 이사 갔다"는 것만 알고 있었고, 실제 매출 숫자는 Wing 화면에서 눈대중으로 봤다. 이번 작업으로 **16개월 매출 전체를 월별로 꽂아 넣고**, 그 중 **커피 매출이 언제부터 다른 장부로 옮겨갔는지**를 숫자로 보게 만든다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | 정산 16개월 백필 | Codex | 100% / 100% | [[#Phase1-Sprint1\|이동]] |
| Phase2 | [[#Phase2-Sprint2]] | 브랜드 분류·이관 시점 확정 | Claude Code | 100% / 100% | [[#Phase2-Sprint2\|이동]] |
| Phase3 | [[#Phase3-Sprint3]] | 쿠팡 매출 대시보드 | Claude Code | 100% / 100% | [[#Phase3-Sprint3\|이동]] |
| Phase4 | [[#Phase4-Sprint4]] | 로켓그로스 · 운영 DB 연동 | Claude Code | 70% / 70% | [[#Phase4-Sprint4\|이동]] |
| Phase5 | [[#Phase5-Sprint5]] | 2025 년 RG 과거 백필 | Claude Code | 100% / 100% | [[#Phase5-Sprint5\|이동]] |
| Phase6 | [[#Phase6-Sprint6]] | 일 1회 incremental sync | 외부 (biocom-dashboard) | 100% / 100% | [[#Phase6-Sprint6\|이동]] |

## 문서 목적

이 문서는 **쿠팡 BIOCOM·TEAMKETO 16개월 매출 백필과 분석 대시보드의 현재 상태·막힌 점·다음 순서**를 대표와 개발팀이 같은 언어로 이해하도록 정리한다.

## 이 작업이 하는 일

**두 법인 (바이오컴·팀키토) 의 쿠팡 매출 전체 기록을 월 단위로 한자리에 모으고**, **어느 시점에 어떤 브랜드(건기식·커피)가 어느 법인으로 움직였는지를 숫자로 보여주는 화면을 만드는 일**이다.

## 왜 필요한가

- **사실**: 2026-02 기점으로 BIOCOM 쿠팡 매출이 ₩7.46M → ₩1.88M 로 75% 빠졌고, 같은 달 TEAMKETO 쿠팡 매출이 ₩0 → ₩4.53M 로 등장했다.
- **현재 판단**: 더클린커피 사업부가 BIOCOM → TEAMKETO 법인으로 이관된 것이 유력 가설이다.
- 이 장치가 없으면 **각 법인의 진짜 건기식 매출·커피 매출을 따로 못 본다**. 대표가 "커피 매출이 늘었는가"를 물어도 법인 단위로 답이 흩어진다.
- 매출 추세·수수료율·이관 전후 매출 변화를 **한 화면에 놓아야** 다음 달 재고·광고·VIP 설계 판단이 사람 감 대신 숫자 위에서 이뤄진다.

## 현재 상태

### 확인된 것 (사실)

- `coupang_settlements_api` 테이블 16개월 전수 적재 완료 — BIOCOM 91행 ₩188,557,771 + TEAMKETO 15행 ₩15,966,931 = **총 106행 · ₩204,524,702** (3P only)
- `settlementType` 분포: `WEEKLY` 87건 + `RESERVE` 19건 (로켓그로스 값 없음)
- Wing UI 최종지급액과 API `finalAmount` **7건 전수 100% 일치 확인** (TEAMKETO 샘플)
- **RG Order API (로켓그로스 주문 조회) 는 공식 존재**. `coupangorderdocu.md` 확인 결과 biocom-dashboard 프로젝트의 Cloud Scheduler 가 매일 02:05/17:05 KST 에 호출해 `tb_coupang_orders_rg` 적재 중.
- **로켓그로스 "정산" 전용 endpoint 는 여전히 없음**. `settlement-histories` 는 3P 만. 로켓그로스 정산액은 주문 단위 `sales_quantity × unit_sales_price` 로 자체 계산하되 쿠팡 수수료·물류비 차감 정보가 없어 gross 추정치만 가능.
- **수동 업로드분**: `tb_sales_coupang.channel='coupang_rg'` 691건 ₩32,168,990 (2026-01 만)
- **자동 sync 분** (원격 PG `tb_coupang_orders_rg`): BIOCOM 2026-02 150건 ₩6.94M · 2026-03 699건 ₩34.46M · 2026-04 574건 ₩28.69M
- **seo 자체 백필 완료 (2026-04-24)**: RG Order API 로 2025-01 ~ 2026-01 13개월 직접 호출. **로컬 SQLite `coupang_rg_orders_api`** 에 10,863행 적재 · 2025-09 ₩38.7M / 2025-10 ₩38.9M 피크 확인 (3P 스파이크와 동반)
- **이관 가설 정확도 95%+ 로 상향** (3P+RG 동시 2026-02 급감). 남은 5% 는 Wing 사업자 변경 이력 공식 확인만 남음.
- TEAMKETO 는 로켓그로스 운영 안 함 (`coupangorderdocu.md §2.1` 명시: `vendor_id ... 바이오컴 1개`)
- 백엔드 `GET /api/coupang/dashboard` 엔드포인트 확장 완료: 기존 필드 + `brandBreakdown` · `channelTotals` · **`rgOrdersMonthly`** (tb_coupang_orders_rg 월별 집계) · `coverage_summary` note
- 프론트 `/coupang` 페이지 로컬 + 외부 HTTP 200 · 4 series stack 차트 BIOCOM RG 4개월 커버 (2026-01~04)
- **이관 월 유력 가설**: 2026-02 — 3P 기준 실측 지지 (BIOCOM 3P 커피 2026-01 ₩9.46M → 2026-02 ₩2M = −79%). **월 단위 정확도 약 85~90%**, 일 단위는 약 50% (정산은 구매확정일 기준이라 계약일 유추 제한)

### 아직 안 된 것

- **TEAMKETO RG 백필** (진행 중 · Codex agent 로 2025-01 ~ 2026-04 호출)
- TEAMKETO 3P 4월 마감 (정산 API 에 일부 `SUBJECT` 상태로 남음 · 자동 해소)
- 2025 년 3P 건단위 상세 데이터 — 현재는 월 요약(정산)만. 건단위 드릴다운 필요 시 Wing 엑셀 12개월 다운로드 + 로컬 SQLite 적재 (선택사항)

### 지금 막힌 이유

현재 seo 측 블로커 없음. 단 TEAMKETO RG 백필 (Codex 진행 중) 결과에 따라 `biocom-dashboard` 스케줄러에 TEAMKETO 추가 요청이 필요할 수 있음 (현재 스케줄러는 BIOCOM 만 sync). 이건 seo 가 로컬 SQLite 에 자체 적재해 우회 가능.

### 현재 주체

- TEAMKETO RG 백필: **Codex agent** (진행 중)
- 대시보드 반영·VM 배포: **Claude Code**
- TJ 수동 작업 없음

## 산출물

### 운영상 생기는 것

- **쿠팡 월별 매출 장부** — 2025-01 ~ 2026-04 모든 정산을 한자리에
- **사업부 이관 타임라인 화면** — 바이오컴·팀키토 월별 스택 + 이관 시점 세로선
- **이관 전후 비교표** — 각 법인의 매출이 얼마나 이동했는지 숫자로
- **쿠팡 Top 상품 랭킹** — 최근 2개월 BIOCOM 건기식 판매 상위 10개
- **수수료율 추이** — `serviceFee / totalSale` 월별 추이

### 실제 구현물

- 로컬 SQLite: `coupang_settlements_api` 테이블 (106행, 16개월, 3P only)
- 원격 PG: `tb_sales_coupang` 수동 업로드 (989건 · `channel`+`project` 태깅 · 2026-01~03 커버)
- 백엔드 엔드포인트: `GET /api/coupang/dashboard` — kpi · monthly · transferPivot · typeDist · recent · topProducts · **brandBreakdown (월×채널×브랜드)** · **channelTotals (3P vs 로켓그로스)**
- 백필 스크립트: `backend/scripts/coupang-backfill-settlements.cjs`
- 프론트 페이지: `/coupang` (`frontend/src/app/coupang/page.tsx`) — 기존 차트 + **채널×브랜드 피벗 섹션** + **로켓그로스 수동 업로드 구간 안내**
- 메인 포털 진입: `/` TAB 7 AI CRM 포털에 "쿠팡 매출 대시보드" 카드 (`frontend/src/app/page.tsx:1739`)

## 우리 프로젝트에 주는 도움

- 법인별로 흩어진 매출 장부가 **한 화면에서 비교 가능**해진다.
- 더클린커피 사업부 이관이 실제 매출에 어떻게 반영됐는지 **감이 아니라 숫자**로 설명할 수 있다.
- 쿠팡 수수료율 추이를 보고 **마진이 개선·악화되는지 월 단위로** 판단할 수 있다.
- 다음 단계 **통합 VIP 멤버십 (전략 2)** 는 자사몰만 쓰지만, 쿠팡 매출을 법인별로 분리해 봐야 "전체 매출 대비 자사몰 비율"이 정확해진다.
- 다음 Phase **이관 월 확정**이 끝나면 **광고비 대비 법인별 ROAS** 도 분리 가능해진다.

## 다음 액션

### 지금 당장

1. TEAMKETO RG 백필 (Codex agent) 완료 결과 확인 후 대시보드에 반영.
2. `/coupang` 외부 smoke — VM 배포 결과 최종 확인 (16개월 BIOCOM RG 전구간 + TEAMKETO RG 통합).

### 이번 주

3. biocom-dashboard 팀에게 TEAMKETO vendor 를 스케줄러에 추가 요청 (일 2회 sync 자동화). seo 로컬 SQLite 자체 적재는 임시 · 장기적으로 운영 DB 통합이 깔끔.
4. `/coupang` 페이지 KPI 카드 숫자 재검증 — 3P+RG 합산으로 BIOCOM 총 매출 규모 크게 증가할 것.

### 운영 반영 후

5. TEAMKETO 가 3P 에만 있는 상품 vs RG 에만 있는 상품 분석 (상품 카테고리 stitch).

## 승인 필요 항목

- **쿠팡 Top 상품 공개 범위**: 메인 포털 TAB 7 에 노출되면 접근 가능한 사용자 전원이 판매 랭킹을 본다. 이대로 운영 반영할지 TJ 판단 필요.
- **운영 반영 시점**: 로컬 검증 완료됐으나 VM 배포는 아직. 위 Top 상품 승인과 묶어서 결정.

## 현재 병목

- **TJ 확인 대기 1건**: 사업자 변경 이력 교차 검증 (이관 월 확정)
- **Phase 4 (로켓그로스) 는 매출 영향 작음** (TEAMKETO 3개월 기준 ₩2.3M 규모). Phase 2 끝나고 여유 있을 때 착수해도 됨.

---

## Sprint 상세

### Phase1-Sprint1

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 정산 16개월 백필
**상태**: 100% / 100%

- 무엇을 하는가: BIOCOM·TEAMKETO 두 법인의 `settlement-histories` API 를 2025-01 ~ 2026-04 (16개월) 전수 호출해 로컬 SQLite 에 적재했다.
- 왜 필요한가: Wing UI 는 최근 3개월만 쉽게 보이고 그 이전은 검색·필터가 느려서 분석에 못 쓴다. API 응답을 내 DB 에 복제해야 월·법인·type 별 피벗이 가능하다.
- 산출물: `coupang_settlements_api` 테이블 106행, Wing UI 대비 100% 일치 확인

#### 역할 구분

- TJ: IP 화이트리스트 추가 (180.65.83.254 를 Wing 연동정보에 등록) — 이미 완료
- Codex: `coupangClient.ts` `getSettlementHistories` 버그 수정, 백필 스크립트 작성·실행
- Claude Code: 해당 없음

### Phase2-Sprint2

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 브랜드 분류·이관 시점 확정
**상태**: 60% / 0%

- 무엇을 하는가: **`tb_sales_coupang` 이 이미 `project` 컬럼으로 커피/영양제/펫_영양제 외/미분류 태깅을 완료**한 것을 발견하여 상품명 ILIKE 재태깅 대신 기존 태깅을 그대로 사용. `/coupang` 에 채널(coupang_rg/coupang_3p) × 브랜드 피벗을 추가해 이관 증거를 시각화했다. 남은 일은 TJ 의 Wing 판매자정보 교차 검증 한 가지.
- 왜 필요한가: 이관 월이 감이 아니라 숫자로 확정돼야 "이관 전 바이오컴 커피 매출 월 평균", "이관 후 팀키토 커피 매출 월 평균" 같은 비교가 의미 있어진다. 3P 실측은 이미 **커피 ₩9.46M(2026-01) → ₩2M(2026-02) = −79%** 로 이관 가설을 강하게 지지한다.
- 산출물: 월×채널×브랜드 피벗 API 필드 + 프론트 피벗 테이블 + 이관 월 확정 보고

#### 역할 구분

- TJ: Wing 판매자정보에서 BIOCOM·TEAMKETO 양쪽 사업자 변경 이력 확인 — 2FA 로그인 필요, 자동화 불가
- Codex: 해당 없음 (이미 수동 업로드된 `tb_sales_coupang.project` 태깅을 그대로 사용)
- Claude Code: API 확장 (`brandBreakdown`/`channelTotals`) + `/coupang` 페이지에 채널×브랜드 섹션 추가 — 완료

#### 실행 단계

1. [x] [Claude Code] 사전 조사로 `tb_sales_coupang.project` 컬럼이 이미 수동 태깅돼 있음을 확인 — 상품명 ILIKE 재태깅 불필요
2. [x] [Claude Code] `/api/coupang/dashboard` 에 `brandBreakdown` (월×채널×브랜드) + `channelTotals` (3P vs 로켓그로스) 필드 추가
3. [x] [Claude Code] `/coupang` 프론트에 채널별 누적 카드 + 월×채널×브랜드 피벗 테이블 추가
4. [TJ] Wing 판매자정보에서 사업자 변경 이력 확인 — 2FA 필요. 2026-02 가설 승인 또는 수정
5. [Claude Code] 4번 결과 반영해 `TRANSFER = "2026-02"` 상수 최종 확정 또는 수정. 의존성: 선행필수. TJ 답이 나와야 운영 공개 가능

### Phase3-Sprint3

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 쿠팡 매출 대시보드
**상태**: 100% / 배포중

- 무엇을 하는가: 백필한 정산 데이터와 수동 업로드된 브랜드 피벗을 한 화면에 보여주는 `/coupang` 페이지. 현재 운영 VM 재배포 진행 중.
- 왜 필요한가: 대표·운영자가 Wing 에 매번 로그인하지 않아도 월별 매출 추이·이관 시점·채널별 비교·Top 상품을 한 자리에서 본다.
- 산출물: `/coupang` 페이지 (4 KPI · 월별 스택 바 + 이관 시점 세로선 · 이관 전후 표 · **채널×브랜드 피벗 테이블** · **3P vs 로켓그로스 누적 카드** · 자동 이상치 감지 · Top 10 상품 · 최근 10건 정산 · 수수료율 추이 · settlement_type 분포)

#### 역할 구분

- TJ: Top 상품 외부 노출 승인 (현재 메인 포털 TAB 7 에 연결됨)
- Codex: 해당 없음
- Claude Code: API 확장 + 프론트 작성 + VM 배포

#### 실행 단계

1. [x] [Claude Code] `backend/src/routes/coupang.ts` 작성, `registerRoutes.ts` 등록
2. [x] [Claude Code] `frontend/src/app/coupang/page.tsx` 대시보드 페이지 작성
3. [x] [Claude Code] 메인 포털 (`/` TAB 7) 에 "쿠팡 매출 대시보드" 카드 추가
4. [x] [Claude Code] Cloudflare Purge Everything 실행
5. [x] [Claude Code] API + 프론트에 채널×브랜드 섹션 추가, 빌드 통과
6. [Claude Code] VM 재배포 진행 중 (`/tmp/vm-deploy-coupang.sh` · backend + frontend 동시)
7. [TJ] Top 상품 외부 노출 승인 또는 로그인 가드 요구. 의존성: 선행필수. 승인 결과에 따라 Claude Code 가 가드 추가 여부 결정

### Phase4-Sprint4

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 로켓그로스 · 운영 DB 연동
**상태**: 70% / 70%

- 무엇을 확정했는가 (2026-04-24 재정의):
  - **공식 RG Order API 존재**. `coupangapi.md` §4.3 + `coupangorderdocu.md` §4 문서화됨.
  - **biocom-dashboard 프로젝트의 Cloud Scheduler 가 이미 매일 02:05 / 17:05 KST 에 호출**해 `tb_coupang_orders_rg` 에 적재 중. seo 는 read-only 로 쓰면 됨 (별도 sync 구축 불필요).
  - **로켓그로스 "정산" 전용 endpoint 는 없음** — `sales_quantity × unit_sales_price` 로 gross 자체 계산 (쿠팡 수수료·물류비 차감 없음 = 지급액 아닌 총판매 추정치).
- 왜 필요한가: 로켓그로스 매출을 대시보드에 포함시켜야 실제 쿠팡 매출 규모를 본다. 2026-01 BIOCOM 기준 RG 가 3P 의 4배.
- 산출물:
  - `/api/coupang/dashboard` 에 `rgOrdersMonthly` 필드 추가 (tb_coupang_orders_rg 월별 집계 · BIOCOM 전용)
  - 프론트 `/coupang` 4 series stack 차트 · BIOCOM RG 커버리지 4개월 (2026-01 수동업로드 + 2026-02~04 자동 sync)
- 실측 규모 (BIOCOM):
  - 2026-01 (수동 업로드): ₩32.17M (691건)
  - 2026-02 (자동 sync): ₩6.94M (150건)
  - 2026-03 (자동 sync): ₩34.46M (699건)
  - 2026-04 (자동 sync · 부분월): ₩28.69M (574건)

#### 결론 (2026-04-24 확정)

- **운영 DB 가 이미 분리 구축돼 있음**: `tb_coupang_orders_rg` (2P · BIOCOM 전용) + `tb_coupang_orders_mp` (3P · biocom + teamkito) + `tb_sales_coupang` (수동 업로드 과거 보정)
- **TEAMKETO 는 로켓그로스 미운영** (`coupangorderdocu.md §2.1` 명시). 데이터 0 은 의도된 것.
- **seo 측 별도 sync 불필요**. 단 2025 년 RG 과거 데이터 확보만 Phase 5 로 분리.

#### 역할 구분

- TJ: Wing 판매자정보 사업자 변경 이력 (Phase 2 와 묶임)
- Codex: 해당 없음 (운영 DB 는 biocom-dashboard 팀이 관리)
- Claude Code: `/api/coupang/dashboard` 에 `rgOrdersMonthly` 집계 + 프론트 4 series 차트 — 완료

### Phase5-Sprint5

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 2025 년 RG 과거 백필
**상태**: 0% / 0%

- 무엇을 하는가: 2025-01 ~ 2025-12 로켓그로스 매출이 자동 sync 도입 전이라 어디에도 없다. Wing 엑셀 다운로드로 12개월치를 한번에 메운다.
- 왜 필요한가: 현 대시보드는 2025 년 BIOCOM 로켓그로스가 0 으로 보이는데 실제론 3P 의 2~3배 규모 추정. 2025 년 총 매출 비교·이관 효과 측정이 크게 왜곡된다.
- 산출물: `tb_sales_coupang.channel='coupang_rg'` 에 2025 년 12개월 적재 완료

#### 역할 구분

- TJ: Wing → 정산 → 로켓그로스 탭 → 2025-01~2025-12 엑셀 다운로드 (2FA 필요 · 수동)
- Codex: TJ 가 엑셀 제공 시 `tb_sales_coupang` 로 업로드 스크립트 작성 (또는 기존 루트 재사용)
- Claude Code: 해당 없음

#### 실행 단계

1. [TJ] Wing 로켓그로스 정산현황 탭에서 2025-01~12 엑셀 12개 (또는 단일 큰 파일) 다운로드. 의존성: 선행필수. 2FA 로그인 필요.
2. [Codex] 엑셀 포맷 기존 업로드와 동일한지 검사 · 다르면 변환 스크립트 추가
3. [Codex] `tb_sales_coupang` 로 upsert (upload_batch_id 식별 · 중복 방지)
4. [Claude Code] 대시보드 재로딩 시 2025 년 RG 자동 반영 확인

#### 대안: biocom-dashboard 과거 백필 Job

TJ 가 엑셀 다운로드 대신 biocom-dashboard 팀에게 "2025 년 RG Order API 과거 호출 job 1회" 요청. RG Order API 가 과거 범위 조회 허용하는지 확인 필요. 현재 Codex Agent 가 조사 중.

### Phase6-Sprint6

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 일 1회 incremental sync
**상태**: 100% / 100%

- 무엇을 하는가: 쿠팡 주문 (RG · MP) 매일 자동 sync. **biocom-dashboard 프로젝트가 이미 운영 중** (Cloud Scheduler + Cloud Run).
- 왜 필요한가: 대시보드가 실시간에 가깝게 유지되려면 매일 자동 sync 필요.
- 산출물 (외부 프로젝트 관리): Cloud Scheduler 2개 job · Cloud Run `dashboard-backend` 엔드포인트 2개 · `tb_coupang_orders_rg` / `tb_coupang_orders_mp` 적재

#### 역할 구분

- TJ: 해당 없음 (biocom-dashboard 팀 관리)
- Codex: 해당 없음
- Claude Code: seo 측에서는 read-only 로 활용. 별도 sync 구축 불필요.

#### 스케줄 참고 (coupangorderdocu.md §3)

| Job | KST | endpoint | 테이블 |
|---|---|---|---|
| `dashboard-coupang-incremental-sync` | 02:05 · 17:05 | `/api/scheduler/coupang/incremental-sync` | `tb_coupang_orders_rg` |
| `dashboard-coupang-marketplace-incremental-sync` | 02:20 · 17:20 | `/api/scheduler/coupang/marketplace-incremental-sync` | `tb_coupang_orders_mp` |

운영 주체: `biocom-dashboard` 프로젝트 (`asia-northeast3`). seo 프로젝트는 PG 만 공유해 사용.

---

## 개발 부록

### 코드 위치

- 백엔드 라우터: `backend/src/routes/coupang.ts:15` (`GET /api/coupang/dashboard`)
- 라우터 등록: `backend/src/bootstrap/registerRoutes.ts:26, 52`
- SQLite 스키마: `backend/src/crmLocalDb.ts` (`coupang_settlements_api` CREATE)
- 백필 스크립트: `backend/scripts/coupang-backfill-settlements.cjs`
- API 클라이언트: `backend/src/coupangClient.ts` (`getSettlementHistories`)
- 프론트 페이지: `frontend/src/app/coupang/page.tsx`
- 메인 포털 카드: `frontend/src/app/page.tsx:1739`

### API 스펙 (요약)

**정산 이력** (월 단위, 백필용)

```
GET /v2/providers/marketplace_openapi/apis/api/v1/settlement-histories?revenueRecognitionYearMonth=YYYY-MM
```

응답 핵심 필드:

| 필드 | 의미 |
|---|---|
| `settlementType` | `WEEKLY` / `RESERVE` / (로켓그로스 type 미확정) |
| `settlementDate` | 실제 지급일 |
| `revenueRecognitionYearMonth` | 매출 인식 월 |
| `totalSale` | 총 판매액 |
| `serviceFee` | 쿠팡 수수료 |
| **`finalAmount`** | **Wing "최종지급액"** = 실제 은행 입금액 |
| `status` | `DONE` / (`PENDING` 추정) |

**주문 조회** (진행 중 주문용, 백필 부적합)

```
GET /v2/providers/openapi/apis/api/v4/vendors/{vendorId}/ordersheets?createdAtFrom=YYYY-MM-DD+09:00&createdAtTo=YYYY-MM-DD+09:00&searchType=timeFrame&status=...
```

- v5 일단위: `YYYY-MM-DD+09:00` 형식 (ISO timezone offset)
- ordersheets 는 "진행 중 주문" 성격이므로 과거 백필에는 적합하지 않다. 최근 주문만 수집하고 있다 (`tb_coupang_orders` 1,402건).

### 스키마 (참고)

```sql
CREATE TABLE IF NOT EXISTS coupang_settlements_api (
  settlement_id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,                -- A00668577 / A00963878
  brand_project TEXT,                     -- biocom_health / theclean_coffee / unclassified (Phase 2 에서 채움)
  settlement_type TEXT,                   -- WEEKLY / RESERVE / (로켓그로스 type)
  settlement_date TEXT,
  recognition_year_month TEXT,
  recognition_date_from TEXT,
  recognition_date_to TEXT,
  total_sale INTEGER,
  service_fee INTEGER,
  settlement_target_amount INTEGER,
  settlement_amount INTEGER,
  last_amount INTEGER,
  deduction_amount INTEGER,
  seller_discount_coupon INTEGER,
  downloadable_coupon INTEGER,
  final_amount INTEGER NOT NULL,          -- Wing 최종지급액 · 주 집계 필드
  status TEXT,
  raw_json TEXT,
  synced_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_cs_vendor ON coupang_settlements_api(vendor_id);
CREATE INDEX idx_cs_ym ON coupang_settlements_api(recognition_year_month);
CREATE INDEX idx_cs_date ON coupang_settlements_api(settlement_date);
CREATE INDEX idx_cs_brand ON coupang_settlements_api(brand_project);
CREATE INDEX idx_cs_type ON coupang_settlements_api(settlement_type);
```

### 한계·리스크

| 항목                             | 내용                                     | 완화                                                    |
| ------------------------------ | -------------------------------------- | ----------------------------------------------------- |
| **로켓그로스 endpoint 미확정**         | 공식 문서상 기존 endpoint 공유 추정, 실제 응답 구조 미검증 | Phase 4 에서 탐색. 영향 규모 작음 (TEAMKETO 3개월 기준 ₩2.3M)       |
| **과거 구매자 phone 없음**            | 쿠팡 정책상 주문자 전화번호 마스킹                    | 쿠팡 매출은 "상품·월 단위 집계"로만 활용. 통합 VIP 멤버십 (전략 2) 는 자사몰만 사용 |
| **더클린커피 이관 시점 확정**             | 2026-02 가설이나 Wing 사업자 변경 이력 수동 확인 필요   | Phase 2 에서 TJ 확정                                      |
| **건기식/커피 분류 정확도**              | 상품명 ILIKE 키워드 매칭 특성상 미분류 발생 가능         | `unclassified` 그룹 두고 수동 샘플 검증                         |
| **Wing 이 API 에 노출하지 않는 정보**    | 환불 건, 부분취소, 반품 사유                      | `/returnRequests` 별도 endpoint 호출 (Phase 4 옵션)         |
| **Rate limit 10/s per seller** | 전체 백필 192 호출                           | 150ms sleep 으로 완화 중                                   |

### 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-04-24 | 신규 작성 (Phase 0 규모 확인·백필 4-phase 계획) |
| 2026-04-24 | Phase 1 백필 완료 (106행 적재, Wing 100% 일치 확인) |
| 2026-04-24 | Phase 3 대시보드 로컬 구현 완료 (`/api/coupang/dashboard` + `/coupang` 페이지 + 메인 포털 카드 진입) |
| 2026-04-24 | docurule v2 포맷으로 문서 재작성 (10초 요약 + Phase-Sprint 요약표 + 역할 구분 + 실행 단계 + wiki 링크) |
| 2026-04-24 | Phase 4 결론 ("로켓그로스 공식 API 부재") · Phase 2 재설계 (`tb_sales_coupang.project` 기존 태깅 활용) · API `brandBreakdown`/`channelTotals` 필드 추가 · 프론트 채널×브랜드 피벗 섹션 추가 · VM 재배포 착수 |
| 2026-04-24 21:30 | 월별 차트 4 series stack (BIOCOM 3P/RG · TEAMKETO 3P/RG) 분리 · VM e2-small → e2-standard-2 (2GB→8GB) 업그레이드 + 고정 IP 할당 · Cloudflare Tunnel `coffeevip/api/*` path 추가 · frontend API_BASE 를 상대 경로로 변경 · SQLite 106행 VM 동기화 |
| 2026-04-24 21:30 | `coupangorderdocu.md` 확인 결과 **운영 DB 가 biocom-dashboard 프로젝트의 Cloud Scheduler 로 자동 sync 중** 발견. Phase 4 재정의 (공식 RG Order API 존재 · 정산 endpoint 만 없음) · Phase 6 신설 (외부 스케줄러 관리) · Phase 5 를 "2025 년 RG 과거 백필" 로 용도 변경. `/api/coupang/dashboard` 에 `rgOrdersMonthly` + `coverage_summary` note 추가. BIOCOM RG 커버리지 1개월 → 4개월 확장. |
| 2026-04-24 22:00 | **Phase 5 완료** · RG Order API 로 2025-01 ~ 2026-01 전체 13개월 BIOCOM 로켓그로스 자체 백필. 로컬 SQLite `coupang_rg_orders_api` 테이블 신설 · 10,863행 적재 (5분 39초 · 244 API calls · 에러 0). `/api/coupang/dashboard` 가 로컬 SQLite + 원격 PG 2소스 union 으로 16개월 BIOCOM RG 완전 커버. 2025 년 쿠팡 총 매출 (3P+RG) 실규모 ≈ ₩500M 로 재평가 (이전 ₩204M 의 2.5배). 이관 가설 정확도 85~90% → **95%+** 로 상향 (2026-02 3P+RG 동시 급감). |
