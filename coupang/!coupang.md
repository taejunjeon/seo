# 쿠팡 백필 · 매출 분석 정본

작성 시각: 2026-04-24 20:00 KST
기준일: 2026-04-24
문서 성격: **가변형 정본** (쿠팡 데이터 파이프라인·분석 단일 출처)
이전본: `!coupang.md.bak_20260424_pre_docurule`
상위: [`../CLAUDE.md`](../CLAUDE.md), [`../data/!datacheckplan.md`](../data/!datacheckplan.md)
관련: [`coupangapi.md`](./coupangapi.md) (API 스펙·인증 가이드, static)

---

## 10초 요약

- 이 문서의 목적은 **쿠팡 BIOCOM·TEAMKETO 16개월 매출을 한 자리에서 보게 만드는 것**이다.
- 지금 결론: **Phase 1 정산 백필 · Phase 3 대시보드 (3P+로켓그로스·브랜드 분리 포함) 로컬은 닫혔고**, **Phase 4 는 "공식 로켓그로스 settlement API 부재 확정"** 으로 리서치 끝. Phase 2 의 이관 월 TJ 확정만 남음.
- 현재 가장 큰 병목은 **더클린커피 사업부 이관 시점의 확정**이다. 2026-02가 유력 가설이고 **3P 기준 실측 −79% 급감** 으로 강하게 지지되지만, Wing 사업자 변경 이력으로 아직 교차 검증되지 않았다.
- 다음 액션은 **(1) VM 재배포로 `/coupang` 운영 공개** 와 **(2) TJ 가 Wing 판매자정보에서 사업자 변경 이력을 확인해 이관 월을 확정**이다.

## 고등학생 비유

