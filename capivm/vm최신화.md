# `/ads` + `/crm` 프론트엔드 VM 전환 검토

기준일: 2026-04-14 · 작성: Claude Code
관련 문서: [capi.md](/Users/vibetj/coding/seo/capivm/capi.md) · [vmdeploy.md](/Users/vibetj/coding/seo/capivm/vmdeploy.md) · [roadmap0327.md](/Users/vibetj/coding/seo/roadmap/roadmap0327.md)

## 0. 이 문서가 다루는 질문

> "프론트엔드(`localhost:7010`)가 로컬 백엔드(`localhost:7020`) 대신 VM 백엔드(`https://att.ainativeos.net`)를 바라보게 전환하는 것이 맞는가?"

2026-04-12 CAPI 가드 v3 + VM cutover 이후 로컬 노트북 백엔드는 `attributionStatusSync.enabled = false`, `capiAutoSync.enabled = false`로 설정되어 있어 ledger가 2026-04-12 이후 멈춰 있다. 반면 VM은 sync가 켜진 채 실시간으로 이벤트를 받고 있어 `/ads` 페이지의 attribution 카드들이 "2026-04-12까지만" 같은 상태를 보인다.

결론부터: **배포 없이 지금 당장 전환하면 `/crm` 페이지가 대거 깨진다. 단계적 접근이 필요하다.**

---

## 1. 핵심 발견 — VM 백엔드는 구버전이다

2026-04-14 02:19 KST 시점 VM 라우트 가용성 스캔 결과.

| 라우트 | VM (`att.ainativeos.net`) | 로컬 (`localhost:7020`) |
|---|---|---|
| `GET /health` | ✅ 200 | ✅ 200 |
| `GET /api/meta/insights` | ✅ 200 (Meta Graph API 직접 호출, 결과 동일) | ✅ 200 |
| `GET /api/ads/site-summary` | ✅ 200 **실시간 데이터** | ✅ 200 (로컬 ledger 기반, 2026-04-12까지만) |
| `GET /api/attribution/ledger` | ✅ 200, 2026-04-13 첫 200건 중 200건 | ✅ 200, 2026-04-12까지만 |
| `GET /api/crm-local/groups` | ✅ 200 (구버전, `kind` 필터 미지원) | ✅ 200 (Phase D 확장) |
| `GET /api/crm-local/groups/stats` | ❌ **404 Route not found** | ✅ 200 |
| `GET /api/crm-local/scheduled-sends` | ❌ **404** | ✅ 200 |
| `GET /api/crm-local/consent-audit` | ❌ **404** | ✅ 200 |
| `GET /api/crm-local/segments` | ❌ **404** | ✅ 200 |

VM은 **Phase C/D/E 변경 전 버전**의 백엔드를 돌리고 있다. 즉 이 세션에서 추가한 다음 기능이 VM엔 없다.

- contact-policy severity 3단계 enforcement (`evaluateForEnforcement`, LH/PH/SO rule)
- 수동 consent 변경 API (`/api/crm-local/consent-audit/manual`)
- 다중 오류 `errors[]` 리턴
- 그룹 `group_kind` / `source_ref` / `archived_at` 컬럼 + `canArchiveGroup` 가드
- `/api/crm-local/groups/stats`, `/api/crm-local/groups/:id/archive`
- 세그먼트 빌더 DSL (`crm_saved_segments` + `/api/crm-local/segments/*`)
- 예약 발송 스케줄러 (`crm_scheduled_send`)
- 엑셀 업로드 `/api/crm-local/groups/:id/members/bulk-upload`

또한 VM의 `crm.sqlite3`에는 **이번 세션에서 만든 그룹·세그먼트·예약·감사 로그가 존재하지 않는다**. 로컬 `data/crm.sqlite3`에만 있다.

### 로컬 sync 상태

```text
localhost:7020/health
  backgroundJobs.attributionStatusSync.enabled = false
  backgroundJobs.capiAutoSync.enabled = false

att.ainativeos.net/health
  backgroundJobs.attributionStatusSync.enabled = true
  backgroundJobs.capiAutoSync.enabled = true
```

