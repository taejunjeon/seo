# VM 별도 imweb API sync 검토 (운영DB 9시간 lag 보완)

작성 시각: 2026-05-11 00:42:00 KST
Lane: Green 검토 / 코드/배포 0
자신감: 86% (imweb v2 페이지네이션 이상 + raw PII 정책 결정이 미지)

## 한 줄 결론

이미 backend에 imweb v2 Open API sync 로직(`/api/crm-local/imweb/sync-orders`)이 있고 로컬DB `imweb_orders` 테이블에 누적 중이오. **VM 별도 sync는 가능하지만, 더 먼저 권장은 (a) backend imweb sync cron을 더 자주 돌리는 것 + (b) dashboard 응답에 운영DB freshness 라벨 추가**요. 운영DB 9시간 lag는 보고에 노출되면 운영 의사결정에는 충분하고, 별도 VM sync는 비용/복잡도가 크오.

## 평가 축

### 1. 이미 존재하는 imweb sync 자산

| 항목 | 위치 | 상태 |
|---|---|---|
| 인증 토큰 발급 | `POST https://api.imweb.me/v2/auth` | 사용 중 |
| 회원 sync | `GET https://api.imweb.me/v2/member/members` | 운영 OK (3사이트) |
| **주문 sync** | `GET https://api.imweb.me/v2/shop/orders` | 사용 중 (페이지네이션 이상 알려짐) |
| 신규 OpenAPI | `GET https://openapi.imweb.me/orders` | **401 — 권한 문제** |
| backend route | `/api/crm-local/imweb/sync-orders` | 이미 존재 |
| 적재 위치 | 로컬DB `backend/data/crm.sqlite3` `imweb_orders` 테이블 | 운영 중 |
| 한계 | 주문 헤더 중심. 상품 라인아이템 없음. 페이지네이션 빈 페이지 섞임. |

문서: `imwebapi.md` (257줄, 전체 정본).

### 2. VM 별도 sync 가능성

| 항목 | 값 |
|---|---|
| 방식 | VM Cloud에서 `IMWEB_API_KEY*` 사용해 같은 v2 API 직접 호출 |
| 적재 위치 | VM Cloud SQLite 안 신규 테이블 (`imweb_orders_vm_sync` 또는 동등) |
| 주기 후보 | 5분 / 15분 / 30분 cron |
| Rate-limit | imweb v2는 정확한 분당 제한이 문서화 안 됨. 현재 backend에서도 일정 페이지마다 토큰 갱신 + 재시도 로직 있음. |
| 페이지네이션 이상 | 더클린커피 `data_count` 대비 회수율 낮음 — VM에서도 같은 문제 재현 가능 |
| raw PII 정책 충돌 | VM Cloud SQLite에 raw email/phone/order 저장 — 현재 정책: VM은 hash-only ledger만 (Path B 정책). raw 저장은 별도 정책 검토 필요 |
| 보안 | API key를 VM에 추가 배포 — 키 회전·관리 가중 |

가능성 verdict: **YES (기술적으로 가능)** — 그러나 raw PII 정책과 rate-limit 관리가 추가 부담.

### 3. 더 가벼운 대안 3가지

#### A. backend imweb sync cron을 더 자주 돌리기

| 항목 | 값 |
|---|---|
| 변경 범위 | 기존 `/api/crm-local/imweb/sync-orders` 호출을 cron 또는 dispatcher로 5분 주기 호출 |
| 적재 위치 | 로컬DB `imweb_orders` (이미 동작) |
| 효과 | 로컬DB freshness ↑. 운영DB는 그대로 두되, 본 backend가 imweb 직접 fetch한 row를 보조 source로 사용 가능 |
| 위험 | imweb v2 rate-limit. 페이지네이션 이상이 cron마다 재현되면 데이터 갭. |
| Lane | Green (cron 추가) → Yellow (운영 cron 등록) |

#### B. dashboard 응답에 운영DB freshness 라벨 추가

| 항목 | 값 |
|---|---|
| 변경 범위 | `/api/google-ads/dashboard` 응답에 `operationalDbFreshness: { maxOrderDateKst, syncLagMinutes }` 추가 |
| 효과 | 운영자가 "지금 보고 있는 209건은 9시간 sync lag 기준"이라는 걸 화면에서 직접 인지 |
| 위험 | 0 (read-only 메타데이터만 추가) |
| Lane | Green code |

#### C. 운영DB sync 주기 단축을 개발팀에 요청

