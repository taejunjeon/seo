# `/total` 프론트엔드 1차 컨펌 요청

작성: 2026-05-04 23:45 KST · 작성자: Claude Code
짝 문서: [[total-frontend-handoff-20260504]] · [[total-api-contract-20260504]] · [[!total_past]]

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - total/!total.md
    - total/total-frontend-handoff-20260504.md
    - total/total-api-contract-20260504.md
  lane: Green
  allowed_actions:
    - frontend page 신규 작성 (read-only API 호출)
    - backend route 의 launchd 환경 호환성 한 줄 fix
    - 로컬 backend/frontend launchd 재시작 (사용자 명시 지시)
  forbidden_actions:
    - 운영 DB write/import
    - 광고 플랫폼 전환 송출
    - GTM 운영 게시
    - VM/원격 PG write
  source_window_freshness_confidence:
    source: "GET /api/total/monthly-channel-summary, dry-run scripts"
    window: "2026-04-01 ~ 2026-04-30 KST"
    freshness: "imweb/toss/attribution_vm fresh, Meta/Google fresh, TikTok local_cache, Naver/NPay/GA4 BQ blocked"
    confidence: 0.84
```

## 한 줄 결론

`/total` 화면이 로컬 7010 (production frontend) → 7020 (운영 backend, dry-run only) 경로로 동작합니다. **컨펌 진행 추천 (자신감 80%)**.

## 자신감 점수

| 영역 | 점수 | 근거 |
|---|---:|---|
| frontend tsc / build | 100% | `npm run build` 통과, `/total` 라우트가 prerendered static으로 등록 |
| backend route 응답 | 100% | `curl http://localhost:7020/...` HTTP 200, 16,070 bytes |
| 페이지 HTML 서빙 | 95% | `curl http://localhost:7010/total` HTTP 200, 페이지 제목 매칭 |
| 5가지 피드백 화면 반영 | 90% | 코드에 모두 박음. 표현 강도는 TJ 검토 전 |
| 핵심 데이터 정합성 | 85% | API 응답 키 직접 검증, 70k 차이 산식 일치 |
| 모바일 가독성 | 50% | CSS @media 작성. 실 단말 검증 미수행 |
| 운영 안정성 (응답속도) | 65% | dry-run cold start 16.4초. 동시 호출 부하 미검증 |
| **종합** | **80%** | |

**진행 추천 여부**: ✅ **추천**.
이유는 read-only dry-run 만 호출하고, 운영 DB write·플랫폼 송출이 0건이며, 7022 임시 backend 로 검증한 응답이 7020 에서도 동일하기 때문입니다. 단 dry-run cold start 가 16초인 점은 운영 운용 시 불편 요소이므로 컨펌 후 별도 sprint 에서 캐시화 검토를 권장합니다.

## 접속 주소 (로컬)

| 용도 | URL | 예상 응답 |
|---|---|---|
| 운영자 화면 | http://localhost:7010/total | 첫 화면 5개 지표 + 5가지 보완 사항 노출 |
| API 직접 호출 | http://localhost:7020/api/total/monthly-channel-summary?site=biocom&month=2026-04&mode=dry_run | JSON 16KB · 첫 호출 16초 cold start, 이후 캐시 없음 (매번 spawn) |

화면 우측 상단 `월:` 입력으로 다른 월(YYYY-MM)을 조회할 수 있습니다. site 는 현재 `biocom` 고정입니다.

## 무엇을 했는가

| # | 변경 | 영향 |
|---|---|---|
| 1 | `frontend/src/app/total/page.tsx` 신규 (587 라인) | `/total` 화면 본체. Client Component. fmtKRW 만·억 단위 |
| 2 | `frontend/src/app/total/page.module.css` 신규 (366 라인) | 카드/표/배지 스타일. @media 720/760/900px 분기 |
| 3 | `backend/src/routes/total.ts` 수정 (Codex 작성 기존 파일) | launchd 환경에서 `npm exec --` 가 ENOENT/ECONNRESET 으로 실패해 `node node_modules/.bin/tsx` 직접 호출로 교체. PATH 에 `process.execPath` 디렉토리 prepend |
| 4 | backend `dist/` 재빌드 + launchd `com.biocom.seo-backend-local` 재시작 | 운영 7020 backend 에 `/total` route 반영 |
| 5 | frontend launchd `com.biocom.seo-frontend-local` 재시작 | 새 build 픽업 |

## 왜 했는가

