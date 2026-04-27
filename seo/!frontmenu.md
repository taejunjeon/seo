# SEO 프론트엔드 메뉴 계획

작성 시각: 2026-04-28 KST  
최근 업데이트: 2026-04-28 KST (GSC 라이브 KPI 추가 + UX 고도화 반영)  
연결 문서: [[!seoplan|seo/!seoplan.md]]  
스크린샷: [seo/screnshot/](./screnshot/) (7개 섹션 + full page)  
대상 라우트: `/seo` (Next.js 16, frontend 포트 7010)  
백엔드 API: Next.js Route Handlers (`/seo/api/*` 5종, `reports/seo/*` 파일 직접 읽음) + 백엔드 7020(`/api/gsc/kpi` GSC 라이브)  
운영 영향: 0 (사이트·아임웹·GTM·Search Console 손대지 않음. 내부 대시보드만 추가)

## 10초 요약

운영 사이트와 접점 없는 진단·승인용 단일 페이지를 새로 만든다. 기존 `/#cwv`, `/#diagnosis` 탭은 라이브 측정 도구이고, `/seo`는 `reports/seo/*` 산출물(읽기 전용)을 사용자 친화적으로 시각화·검색·복사할 수 있게 모은 운영 전 대시보드다.

## 왜 별도 페이지인가

- 기존 `/` 메인은 GSC·CWV·Diagnosis 라이브 측정용. 탭이 9개라 추가가 어렵다.
- SEO 진단 산출물은 정적 파일 묶음(8 MD + 7 CSV + 5 JSON)이라 라이브 측정과 데이터 갱신 주기·UX가 다르다.
- 승인안 A/B/C 같은 의사결정 게이트가 한 화면에 모여야 TJ가 빠르게 판단할 수 있다.
- 기존 페이지 회귀를 만들지 않기 위해 신규 라우트로 격리.

## 정보 구조 (IR)

좌측 sticky 사이드바 + 우측 본문 패턴. (모바일은 상단 가로 스크롤 탭)

| # | 섹션 ID | 메뉴명 | 무엇을 보여주는가 | 데이터 소스 |
|---|---|---|---|---|
| 1 | `overview` | 종합 점수 | 54/100 게이지, 6개 항목별 점수+「이게 뭐예요/왜 이 점수예요/어떻게 올려요」, 5대 문제 + 「왜/영향/해결」, 다음 액션 | `seo_audit_summary.md`, `page_seo_audit.csv` |
| 2 | `live-gsc` | 실시간 검색 노출 | GSC 클릭/노출/CTR/평균순위 4종 + 7일 sparkline + 활용 방법 안내 | 백엔드 `/api/gsc/kpi` (sc-domain:biocom.kr) |
| 3 | `url-policy` | URL 정책 | 유형별 정책 매트릭스, 중복 그룹, URL 인벤토리 검색 + 9종 핵심 용어 Glossary | `url_policy_matrix.csv`, `duplicate_url_groups.csv`, `url_inventory.csv` |
| 4 | `jsonld` | JSON-LD | 페이지 6개 권장 schema, 5개 삽입 스니펫(각 「이게 뭐/왜/어디에 넣어요」), 운영 반영 전 체크 | `jsonld_validation_matrix.csv`, `jsonld_insertion_snippets.md`, `jsonld_samples/*` |
| 5 | `product-text` | 상품 텍스트 | 상품 4개 H1/H2/H3/FAQ 카드, 검색 의도, 모바일 미리보기, 적용 원칙 | `product_text_block_matrix.csv`, `product_text_block_drafts.md` |
| 6 | `checklist` | 운영 체크리스트 | 운영 전 6단계 + 각 게이트 「이 단계 무엇/왜」, 운영 반영 7단계 + 「이 단계가 무엇을 바꾸는지」, 롤백 기준, P0/P1 액션 | `operation_change_checklist.md`, `action_plan.csv` |
| 7 | `approvals` | 승인 현황 | 승인안 A/B/C 카드(이게 뭐/지금 상태/왜 결정 필요/YES 하면/NO 하면/답변 코드), 별도 승인 5개 + 「실제로 무엇을 어떻게」 | `!seoplan.md`(승인 섹션) |

상단에는 글로벌 헤더: 점수 뱃지(54/100), 마지막 감사 시각, 수집 URL/JSON-LD/alt 결손/중복 그룹 KPI 4개. 그 아래 종합 점수 → 실시간 검색 노출 → URL 정책 → JSON-LD → 상품 텍스트 → 운영 체크리스트 → 승인 현황 순으로 흐름.