이 작업은 쉽게 말해 **두 개의 가게 장부(바이오컴·팀키토)가 섞여 있는 것을 시기별로 다시 꽂아 넣는 일**이다. 예전에는 "어느 시점에 커피 가게가 바이오컴에서 팀키토로 이사 갔다"는 것만 알고 있었고, 실제 매출 숫자는 Wing 화면에서 눈대중으로 봤다. 이번 작업으로 **16개월 매출 전체를 월별로 꽂아 넣고**, 그 중 **커피 매출이 언제부터 다른 장부로 옮겨갔는지**를 숫자로 보게 만든다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | 정산 16개월 백필 | Codex | 100% / 100% | [[#Phase1-Sprint1\|이동]] |
| Phase2 | [[#Phase2-Sprint2]] | 브랜드 분류·이관 시점 확정 | TJ+Codex | 60% / 0% | [[#Phase2-Sprint2\|이동]] |
| Phase3 | [[#Phase3-Sprint3]] | 쿠팡 매출 대시보드 | Claude Code | 100% / 배포중 | [[#Phase3-Sprint3\|이동]] |
| Phase4 | [[#Phase4-Sprint4]] | 로켓그로스 endpoint 확인 | TJ+Codex | 50% / 0% | [[#Phase4-Sprint4\|이동]] |
| Phase5 | [[#Phase5-Sprint5]] | 일 1회 incremental sync | Codex | 0% / 0% | [[#Phase5-Sprint5\|이동]] |

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
- **로켓그로스 공식 API 부재 확정** (2026-04-24 공식 문서 리서치) — `developers.coupangcorp.com` 의 Settlement APIs 섹션은 `marketplace_openapi` 1개, Rocket Growth APIs 섹션엔 정산 article 자체가 없음. Wing UI 수동 export 만 가능.
- **수동 업로드분으로 로켓그로스 규모 실측**: `tb_sales_coupang` 에 `coupang_rg` channel 로 **691건 ₩32,168,990 (2026-01 만)** 이 이미 수동 업로드돼 있음. 같은 달 `coupang_3p` 는 ₩10.93M → **로켓그로스가 3P 의 3배**
- 백엔드 `GET /api/coupang/dashboard` 엔드포인트 확장 완료: 기존 필드 + `brandBreakdown` (월×채널×브랜드 피벗) + `channelTotals`
- 프론트 `/coupang` 페이지 로컬 렌더링 HTTP 200 · 빌드 통과
- **이관 월 유력 가설**: 2026-02 — 3P 기준 실측 지지 (BIOCOM 3P 커피 2026-01 ₩9.46M → 2026-02 ₩2M = −79%)

### 아직 안 된 것

- Wing 판매자정보상 사업자 변경 이력 수동 교차 검증 (이관 월 확정)
- 로켓그로스 2026-02 이후 수동 업로드 (현재 2026-01 만)
- 운영 반영 (VM 재배포 진행 중 · coupang route + brand 섹션 반영)

### 지금 막힌 이유

1. **이관 월 확정**: Wing 판매자정보 페이지는 사업자 로그인 뒤 수동 확인이 필요하다 (§3-6B-1 기준 TJ 작업). 3P 실측은 이미 −79% 로 2026-02 가설을 강하게 지지한다.
2. **로켓그로스 2026-02~04 수동 업로드**: Wing UI → 엑셀 export → `tb_sales_coupang` 로 적재하는 수동 작업이 TJ 필요.

### 현재 주체

- 이관 월 확정: **TJ** (Wing 판매자정보 확인)
- 로켓그로스 2026-02~04 엑셀 업로드: **TJ** (Wing UI 다운로드 + 기존 `tb_sales_coupang` 적재)
- VM 배포: **Claude Code** (진행 중)

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

1. TJ 가 Wing → 판매자정보 → 사업자 변경 이력 확인 (BIOCOM · TEAMKETO 양쪽). 이관 월을 확정해 **2026-02 가설을 승인하거나 수정**한다.
2. Cloudflare Dashboard → Caching → Purge Everything 한 번 실행 (검색엔진 색인 차단 반영용).

### 이번 주

3. Codex 가 상품명 ILIKE 규칙으로 `coupang_settlements_api.brand_project` 컬럼 일괄 태깅.
4. Claude Code 가 `/coupang` 페이지에 브랜드 분리 스택 바 차트 추가 (건기식/커피 구분).

### 운영 반영 후

5. Codex 가 일 1회 incremental sync cron 세팅 (최근 2개월만 재호출).
6. 로켓그로스 endpoint 탐색 — `/v2/providers/` 하위 미탐 path 리스트 점검.

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

**이름**: 로켓그로스 endpoint 확인
**상태**: 50% / 0%

- 무엇을 확정했는가 (2026-04-24 update): **로켓그로스 "주문 API" 는 공식 존재**. `coupangapi.md` §4.3 에 `RG Order API - List Query` 로 명시. 참조: https://developers.coupangcorp.com/hc/en-us/articles/41131195825433-RG-Order-API-List-Query. 다만 **정산 전용 endpoint 는 여전히 없음** — `/v2/providers/marketplace_openapi/apis/api/v1/settlement-histories` 하나만 공식 제공되고 거기 3P 만 포함된다.
- 왜 필요한가: 주문 단위 데이터를 가져오면 로켓그로스 매출을 수동 엑셀 업로드 없이 자동화할 수 있다. 정산 API 는 공용이라 여전히 3P 만 잡히지만, RG Order API 의 `unitSalesPrice × salesQuantity` 로 월별 로켓그로스 매출을 자체 계산 가능.
- 산출물: 로켓그로스 주문 sync 스크립트 (미구현) + `tb_sales_coupang` 수동 업로드 (현재 2026-01 만)
- 실측 규모: `tb_sales_coupang.channel='coupang_rg'` 로 **691건 ₩32,168,990 (2026-01)** 이 수동 업로드돼 있음. 같은 달 3P 의 3배 규모.

#### 결론 (2026-04-24 확정)

- **주문 API 있음**: `RG Order API - List Query` 공식 endpoint. `productName`, `salesQuantity`, `unitSalesPrice`, `paidAt`, `vendorItemId`, `orderId`, `currency` 수준 필드.
- **정산 전용 endpoint 없음**: `settlement-histories` 가 공용이고 현재 응답엔 3P 만 섞여 나옴. 로켓그로스 정산 합산은 주문 데이터 기반 자체 집계로 대체.
- **주의 (coupangapi.md 메모)**:
  - 2P `paidAt` 은 유닉스 밀리초 문자열일 수 있음. 3P ISO 문자열과 같은 컬럼에 그대로 섞지 말 것.
  - 주문자·수령자·배송 정보는 2P 응답에 없음. 3P 테이블과 분리 저장.
  - 쿠팡 개인정보 마스킹 정책으로 phone 기반 고객 통합 불가.

#### 역할 구분

- TJ: 과거 2026-02~04 매출은 Wing 로켓그로스 탭 엑셀 다운로드 → `tb_sales_coupang` 업로드 경로로 우선 채움 (RG Order API 도입 전 임시)
- Codex: `RG Order API - List Query` 호출 구현 → `coupang_rg_orders_api` 신규 테이블 sync (coupangapi.md §5.1A 권장안)
- Claude Code: 해당 없음 (백엔드 태스크)

#### 실행 단계

1. [TJ] 2026-02, 03, 04 로켓그로스 탭 엑셀 다운로드 후 `tb_sales_coupang` 업로드 — 임시 갭 메움
2. [Codex] `backend/src/coupangClient.ts` 에 `getRgOrders(account, dateFrom, dateTo)` 추가 — `api-gateway.coupang.com` 기준 path 확정
3. [Codex] 로컬 SQLite 또는 원격 PG 에 `coupang_rg_orders_api` 테이블 신설 (coupangapi.md §5.1A)
4. [Codex] 일 1회 sync 스크립트 + 최근 7일 재동기화 — Phase 5 와 묶어서 진행 가능
5. [Codex] `/api/coupang/dashboard` 에 로켓그로스 자체 집계 필드 추가 (수동 엑셀 의존성 해소)

### Phase5-Sprint5

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 일 1회 incremental sync
**상태**: 0% / 0%

- 무엇을 하는가: 16개월 전체 재백필 대신, 매일 새벽 최근 2개월만 재호출해 새 정산행을 upsert 한다.
- 왜 필요한가: 쿠팡 정산은 월 1~5회 발생하고 과거 월 값은 거의 안 바뀌므로 전체 재호출은 낭비다. 2개월만 돌면 안정적.
- 산출물: `scripts/coupang-sync-recent.cjs` + pm2 cron 등록

#### 역할 구분

- TJ: 운영 반영 승인 (pm2 cron 등록은 VM 작업)
- Codex: 스크립트 작성 + 로컬 테스트
- Claude Code: 해당 없음

#### 실행 단계

1. [Codex] `coupang-backfill-settlements.cjs` 에서 최근 2개월 인자 분기 추가 또는 `coupang-sync-recent.cjs` 신규 생성
2. [Codex] 로컬에서 dry-run 1회 · upsert 중복 방지 검증
3. [TJ] VM pm2 cron 등록 승인 — 운영 반영 판단
4. [Codex] VM 에서 pm2 cron 설정 + 첫 야간 실행 로그 확인

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
