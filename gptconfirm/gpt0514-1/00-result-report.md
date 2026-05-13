# gpt0514-1 Result Report

작성 시각: 2026-05-14 00:55 KST
Owner: Codex
Lane: Green read-only local code, dry-run, frontend local patch.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
  required_context_docs:
    - docurule.md
    - frontrule.md
    - docs/report/text-report-template.md
    - data/!data_inventory.md
    - project/total.md
  lane: Green
  allowed_actions:
    - local backend/frontend code patch
    - read-only dry-run
    - VM Cloud read-only API query
    - local API smoke
    - docs and gptconfirm package
  forbidden_actions:
    - operational DB write/import
    - VM Cloud SQLite write/schema migration
    - external platform send/upload
    - Google Ads conversion upload
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: "운영DB monthly actual spine + VM Cloud attribution_ledger + 로컬DB 보조 캐시"
    window: "2026-05-01 <= KST < 2026-06-01"
    freshness: "2026-05-14 00:55 KST local smoke"
    confidence: "B+"
```

## 이번에 가능해진 것

TJ님이 `/total`의 “어디서 왔는지 모르는 매출”을 그냥 큰 숫자로 보지 않고, 무엇을 고치면 줄어드는지 5개 blocker로 볼 수 있게 했다. 네이버 검색으로 들어온 것처럼 보이는 흔적도 자연검색과 유료 표식을 분리해서, 잘못 자연검색 매출로 올리지 않게 막았다.

## 완료한 것

- backend dry-run contract를 `monthly-evidence-join-dry-run-v0.5`로 갱신.
- `/total` API에 `unknown_reason_details`, `naver_organic_evidence`, `subscription_acquisition_summary`를 연결.
- frontend `/total`에 미분류 매출 세부 원인, 네이버 검색 근거, 구독/정기결제 분리 안내를 표시.
- `/total` 기본 조회 월을 Asia/Seoul 기준 현재 월로 변경.
- 2회차 이후 구독/정기결제는 유입 분석 대상에서 빼고 별도 구독 매출로 분리.
- `project/total.md`, `gdn/current-handoff.md`, `data/current-state.json` 업데이트.

## 실제 숫자

- 바이오컴 2026년 5월 actual spine: 941건 / 204,006,680원.
- 분류된 매출: 431건 / 80,373,978원.
- 아직 모르는 매출: 510건 / 123,632,702원.
- 가장 큰 blocker: 결제완료 신호 key 정규화/coverage 문제 334건 / 89,337,146원.
- 네이버 검색 referrer 144건은 모두 `NaPm` 또는 브랜드검색 표식이 있어 자연검색 매출로 분류하지 않음.
- 2회차 이후 구독/정기결제: 125건 / 5,441,500원.

## 하지 않은 것

- 운영DB write/import 하지 않음.
- VM Cloud SQLite write/schema migration 하지 않음.
- 운영 frontend/backend deploy/restart 하지 않음.
- GA4/Meta/Google Ads/TikTok/Naver 전환 send/upload 하지 않음.
- GTM publish 하지 않음.
- raw email/phone/member_code/주문번호/결제키/click id 값 출력하지 않음.

## 검증 결과

- backend typecheck: PASS.
- frontend build: PASS.
- local dry-run JSON: PASS.
- local `/api/total/monthly-channel-summary?site=biocom&month=2026-05&mode=dry_run`: PASS.
- local `/total` HTML smoke: PASS.
- Playwright local smoke: PASS, 2026-05 기본 월과 blocker/Naver/subscription label 확인.
- no-send/no-write/no-publish: PASS.

## 현재 영향/서버·커밋 상태

- 로컬 코드와 문서만 변경했다.
- 운영 배포/restart 없음.
- 외부 플랫폼 전송 0.
- 커밋/푸시는 하지 않았다.
- 로컬 frontend: `http://localhost:7010/total`.
- 로컬 backend: `http://localhost:7020`.