1. **TJ 5월 4일 PASS_WITH_NOTES 피드백** — `/total` 로컬 프론트 구현은 진행, 운영 배포는 별도 승인. 본 작업은 그 정확히 그 범위.
2. **handoff 문서 §완료 기준 6가지** — 첫 화면 5개 지표 / 참고값 라벨 / TikTok local_cache 경고 / Naver·NPay blocked / 합산 금지 / 모바일 가독.
3. **운영자 오해 방지** — TikTok ROAS 23.67 이 확정 성과처럼 보이지 않게, Naver 8,305 만이 Naver Ads 확정 매출처럼 보이지 않게, 70,000 원 차이가 미스터리로 남지 않게 화면에서 강하게 분리.

## 어떻게 했는가 (5가지 피드백 매핑)

| # | TJ 피드백 | 화면 반영 위치 | 코드 위치 |
|---|---|---|---|
| 1 | 70k 차이 산출 명시 | §"A/B 확정 vs 후보 차이" 카드 — confirmed_net_revenue_ab / net_revenue_candidate_including_c / excluded_from_ab(70,000원, reason: imweb_virtual_without_toss_review) 3-cell + toss_only_month_boundary_revenue 69,900 / quarantine_revenue_d 26,481 footnote | `page.tsx` §"A/B 확정 vs 후보 차이" 섹션 |
| 2 | sourceDiagnostics 배열 통일 | §"sourceDiagnostics (정규화 배열)" 표 + 용어집 — scope/source/freshness/window/importedRows/usableRows/warning/budgetDecisionImpact 컬럼 | `normalizeDiagnostics()` 헬퍼. TikTok `dailyTable.{importedRows, rows, minDate, maxDate}` + `warnings[]`, Meta/Google `accountId/customerId, rows` 흡수 |
| 3 | TikTok 23.67 강경고 | PlatformCard `isTikTokWarn` 노란 박스 — "값은 로컬 cache 기준이며, 구매값은 한국어 export 의 중복 구매 헤더를 추정한 결과입니다. Ads Manager 원본 대조 전까지 ROAS 23.67 은 예산 판단에 사용하지 마세요. reference_only." | `PlatformCard` 컴포넌트 |
| 4 | fresh = 플랫폼 source 최신 (정본 매출 X) | 상단 배너 §2번 항목 + Source freshness 표 헤더 small + sourceDiagnostics 표 글로서리 박스 | 상단 `warningBanner` + 표 헤더 small + `glossary` |
| 5 | Naver = NaPm 후보, NPay = matched/unmatched 보류 | 채널 표 인라인 라벨 (`paid_naver`: "NaPm 클릭ID 또는 paid UTM 기반 내부 후보 — Naver Ads 확정 매출 아님"; `npay`: "intent source 연결 전까지 matched/unmatched 확정 보류") + Naver PlatformCard `blocked` 빨간 박스 + 상단 배너 §4·§5 | 채널 표 행 + PlatformCard + warningBanner |

## TJ 컨펌 체크리스트