전 페이지에 GlobalNav도 마운트되어 메인 대시보드의 9개 탭과 「SEO 분석」 액센트 버튼으로 한 클릭 이동 가능.

## 라우트와 파일 구조 (실제 구현 후)

```
frontend/src/
├── app/
│   └── seo/
│       ├── page.tsx                       # /seo 진입점, GlobalNav + SeoShell + 7개 섹션
│       └── api/
│           ├── audit/route.ts             # seo_audit_summary + page_seo_audit + url_inventory + dup
│           ├── url-policy/route.ts        # url_policy_matrix + duplicate_url_groups + url_inventory
│           ├── jsonld/route.ts            # jsonld_validation_matrix + jsonld_insertion_snippets
│           ├── product-text/route.ts      # product_text_block_matrix + drafts
│           └── checklist/route.ts         # operation_change_checklist + action_plan
└── components/
    └── seo/
        ├── SeoShell.tsx                   # 좌측 sticky nav + scroll-spy + URL hash sync
        ├── SeoHeader.tsx                  # 점수 + 4개 KPI 헤더
        ├── OverviewSection.tsx            # 점수 6항목 + 「이게 뭐/왜/어떻게」 + 5문제 「왜/영향/해결」
        ├── LiveGscSection.tsx             # GSC 라이브 KPI 4종 + sparkline
        ├── UrlPolicySection.tsx           # 정책 매트릭스 + 중복 그룹 + URL 인벤토리 + 9종 Glossary
        ├── JsonLdSection.tsx              # 권장 schema + 5개 스니펫 (각 「뭐/왜/어디」)
        ├── ProductTextSection.tsx         # 상품 4개 H1/H2/H3/FAQ + 모바일 미리보기
        ├── ChecklistSection.tsx           # 6단계 게이트 + 7단계 반영 + 「이 단계가 뭘 바꾸는지」
        ├── ApprovalsSection.tsx           # A/B/C 카드 (6블록) + 별도 승인 표 + 「실제로 어떻게」
        ├── CopyButton.tsx                 # 코드/표 복사 (운영 반영 전 핵심 UX)
        ├── WhyCallout.tsx                 # 섹션 안내문 (info/warning/success 톤)
        ├── Glossary.tsx                   # 용어 클릭 → 다크 팝오버
        ├── seo.module.css                 # 페이지 전용 토큰
        ├── seo.utils.ts                   # CSV·MD 파서, readReportFile()
        └── seo.types.ts                   # 공통 타입 17종
```

추가:
- `frontend/src/components/common/GlobalNav.tsx`: 「SEO 분석」 액센트 버튼 추가 (다른 sub-페이지에서 /seo로 진입)
- `frontend/src/app/page.tsx` + `page.module.css`: 메인 대시보드 인라인 nav에도 「SEO 분석」 버튼 추가
- `backend/scripts/seo-page-screenshots.mjs`: Playwright로 7개 섹션 + full page 자동 캡처 → `seo/screnshot/`

기존 `frontend/src/components/common/Badges.tsx`의 `LiveBadge`/`ScoreGauge`는 재사용. `page.module.css`의 `card`/`sectionHeader`/`sectionTitle`/`heroGrid`/`scoreCard`/`breakdownGrid`/`miniKpiGrid` 토큰을 우선 import 해 색상·간격 일관성을 맞춘다.

## API 설계