## 남은 리스크

- 운영 화면에는 이번 frontend/backend 패치가 아직 배포되지 않았다.
- Naver Search Advisor는 검색어/page/day aggregate라 주문 단위 매출 증명으로 쓸 수 없다.
- 네이버 자연검색 주문 단위 strong evidence는 현재 0원이다. VM Cloud에는 네이버 referrer가 있지만 대부분 유료 표식이다.
- 구독 첫 시작의 과거 유입은 archive lookup 설계가 필요하다.

## 확인하면 좋은 문서

1. `gptconfirm/gpt0514-1/01-unknown-revenue-drilldown.md` — unknown 매출이 어떤 blocker로 쪼개졌는지 숫자를 확인하는 문서.
2. `gptconfirm/gpt0514-1/02-naver-organic-and-search-tools.md` — 네이버 자연검색, Search Advisor, GA4, Braze의 역할 차이를 확인하는 문서.
3. `gptconfirm/gpt0514-1/03-next-actions-and-approval.md` — 다음 운영 반영과 추적 보강 우선순위를 확인하는 문서.

## 다음 할일

### Codex가 할 일

1. 운영 반영 승인안 작성
- Codex 추천: 진행 추천.
- 추천 이유: 로컬 typecheck/build/API smoke가 통과했고, 운영에 올리면 `/total`에서 바로 blocker table을 볼 수 있다.
- 추천 방향에 대한 자신감: 88%.
- Lane: Yellow.
- 무엇을 하는가: `/total` backend/frontend 패치를 VM Cloud 운영에 배포하는 승인안을 만든다.
- 왜 하는가: 로컬에서만 보이면 TJ님과 팀이 실제 화면에서 unknown 개선 우선순위를 볼 수 없다.
- 어떻게 하는가: pre-snapshot, 파일 백업, build/typecheck, restart, post-snapshot, rollback 조건을 문서화한다.
- 성공 기준: 운영 `/total`에서 unknown 세부 원인과 네이버 evidence가 보이고 summary API 200.
- 실패 시 해석/대응: API 5xx, raw identifier 노출, 숫자 합계 불일치가 있으면 rollback.
- 승인 필요: 문서 작성은 NO, 실제 배포는 YES.

2. 구독 최초 유입 archive lookup 설계
- Codex 추천: 진행 추천.
- 추천 이유: 2회차 이후 구독 매출은 분리됐고, 남은 첫 구독 26건 / 1,000,875원의 원인을 더 줄일 수 있다.
- 추천 방향에 대한 자신감: 82%.
- Lane: Green 설계/read-only.
- 무엇을 하는가: 과거 첫 구독 시작 유입을 raw 값 없이 내부 join 가능한 key로 찾는 dry-run을 설계한다.
- 성공 기준: archive lookup 가능/불가능/키 부족이 aggregate로 분리된다.
- 승인 필요: NO.

### TJ님이 할 일

1. 운영 배포 여부 승인
- Codex 추천: 승인 추천.
- 추천 이유: 이번 패치는 read-only 화면/집계 표시 개선이며, 광고 전송이나 DB write가 없다.
- 추천 방향에 대한 자신감: 88%.
- Lane: Yellow.
- 무엇을 승인하는가: `/total` unknown drilldown v0.3 backend/frontend 운영 배포.
- 왜 필요한가: 현재 운영 화면이 아니라 로컬 화면에만 보인다.
- 어떻게 확인하나: 승인 후 `https://biocom.ainativeos.net/total`에서 미분류 매출 세부 원인과 네이버 evidence table 확인.
- 성공 기준: 바이오컴 2026년 5월 unknown 510건 / 123,632,702원과 5개 blocker가 표시된다.
- 실패 시 다음 확인점: 운영 API 응답, source freshness, rollback snapshot.
- Codex가 대신 못 하는 이유: 실제 운영 반영은 Yellow Lane이라 TJ님 승인이 필요하다.