VM cutover 당시 의도적으로 로컬을 끄고 VM만 켠 구성이다. 되돌리면 split-brain(양쪽에서 같은 이벤트를 Meta로 중복 전송)이 되므로 로컬 sync는 다시 켜면 안 된다.

### CORS는 이미 열려 있다

`backend/src/bootstrap/configureMiddleware.ts`의 `allowedOrigins`에 `http://localhost:7010`이 포함되어 있어 VM에 직접 호출하면 `Access-Control-Allow-Origin: http://localhost:7010` 헤더를 돌려준다. 프론트 전환 자체에 CORS 장벽은 없다.

---

## 2. 시나리오별 평가

### 시나리오 A — 프론트 전체를 VM으로 즉시 전환

`frontend/.env.local`에 `NEXT_PUBLIC_API_BASE_URL=https://att.ainativeos.net` 추가 후 dev 재시작.

**장점**
- `/ads` attribution·CAPI·ROAS 값이 실시간 운영 데이터로 보임
- 운영 headline / KPI / 데일리 차트가 최근 48시간 실 데이터 반영

**단점 (차단 수준)**
- `/crm` 수신거부 처리 탭 404
- 고객 그룹 탭의 임시 그룹 토글·통계 배지 404, `kind=all` 미지원
- 예약 발송 탭 404
- 고객 행동 탭 "커스텀 세그먼트 만들기" 404
- 이번 세션에서 만든 모든 Phase B/C/D/E 기능 사용 불가
- Playwright `test:crm` 26건 중 상당수 실패 예상

**판정**: **Do not** — 현재 VM 코드 상태에서는 불가.

---

### 시나리오 B — `/ads`만 VM, `/crm`은 로컬 (경로별 분기)

페이지별로 하드코딩된 API base를 분리하거나, 라우트 prefix로 dispatch.

**장점**
- `/ads`는 실시간, `/crm`은 최신 기능 양립

**단점**
- 개발자/운영자가 "지금 어느 백엔드 보고 있지?" 혼란 가중
- `NEXT_PUBLIC_API_BASE_URL` 단일 상수로는 구현 불가 — 페이지마다 override 필요
- 구현 복잡도가 현재 "CAPI 카드만 VM 직결" 방식(시나리오 D)과 본질적으로 같음. 추가 이득 작음

**판정**: 현재 방식 대비 유의미한 개선 없음.

---

### 시나리오 C — 백엔드를 VM에 배포한 뒤 전체 VM 전환 (**권장**)

코드 배포 + 필요한 경우 `crm.sqlite3` 파일 이관 → 프론트 env 전환.

**장점**
- 장기적 단일 진실 원천 확보
- VM에서 스케줄러·cron 자동화가 실제로 돌아 운영 자동화 성립
- `/ads` + `/crm` 모두 실시간 운영 데이터 일관성

**작업 비용**
1. 현재 로컬 commits를 origin에 push (로컬 main은 20 commits ahead 상태)
2. `capivm/deploy-backend-rsync.sh`로 VM에 rsync 배포
3. VM에서 `cd /opt/seo/backend && npm ci && pm2 restart seo-backend`
4. `curl https://att.ainativeos.net/api/crm-local/groups/stats`가 200 돌려주는지 확인
5. 필요 시 로컬 `data/crm.sqlite3`를 VM으로 rsync (이번 세션 작업물 이전)
6. `frontend/.env.local`에 `NEXT_PUBLIC_API_BASE_URL=https://att.ainativeos.net` 추가
7. `npm run dev` 재시작, `/ads`·`/crm` 수동 스팟 체크
8. CAPI 카드의 VM 직결 특수 로직(`CAPI_VM_BASE`) 원상 복구 — 이제 기본 API_BASE가 VM이므로 중복

**리스크**
- CRM sqlite 이관 시점에 pm2 stop이 필요 → 수십 초 downtime
- `deploy-backend-rsync.sh`가 `data/` 디렉터리를 제외하는지 먼저 확인해야 함 (제외해야 기존 VM 데이터 보존)
- 배포 직후 VM에서 `ensureColumn` 마이그레이션이 돌면서 기존 `crm_customer_groups` 행을 backfill (Phase D 규약대로 `재구매%` → `repurchase_temp`)

**실 작업 시간 예상**: 1~1.5시간 (검증 포함)