| 항목 | 값 |
|---|---|
| 변경 범위 | 개발팀 운영DB ETL/sync 정책 변경 |
| 효과 | 9시간 → 1시간 또는 15분 lag로 회복 |
| 위험 | 개발팀 영역, 협의 필요 |
| Lane | TJ ↔ 개발팀 커뮤니케이션 |

## 비교 표

| 옵션 | 자유도 | 위험 | 즉시성 | 추천 |
|---|---|---|---|---|
| **A. backend cron 자주** | 중 | rate-limit 관리 | 중 | 1순위 (Claude Code 단독 가능) |
| **B. freshness 라벨** | 낮음 | 0 | 즉시 | 2순위 (병행 진행, 가장 가벼움) |
| **C. 개발팀 sync 단축** | 협의 의존 | 0 | 협의 후 | 3순위 (TJ ↔ 개발팀) |
| **D. VM 별도 imweb sync** | 높음 | rate-limit + raw PII 정책 + 키 관리 | 즉시 | 4순위 (D는 A/B/C가 다 막힐 때) |

## 사용자 명령에 대한 답

> "운영db 싱크가 너무 늦다면, vm에 아임웹 api 로 싱크 별도 할지 검토"

**검토 결과: VM 별도 sync는 가능하나 마지막 카드**. 의사결정 순서 추천:

1. **B. dashboard 응답에 freshness 라벨 추가** — Claude Code 즉시 진행 가능 (Green code, 자신감 92%)
2. **A. backend imweb sync cron 자주 돌리기** — 기존 자산 재사용, rate-limit 점검 필요 (Green code → Yellow cron, 자신감 84%)
3. **C. 개발팀에 운영DB sync 주기 단축 요청** — TJ가 개발팀과 협의 (자신감 80%, 협의 결과 의존)
4. **D. VM 별도 imweb sync** — A/B/C가 모두 막힐 때만 (Yellow → 신규 sync 인프라, 자신감 70%)

## 추가 검토 사항 (다음 sprint)

- imweb v2 페이지네이션 이상 재현 — `/api/crm-local/imweb/pagination-anomalies` 라우트로 진단 (이미 존재)
- imweb 신규 OpenAPI(`openapi.imweb.me/orders`) 401 원인 — OAuth 자격증명 갱신 필요한지
- VM Cloud SQLite raw PII 저장 정책 — 현재 hash-only 정책과 충돌하지 않는 컬럼 설계
- dashboard 응답 `operationalDbFreshness` 라벨에 추가할 metric 종류 (max(order_date), sync_lag_minutes, max(payment_complete_time))

## 다음 액션

### Claude Code가 할 일

1. **B. dashboard 응답에 운영DB freshness 라벨 추가 (가장 가벼움)**
   - 추천: 진행 추천
   - 자신감: 92%
   - Lane: Green code
   - 무엇을: `/api/google-ads/dashboard` 응답에 `operationalDbFreshness` 객체 추가 (maxOrderDateKst, maxPaymentCompleteKst, syncLagMinutes)
   - 왜: NPay 209건 같은 카운트가 9시간 sync lag 기준이라는 걸 운영자가 화면에서 직접 보게
   - 어디에서: `backend/src/routes/googleAds.ts` (이미 `npayActualCorrection` 옆에 추가)
   - 성공 기준: 응답에 maxOrderDateKst와 lag minute가 노출 + frontend에 작은 freshness chip 추가
   - 의존성: 본 검토 산출물 + 현재 NPay correction wire (commit b12c4c9)

2. **A 사전 검토 — backend imweb sync cron 등록 가능 여부**
   - 추천: 검토 후 진행
   - 자신감: 84%
   - Lane: Green 검토 → Yellow cron
   - 무엇을: `/api/crm-local/imweb/sync-orders` 를 5분 또는 15분 주기로 호출하는 cron 또는 dispatcher 등록 가능 여부 + rate-limit 추정
   - 의존성: B 진행 후 또는 병행

### TJ님이 할 일

1. **C. 개발팀과 운영DB sync 주기 협의** (병행)
   - 추천: 진행 추천
   - 자신감: 80%
   - Lane: TJ ↔ 개발팀
   - 무엇을: 현재 운영DB sync 주기와 단축 가능성 확인
   - 성공 기준: lag 9시간 → 1시간 이하

2. **D 결정 보류** — A/B/C 결과 본 후 별도 sprint에서 결정

## Verdict

`VM_DIRECT_SYNC_FEASIBLE_BUT_FRESHNESS_LABEL_FIRST_THEN_BACKEND_CRON_THEN_DEV_TEAM_THEN_VM_SYNC`