모두 `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `Cache-Control: no-store`.

| 엔드포인트 | 응답 형태 | 비고 |
|---|---|---|
| `GET /seo/api/audit` | `{ summary, scores, problems, pages, duplicateGroups, generatedAt }` | summary는 MD 그대로, scores/problems는 MD에서 파싱 후 구조화 |
| `GET /seo/api/url-policy` | `{ policies: PolicyRow[], duplicates, inventory: { rows, total, parameterCount } }` | inventory는 클라 검색용으로 가공된 배열 |
| `GET /seo/api/jsonld` | `{ validation: ValidationRow[], snippets: SnippetEntry[], rawMd }` | snippets는 H2 단위로 split, 코드블록 추출 |
| `GET /seo/api/product-text` | `{ products: ProductDraft[], rawMd, principles: string[] }` | matrix CSV + drafts MD 결합 |
| `GET /seo/api/checklist` | `{ preChecks, runOrder, rollback, actions: ActionRow[] }` | operation_change_checklist 표 + action_plan CSV |

CSV 파싱은 의존성 없이 `parseCsv` 유틸(따옴표 / `|` 구분자 처리 포함)을 `frontend/src/components/seo/seo.utils.ts`에 둔다.

## 핵심 UX

1. **사이드바는 sticky + scroll-spy.** 섹션이 길어도 현재 위치를 표시. URL 해시로 동기화(`/seo#jsonld`).
2. **승인 게이트 시각화.** 운영 반영 7단계 중 어디에 막혔는지 한 눈에. "TJ 응답 대기" 뱃지를 빨간 점으로.
3. **복사 버튼 우선.** JSON-LD 스니펫, 텍스트 블록, 정책 표 모두 한 클릭 복사. 운영 반영 전 GPT/콘텐츠팀 전달이 핵심.
4. **표는 정렬·검색·필터.** URL 인벤토리 300건은 type 필터 + 텍스트 검색. parameter URL 53건만 보기 토글.
5. **상품 텍스트는 카드형 + 화면 미리보기.** 모바일 폭(375px) 미리보기 박스를 옆에 띄워 "사용자에게 보이는 텍스트" 원칙을 시각화.
6. **운영 영향 0임을 명시.** 헤더에 "운영 사이트·아임웹 변경 없음. 승인용 데이터만" 회색 뱃지.

## 글꼴·색

- 상속: `--font-display`(Plus Jakarta), `--font-sans`(Space Grotesk).
- 점수 색: `--color-success` 80↑, `--color-accent` 50–79, `--color-danger` 0–49 (기존 gaugeColor 함수 재사용).
- 사이드바: `--nav-bg`(다크 #0f172a), 활성 탭 `--nav-tab-active`(민트).
- KPI 카드: `--color-surface` + `--color-border`.

## 구현 순서

1. `frontend/src/components/seo/seo.utils.ts` (CSV·MD 파서, 타입)
2. `app/seo/api/*` 5개 라우트 — 파일 읽기·파싱·캐시 헤더
3. `components/seo/SeoShell.tsx`, `SeoHeader.tsx`, `CopyButton.tsx` 공통 부품
4. 6개 섹션 컴포넌트 (overview → approvals 순)
5. `app/seo/page.tsx`에서 데이터 fetch 후 SeoShell에 주입
6. `seo.module.css` 보강 (사이드바·미리보기·복사 버튼만 고유 스타일)
7. 검증: `npx tsc --noEmit`, `npm run lint`(가능 시), 브라우저에서 6개 섹션 + 검색·복사 동작 확인
8. `!seoplan.md` 진행 기록 갱신 — Phase4 Sprint10에 "내부 모니터링 화면 1차 진수" 추가

## 검증 체크리스트 (1차 진수 통과)

- [x] `/seo` 200 OK, 7개 섹션 모두 렌더
- [x] 사이드바 클릭 시 hash 갱신, 새로고침 후 동일 섹션 유지
- [x] URL 인벤토리 검색·필터·복사 정상
- [x] JSON-LD 5개 스니펫 복사 → 클립보드에 정확히 들어감
- [x] 상품 4개 카드 모두 H1/H2/H3/FAQ + 모바일 미리보기 표시
- [x] 승인안 A/B/C 6블록 카드 + 별도 승인 표 표시
- [x] GSC 라이브 KPI 4종 + sparkline + 활용 안내 표시
- [x] Glossary 9종 클릭 시 팝오버 정상
- [x] `npx tsc --noEmit` 통과
- [x] `npx eslint src/app/seo src/components/seo --max-warnings 0` 통과
- [x] `npx next build` 성공 (모든 라우트 등록)
- [x] 기존 `/`, `/coupang`, `/ads` 페이지 회귀 없음
- [x] 7개 섹션 + full page 스크린샷 7장 `seo/screnshot/` 저장

## 비목표 (이번 라운드 제외)

- 라이브 크롤링·재감사 트리거 (Phase4 Sprint10에서 다룸)
- 운영 사이트 어떤 자동 게시도 하지 않음
- AI 챗 인터페이스 추가 안 함

## 다음 라운드 후보 (GSC 도메인 속성 권한 추가로 가능)

- URL별 GSC 노출/클릭을 url-policy 표에 합류 (canonical 정책 검증 데이터)
- 시범 페이지 4개의 GSC 시계열을 product-text 카드 옆에 부착 (텍스트 블록 추가 후 효과 가시화)
- 질문형 query 자동 추출 → JSON-LD 섹션의 FAQPage 추천 후보 자동 채움
- 운영 반영 baseline/포스트 7/14/28일 비교를 운영 체크리스트에 자동 부착