**판정**: **최종 정답**. 단 지금 당장 급하진 않다.

---

### 시나리오 D — 현 상태 유지 (로컬 + 카드 단위 VM 직결) **현재 상태**

`/ads` CAPI 카드만 `CAPI_VM_BASE` 상수로 VM 직접 호출, 나머지는 로컬.

**장점**
- 가장 중요한 관측 지표(CAPI 스냅샷 이후 격차)는 실시간
- CRM·Phase 기능 그대로 작동
- Playwright 26건 모두 그린

**단점**
- `/ads` 운영 headline / KPI / 데일리 차트 / campaign 테이블은 여전히 로컬 ledger 기반이라 "최근 7일 confirmed ROAS" 값이 과소 집계
- 장기 유지 불가능

**판정**: D+3 CAPI 초기 신호 확인 전까지의 **임시 안정 상태**.

---

### 시나리오 E — 로컬 sync 다시 켜기

로컬 `.env`에서 `ATTRIBUTION_STATUS_SYNC_ENABLED=true`, `CAPI_AUTO_SYNC_ENABLED=true` 복원.

**단점 (차단 수준)**
- VM과 로컬에서 동시에 CAPI 전송 → Meta 이벤트 중복
- `pending -> confirmed` 상태 동기화가 양쪽에서 경합
- 2026-04-12 VM cutover의 의도(single active origin) 무효화

**판정**: **Do not**.

---

## 3. 권장 실행 순서

### 3-1. 지금 (2026-04-14)

- **시나리오 D 유지** (이미 적용됨)
- 선택적 보강: `/ads` 운영 headline / KPI 카드도 VM 직결로 확장 (30분 내 작업)
  - 현재 CAPI 카드와 동일한 패턴으로 `CAPI_VM_BASE` 사용
  - 다른 페이지·CRM은 로컬 유지
  - 임시방편이라는 점을 카드에 명시 (data source: VM 표기)

### 3-2. D+3 (2026-04-16 아침) CAPI 초기 신호 확인 직후

- 시나리오 C 실행 시점 검토
- 이 때가 "CAPI 가드가 의도대로 작동하는지"의 1차 판정 시점이라 배포 여유가 생긴다
- 배포 직전 로컬 `test:crm` 26건 녹색 + tsc 녹색 재확인

### 3-3. 시나리오 C 배포 상세 절차

```bash
# 1. 현재 로컬 상태 확인
cd /Users/vibetj/coding/seo
git status --short
git log --oneline origin/main..HEAD   # 20 commits ahead

# 2. origin에 push
git push origin main

# 3. VM 배포 스크립트 내용 확인 (data/ 제외 여부)
cat capivm/deploy-backend-rsync.sh | grep -E "exclude|data"

# 4. 로컬 crm.sqlite3 백업
cp backend/data/crm.sqlite3 backend/data/crm.sqlite3.bak_$(date +%Y%m%d_%H%M)

# 5. VM에 코드 배포
bash capivm/deploy-backend-rsync.sh

# 6. VM SSH 접속해서 install + restart
ssh vm "cd /opt/seo/backend && npm ci && pm2 restart seo-backend && pm2 logs seo-backend --lines 20"

# 7. VM 라우트 재검증
curl https://att.ainativeos.net/api/crm-local/groups/stats
curl https://att.ainativeos.net/api/crm-local/segments?site=thecleancoffee
curl https://att.ainativeos.net/api/crm-local/scheduled-sends?limit=1

# 8. (선택) CRM sqlite 이관
#   - pm2 stop seo-backend on VM
#   - rsync backend/data/crm.sqlite3 vm:/opt/seo/backend/data/
#   - pm2 start seo-backend on VM
#   - attribution-ledger.sqlite3는 절대 이관 금지 (VM이 live 데이터)

# 9. 프론트 전환
echo "NEXT_PUBLIC_API_BASE_URL=https://att.ainativeos.net" > frontend/.env.local
# dev 서버 재시작

# 10. /ads · /crm 수동 스팟 체크
# - /crm 수신거부 처리 탭 → 감사 로그 1건 이상 보이는지
# - /crm 고객 그룹 탭 → 임시 그룹 토글 작동하는지
# - /ads 바이오컴 탭 → headline ROAS 값이 최근 48시간 반영하는지
# - /ads CAPI 카드 → 기존과 동일

# 11. CAPI 카드 VM 직결 특수 로직 원상 복구
# frontend/src/app/ads/page.tsx에서 CAPI_VM_BASE 제거, fetch URL을 API_BASE로 환원

# 12. Phase A test:crm 실행 (VM 대상)
#   PLAYWRIGHT_API_BASE=https://att.ainativeos.net npm run test:crm
#   (현재 test-helpers.ts는 localhost 하드코딩이므로 별도 env 분기 필요)
```