화면 (http://localhost:7010/total) 을 열고 아래 8가지를 확인해주세요.

- [ ] **C1. 상단 5줄 배너** — 5가지 보완 사항이 한눈에 읽히는가? 문장 강도 OK?
- [ ] **C2. 핵심 KPI 5개** — 내부 확정 순매출 ₩4억 9,983만 + 분류 완료 ₩3억 2,791만 + 미분류 ₩1억 7,192만 + 채널 5 + Source 경고 (있으면 카운트). 모바일에서 접힘 없이 읽히는지 단말로 확인 부탁
- [ ] **C3. 70k 차이 카드** — `excluded_from_ab` reason 이 `imweb_virtual_without_toss_review` 로 명시. 설명이 운영자가 이해 가능한가?
- [ ] **C4. 채널별 매출 표** — `paid_naver` 행에 NaPm 후보 라벨, `npay` 행에 보류 라벨, `unknown` 행에 "유입 증거 부족 — 매출이 없는 게 아님" 라벨이 보이는가? 라벨 강도 적정?
- [ ] **C5. TikTok PlatformCard** — 노란 강경고 박스가 충분히 강한가? "ROAS 23.67 예산 판단 사용 금지" 문구가 운영자가 무시 못 할 수준?
- [ ] **C6. Naver PlatformCard** — `unavailable / blocked` 빨간 박스, 광고비·플랫폼 주장값·ROAS 가 `-` 로 표시되는지
- [ ] **C7. Source freshness 표** — 9개 source(imweb/toss/attribution_vm/npay_intent/ga4_bigquery_raw/platform_meta/platform_tiktok/platform_google/platform_naver) 가 모두 보이고 색 구분 OK?
- [ ] **C8. sourceDiagnostics 정규화 표** — TikTok 행에 imported 346 / usable 224 / warning "한국어 export의 중복 구매 헤더를 구매값으로 추정…" / `reference_only` 가 보이는가?

## TJ에게 요청드리는 결정

1. **컨펌 (위 C1~C8 OK)** → 다음 sprint 에서 (a) 화면 운영 배포 PR 작성 (b) `/api/total/monthly-channel-summary` 응답 캐시화 (현재 매 호출 16초 cold start) (c) Codex 가 sourceDiagnostics 배열 정규화를 backend 에서 수행하면 frontend `normalizeDiagnostics()` 제거.
2. **수정 요청** → 어느 항목 (C1~C8 + 추가 자유) 의 표현·강도·순서를 어떻게 바꿀지 알려주시면 즉시 반영.
3. **롤백** → 이번 sprint 의 변경은 모두 로컬. `git checkout -- backend/src/routes/total.ts && rm -rf frontend/src/app/total` + frontend/backend 재빌드·재시작 1회로 원복. 운영 DB / 광고 플랫폼 / GTM 영향 0 건.

## 알려진 리스크 / 한계

| 항목 | 영향 | 권장 대응 |
|---|---|---|
| dry-run cold start 16.4초 | 운영자 첫 클릭 시 답답함. 동시 N명이면 process spawn 부하 | 컨펌 후 별도 sprint: in-process 캐시 (5~10분 TTL) 또는 dry-run 결과를 SQLite 에 적재 |
| 모바일 가독성 미검증 | iPhone 등 좁은 화면에서 KPI 5열이 2열로 접히는데 실 단말 미확인 | TJ 가 휴대폰으로 한 번 열어주시고 캡처 공유 |
| backend route 코드 라이브 fix 1줄 | `runDryRunScript` 가 process.execPath 절대 경로 + tsx 절대 경로 사용. 다른 환경(예: tsx 위치 변경) 깨질 수 있음 | 향후 dry-run 결과를 일반 모듈로 import (script 자체를 함수로 export) 하면 spawn 자체 제거 가능 |
| 운영 7020 dry-run 호출이 read-only 라고 가정 | `monthly-spine-dry-run.ts` / `monthly-evidence-join-dry-run.ts` 가 운영 PG 에 SELECT 만 하는지 직접 코드 확인은 함. 다만 attribution VM 호출 등 외부 부하는 발생 | 호출 빈도 모니터링 |
| Naver `paid_naver` 매출 ₩8,305만 라벨 강도 | 채널 표 + PlatformCard + 배너 3 군데 라벨 박았지만 운영자가 `paid_naver` 라는 이름만 보고 "Naver Ads 확정"으로 오해할 가능성 | TJ 컨펌 후 라벨 강도 조정 또는 채널 키 자체를 `naver_napm_candidate` 로 rename 검토 |
| frontend NEXT_PUBLIC_API_BASE_URL 빌드 박힘 | 7010 production 은 빌드 시점 envar 가 박혀 동작. 현재 7020 가리키도록 빌드된 상태 (curl 확인) | 변경 불필요 |

## 변경 파일 목록 (재확인용)

```text
A frontend/src/app/total/page.tsx
A frontend/src/app/total/page.module.css
M backend/src/routes/total.ts            # launchd ENOENT fix (npm exec → tsx 직접 호출)
M backend/dist/...                       # tsc 산출물 (gitignore 가정)
```

## 다음 액션 (우선순위 순)

1. **TJ**: `http://localhost:7010/total` 접속 → C1~C8 체크 → 컨펌 또는 수정 지시.
2. **TJ**: 모바일 단말로도 한 번 열어서 KPI 5개 가독성 확인.
3. **(컨펌 시) Claude Code**: 운영 backend route 캐시화 sprint 착수.
4. **(컨펌 시) Codex**: 응답에 `sourceDiagnostics` 배열을 §"정규화 배열" 스키마로 통일 → frontend 헬퍼 제거.
5. **(보류) TJ**: 운영 배포 (= 외부에서 `/total` 접근) 결정. 본 sprint 범위 아님.

## 변경 기록

| 시각 | 변경 |
|---|---|
| 2026-05-04 23:45 KST | 최초 작성. /total 로컬 화면 구현 + 백엔드 launchd 호환 fix + TJ 컨펌 체크리스트 |