### 3-4. 배포 후 주의

- 로컬 노트북은 "개발 전용 스크래치 공간"으로 역할 변경
- 로컬에서 코드 수정 → 저장 → VM에 재배포해야 변경 반영
- 로컬 `npm run dev` 프론트는 계속 써도 무방 (env 변수만 VM 가리키면 됨)
- CAPI 이벤트 흐름: Browser → `att.ainativeos.net/api/attribution/ingest` → VM sqlite → 30분 cron → Meta CAPI

---

## 4. 대안 — 배포 없이 임시 보강

시나리오 C가 부담스러우면 시나리오 D를 확장:

- `/ads` 운영 headline 카드를 VM 직결로 교체
- `/ads` KPI 그리드 (노출/클릭/비용/CPC/랜딩/전환)를 VM 직결로 교체
- `/ads` 전환 상세 + 전환 매출 4카드를 VM 직결로 교체
- 데일리 차트·campaign 테이블은 Meta API 직접 호출이라 이미 정확

이 경우 `/ads`의 "바이오컴 상세" 섹션 전체가 시각적으로 VM 데이터를 보게 되고, `/crm`과 `/ads`의 실험 운영 섹션만 로컬 기반으로 남는다. 임시방편이라는 점을 문서와 카드 하단 footnote로 명시.

---

## 5. 최종 제언

1. **지금 당장**: 시나리오 D 유지. CAPI 카드만 VM 직결 방식 그대로.
2. **30분 여유가 생기면**: 시나리오 D 확장 — `/ads` 상세 섹션의 headline·KPI·전환 매출 카드도 VM 직결로 바꿔 `/ads` 페이지 전체의 숫자 정합성 확보.
3. **D+3 이후 여유가 생기면**: 시나리오 C 실행. 이때가 CAPI 가드의 1차 판정 직후라 배포 변경 영향이 작다.
4. **배포 직전**: 로컬 commits push → `deploy-backend-rsync.sh` 내용 확인(특히 `data/` 제외 규칙) → `crm.sqlite3` 백업 → 1~1.5시간 연속 작업 확보.
5. **배포 직후**: VM 대상으로 Phase A `test:crm`을 돌려 회귀 검증. `/crm` 페이지 수동 스팟 체크(수신거부 처리·그룹 토글·예약 목록).

### 상태 체크 한 줄

```text
현재 시나리오 D · CAPI 카드만 VM 직결 · D+3 2026-04-16 아침에 시나리오 C 실행 여부 재검토
```

---

## 6. 참고 — 이 문서 작성 시점 실 데이터

VM `att.ainativeos.net` (2026-04-14 02:19 KST 기준):

```text
PRE window  2026-04-05 ~ 04-11 (바이오컴)
  spend       ₩27,509,847
  revenue     ₩30,041,340
  Attribution confirmed ROAS  1.09x
  Meta Purchase ROAS          3.34x
  격차 (Meta/Attr)             3.06x (+206%)

POST window 2026-04-13 ~ 04-14 (바이오컴)
  spend       ₩4,204,932
  revenue     ₩5,974,400
  Attribution confirmed ROAS  1.42x
  Meta Purchase ROAS          3.89x
  격차 (Meta/Attr)             2.74x (+174%)

개선 폭: 3.06x → 2.74x (-0.32x, -11%)
POST 창 2일차 (완전히 닫힌 일수 1일)
판정: 초기 신호 이전, 방향성은 보이기 시작
```

로컬 `localhost:7020`은 attribution ledger가 2026-04-12 이후 비어 있어 위 숫자가 나오지 않는다. `/ads` 페이지가 VM을 바라봐야 이 값을 표시할 수 있다.
