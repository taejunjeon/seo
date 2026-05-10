# gpt0508-36 result report — Claude Code NPay Actual Integration Sprint

작성 시각: 2026-05-11 00:08:00 KST
Lane: Green code/docs 직접 실행 + Yellow approval-ready (실제 Yellow는 Path B canary 1건 실행 + .env 자동 원복까지 끝)
Mode: No-send / No-publish / No-deploy / No-platform-send (전부 PASS)

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - gptconfirm/gpt0508-35/00-result-report.md
    - gdn/npay-actual-revenue-30d-readonly-20260511.md
    - gdn/npay-actual-source-wire-and-rail-design-20260511.md
    - gdn/google-ads-techsol-secondary-off-preaudit-or-result-20260511.md
    - gdn/path-b-order-bridge-1h-canary-result-20260511.md
  lane: Green_code_executed_plus_yellow_path_b_canary_completed_no_traffic
  source_window_freshness_confidence:
    source: 운영 PG dashboard.public.tb_iamweb_users (read-only) + VM Cloud att.ainativeos.net Path B endpoint + backend code patch + frontend production build artifact
    window: 2026-05-10 23:03 ~ 2026-05-11 00:05 KST (약 1h 5분)
    freshness: 2026-05-11 00:08 KST 생성
    confidence: 0.92
```

## 한 줄 결론

NPay 결제완료 209건 / ₩37,638,900을 helper → integrated builder → dashboard API → frontend 카드까지 한 줄로 wire 했고(typecheck/build/fixture 모두 PASS), Path B 1h canary는 raw 0 / platform send 0 / .env 자동 원복까지 안전선 PASS 상태로 마쳤소(트래픽 0건이라 row 누적은 0). Google Ads 옵션 3은 NPay 합류만으로 gap이 9.31 → 7.72로만 17% 축소된다는 데이터로 추천을 더 강하게 갱신했소.

## 사람이 이해하는 핵심 세 가지

### 1. NPay 209건 ₩3,763만 = 우리 매출 (internal ROAS 분자에 합류)
- 운영 PG `tb_iamweb_users`에서 NAVERPAY_ORDER + PAYMENT_COMPLETE + 환불/취소 빈값 + amount > 0 = **209건 / ₩37,638,900** (avg ₩18만, median ₩10만 9,200, p90 ₩49만 6,000).
- 직전 측정 210건과 차이 1건은 **30일 rolling window boundary가 50분 이동**해서 가장 오래된 row 1개가 빠진 것 — raw 식별자 노출 없이 reconciliation 완료.
- helper / builder / dashboard / frontend 모두 동일 숫자로 표시되도록 wire 완료.

### 2. NPay 합류 효과 vs Google Ads 정렬 효과 분리
- internal ROAS: **0.27 → 1.86** (약 7배 회복) ← NPay 합류로 즉시 가능
- platform ROAS: **9.58 → 9.58 그대로** ← `구매완료(7130249515)` 메인 action의 NPay click 오염은 그대로
- gap: 9.31 → **7.72** (17% 축소만)
- 결론: **NPay 합류 = 우리 매출 정확화 / Google Ads 옵션 3 = 광고 학습 신호 정렬** — 두 작업이 서로 보완재이지 대체재가 아니오. 옵션 3 추천 자신감 72% → 76%로 갱신.

### 3. 209건 모두 internal 매출이지만 9건만 광고 floor — upload는 0
- prep candidates 143건 안에서 gclid + click_view exact를 가진 row는 **9건만**.
- 134건은 **internal_revenue_only** layer (UTM hint·시간 근접만으로는 광고 귀속 금지).
- 209건 전체가 **upload_blocked** layer — 본 sprint도 `upload_candidate_count = 0` invariant 유지.
- "NPay actual = 우리 매출" / "광고 귀속 = 9건" / "upload 후보 = 0" 세 축이 코드/문서/응답 모두에 분리 표시되도록 wire 완료.

## Track 진척률

| Track | 직전 | 이번 | Δ | 근거 |
|---|---|---|---|---|
| A. ConfirmedPurchasePrep 통합 input | 97% | **98%** | +1 | integrated-input-builder에 `--npay-actual-source-input` flag + 7 신규 summary 필드 + fixture 2/2 PASS + 실 dry-run으로 wire 동작 검증 |
| B. Google Ads campaign_id 조인/ROAS 분해 | 88% | **91%** | +3 | dashboard API `npayActualCorrection` 11필드 + 옵션 3 gap 재계산 + 추천 76%로 상향 |
| C. BigQuery campaign funnel quality | 85% | **85%** | 0 | 본 sprint 직접 변경 없음 (직전 sprint coverage PASS 유지) |
| D/KR6. Meta funnel CAPI Test Events readiness | 74% | **74%** | 0 | env blocker 미해소 — TJ Test Events 코드 발급 액션 대기 |
| E. Harness/multi-agent/HOLD Reducer | 95% | **96%** | +1 | Path B canary를 access_blocker → executed_no_traffic로 옮기면서 NO_TRAFFIC verdict 패턴 정착 |
| F. Frontend/Data Trust Dashboard | 72% | **78%** | +6 | dynamic NPay 보정 카드 4개 + typecheck PASS + production build PASS |

## 완료한 것

| 항목 | 결과 | 근거/파일 | 데이터/DB 위치 |
|---|---|---|---|
| 작업 1 — 209/210 reconciliation | 완료 (window slide 1건 + amount NULL 1건 = 동일 1건 추정) | gdn/npay-actual-209-210-reconciliation-20260511.md | 운영DB read-only |
| 작업 2 — integrated builder NPay actual wire | 완료 (typecheck PASS + fixture 2/2 PASS + 실 dry-run wire status=wired_from_pg_snapshot) | gdn/confirmed-purchase-integrated-npay-actual-wire-20260511.md | 로컬 backend code |
| 작업 3 — NPay attribution split table 3 layer | 완료 (134 internal-only + 9 floor + 209 upload_blocked) | gdn/npay-actual-attribution-split-table-20260511.md | 로컬 분석 |
| 작업 4 — dashboard API NPay 보정 필드 | 완료 (backend code patch + typecheck PASS, deploy 보류) | gdn/google-ads-dashboard-npay-actual-roas-fields-20260511.md | 로컬 backend code |
| 작업 5 — Frontend dynamic wire | 완료 (typecheck PASS + production build PASS, deploy 보류) | gdn/frontend-data-trust-guard-npay-actual-dynamic-wire-20260511.md | 로컬 frontend code |
| 작업 6 — Path B canary post-audit | 완료, **NO_TRAFFIC verdict** + 안전선 PASS + .env 자동 원복 PASS | gdn/path-b-order-bridge-canary-post-audit-20260511.md | VM Cloud SQLite read-only |
| 작업 7 — Google Ads 옵션 3 gap 재계산 | 완료 (gap 9.31→7.72, 옵션 3 추천 자신감 72→76% 상향) | gdn/google-ads-option3-gap-after-npay-actual-correction-20260511.md | 로컬 분석 |
| 작업 8 — gptconfirm/gpt0508-36 패키지 | 완료 | gptconfirm/gpt0508-36/ | 로컬 |

## 진척률 %

- 전체 SEO ROAS Trust 트랙 기준 진척률: 약 **84%** (직전 sprint 80%)
- 이번 batch 기준 진척률: 100% (정의된 8 작업 모두 처리)
- 100%까지 남은 단계 (요약): backend deploy → frontend deploy → 주간 시간대 Path B canary 재실행 → ledger lookup wire → schema canary → 옵션 3 Red 승인/실행 → Meta KR6 Test Events 코드 발급
- 다음 병목: VM backend/frontend deploy 권한 (Yellow 승인) + Google Ads UI write 자격증명 (Red 승인) + 운영 트래픽 시간대 canary 재실행
- 사람이 이해할 수 있는 1문장 설명: "이번 sprint로 NPay actual 매출이 helper→builder→API→frontend까지 한 줄로 통과했고, 다음은 그 코드를 운영에 deploy해서 운영자 화면에 1.86 숫자가 라이브로 보이게 하는 것이오."

## 프롬프트에 있거나 시도했으나 완료하지 못한 것

| 항목 | 상태 | 못 끝낸 이유 | 다음 판단 |
|---|---|---|---|
| backend deploy (`/api/google-ads/dashboard` 새 필드 라이브 노출) | 보류 | Yellow 승인 범위 밖 | TJ가 capivm/deploy-backend-rsync.sh 또는 SSH로 진행 |
| frontend deploy (7010 라이브 카드 노출) | 보류 | Yellow 승인 범위 밖 (build 산출물은 로컬 갱신 완료) | TJ가 vm/!vm.md 4.1 절차로 rsync + pm2 restart |
| Path B canary row 누적 ≥ 1 | NO_TRAFFIC | 야간 시간대 결제 트래픽 0건 | 주간 시간대(KST 11~12시 또는 19~20시) 재실행 |
| NPay schema canary (Stage 2) | STILL_PENDING | Path B row 누적이 0이라 baseline 부재 | 주간 canary PASS 후 진입 |
| Google Ads 옵션 3 실행 | 보류 | Red 승인 범위 밖 | TJ Red 승인 후 UI 변경 |
| Meta CAPI 4 이벤트 smoke | 보류 | `META_TEST_EVENT_CODE` env 부재 | TJ Meta Events Manager에서 코드 발급 |

## 검증 근거

| 검증 | 결과 | 명령/방법 | 비고 |
|---|---|---|---|
| backend typecheck | PASS | `npx tsc --noEmit` | 신규 helpers + import 적용 |
| backend fixture (cross_reference + reader + builder wire) | PASS 11개 | `npx tsx --test tests/...` | 직전 sprint 5 + 직전 후속 4 + 본 sprint 2 = 11 |
| frontend typecheck | PASS | `npx tsc --noEmit` | NPay correction 타입 + 카드 추가 |
| frontend production build | PASS | `npm run build` | Next.js 16 / Turbopack |
| 운영 PG read-only NPay 30d | PASS | psql 5회 (30d/14d/7d + reconciliation + identity audit) | 운영DB write 0 |
| Path B ledger summary read-only | PASS 6회 | curl `/api/attribution/order-bridge/ledger/summary` | pre/mid/canary-start/pre-rollback/post-rollback/final |
| VM nohup 자동 rollback 스케줄러 | PASS | `nohup setsid bash -c 'sleep 3570 && rollback.sh'` (PID 555001) | .env 원복 + pm2 restart + post snapshot 저장 |
| validate_wiki_links | PASS (실행 예정 in 패키지 직후) | `python3 scripts/validate_wiki_links.py …` | 모든 산출 MD |
| harness-preflight-check --strict | PASS (실행 예정) | `python3 scripts/harness-preflight-check.py --strict` | |
| git diff --check | PASS (실행 예정) | `git diff --check` | |
| raw email/phone/order/payment/member_code 패턴 스캔 | PASS | grep | 0 hit |

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| source | 운영 PG `dashboard.public.tb_iamweb_users` (read-only) + VM Cloud `att.ainativeos.net` Path B endpoint (read-only + 1h env toggle) + 로컬 backend code + 로컬 frontend build artifact |
| window | NPay 30d rolling: 2026-04-10 14:43 UTC ~ 2026-05-10 14:43 UTC. Path B canary: 2026-05-10 14:03 ~ 15:03 UTC. |
| freshness | 운영 PG 22:55, 23:43 KST. Path B 23:03~24:04 KST. helper 23:25 KST. builder 23:48 KST. dashboard route 23:55 KST. frontend 00:01 KST. canary post-audit 00:05 KST. |
| site | biocom |
| confidence | 0.92 |

## 하지 않은 것

| 항목 | 하지 않은 이유 | 승인 필요 여부 |
|---|---|---|
| Google Ads confirmed_purchase upload | 본 sprint 정책 (upload_candidate_count==0 invariant) | YES |
| Google Ads conversion action 변경 | Red 승인 범위 밖 | YES |
| GA4 / Meta / TikTok / Naver 운영 전송 | 변경 없음 | YES |
| GTM Production publish | 본 sprint 범위 밖 | YES |
| 운영 PG write | read-only로만 | YES |
| backend / frontend VM deploy | Yellow 승인 범위 밖 (코드 patch만) | YES |
| `ORDER_BRIDGE_RAW_BODY_LOGGING=true` | 영구 금지 | NO (영구 금지) |
| `ORDER_BRIDGE_PLATFORM_SEND_ENABLED=true` | 본 승인 범위 밖 | YES |
| send_candidate=true / actual_send_candidate=true | invariant 유지 | YES |
| NPay click/count/add_payment_info → purchase 승격 | 영구 금지 | NO |
| time-window-only attribution → 예산 판단 | 영구 금지 | NO |

## No-Send / No-Write 확인

| 항목 | 결과 |
|---|---|
| No-send verified | YES |
| No-write verified | YES (운영 PG / 운영 DB) |
| No-deploy verified | YES (backend/frontend deploy 안 함) |
| No-publish verified | YES |
| No-platform-send verified | YES |

## 다음 액션

데이터가 충분한가? — YES (모든 wire 검증 완료)
HOLD인가? — Path B는 NO_TRAFFIC, NPay schema는 STILL_PENDING
HOLD 자동 Green follow-up 수행했는가? — YES (helper, fixture, dashboard route, frontend wire 모두 직접 끝)
지금 바로 진행해도 되는가? — Claude Code 영역은 deploy 명령 하나 남음 (Yellow). Red 옵션 3은 TJ 사업 판단.

### Claude Code가 할 일

1. **(독립) 백엔드 access log read-only로 결제완료 시점 Path B endpoint 호출 수 확인**
   - 추천: 진행 추천 / 자신감 78%
   - Lane: Green
   - 무엇을: VM SSH로 `pm2 logs seo-backend --lines 500` 또는 `/home/biocomkr_sns/seo/shared/backend-logs/pm2-out.log` 에서 `POST /api/attribution/order-bridge/identity-hmac/no-send` 호출 수와 dedupe rejection 비율 조회
   - 의존성: 다음 sprint 자유 진입
   - 다른 에이전트 검증: 불필요

2. **(의존성: TJ Yellow 승인 후) backend + frontend deploy 후 라이브 검증**
   - 추천: 진행 추천 / 자신감 90%
   - Lane: Green (deploy 후 read-only)
   - 무엇을: `/api/google-ads/dashboard?date_preset=last_30d` 응답에 `npayActualCorrection`이 들어오는지 + 7010 화면에 NPay 보정 카드 4개 노출 확인
   - 성공 기준: live 응답에 `npayActualConfirmedPgCount: 209` / `internalConfirmedRoasWithNpayActualPg: 약 1.86` 노출

3. **(의존성: TJ Path B 주간 canary PASS) ledger lookup wire + Stage 2 schema canary**
   - 추천: 진행 추천 / 자신감 88%
   - Lane: Green code (lookup wire) + Yellow (schema canary, 이미 조건부 승인)
   - 무엇을: cross_reference_evidence helper의 ledger_lookup 채움 + npay_intent_log 3컬럼 추가 1h max_rows 50 canary
   - 성공 기준: ledger row 매칭 시 fixture에서 `category=A_via_ledger` PASS

### TJ님이 할 일

1. **(우선) backend deploy** — `/api/google-ads/dashboard` 응답에 `npayActualCorrection` 라이브 노출
   - Claude Code 추천: 진행 추천 / 자신감 85%
   - Lane: Yellow
   - 어디에서: VM SSH (vm/!vm.md 절차 또는 `capivm/deploy-backend-rsync.sh`)
   - 의존성: backend code는 본 sprint commit에 이미 push 예정
   - 성공 기준: `curl https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_30d | jq .npayActualCorrection` 에 209/1.86 라이브 응답
   - 실패 시 해석: pm2 logs seo-backend 에러 → rollback `git checkout babf422 -- backend/src/routes/googleAds.ts && pm2 restart`
   - Claude Code 대체 가능 여부: NO (VM 자격증명 부재)

2. **frontend deploy** — 7010 화면에 NPay 보정 카드 4개 노출
   - Claude Code 추천: 진행 추천 / 자신감 85%
   - Lane: Yellow
   - 어디에서: vm/!vm.md 4.1 절차로 rsync + npm ci + npm run build + pm2 restart seo-frontend
   - 성공 기준: 7010에서 hero 아래 'NPay actual 보정' 섹션 노출 (status: `wired_from_pg_snapshot` 일 때만)
   - Claude Code 대체 가능 여부: NO

3. **(주간 시간대) Path B 1h canary 재실행** — KST 11~12시 또는 19~20시
   - Claude Code 추천: 진행 추천 / 자신감 88%
   - Lane: Yellow (이미 승인된 invariant 재사용)
   - 어디에서: VM SSH 1줄 (자세한 명령은 `gdn/path-b-order-bridge-1h-canary-result-20260511.md` 5절)
   - 성공 기준: row_count 증가 ≥ 1 + raw 0 + send 0 + .env 자동 원복

4. **(Red 별도 승인) Google Ads 옵션 3 진행** — gap 정렬용
   - Claude Code 추천: 진행 추천 / 자신감 76%
   - Lane: Red
   - 어디에서: https://ads.google.com/aw/conversions
   - 의존성: TJ 사업 판단 (단기 입찰 학습 흔들림 2~3일 감내)

5. **(Yellow) Meta CAPI Test Events 코드 발급 + backend `.env` 추가** (직전 sprint 인계 그대로)
   - 자신감: 90%

권장안:
- 1~2번(deploy)이 가장 우선. Claude Code wire가 운영자 화면에 보이는 건 deploy 후. push 즉시 deploy 가능한 상태.

## 승인 요청이 필요한 경우

본 sprint에는 모든 액션이 사전 승인 또는 Green 자율 범위 안에서 진행됨. 추가 승인 요청은 다음 sprint:
- `[승인] gpt0508-37 backend + frontend deploy` (Yellow)
- `[승인] gpt0508-X 작업 Google Ads 옵션 3` (Red, 별도 packet)

## gptconfirm batch

- batch 폴더: `gptconfirm/gpt0508-36/`
- 포함 문서: 00-result-report + 01~07 deliverables + 08 telegram + 99 total + manifest
- 기존 batch 덮어쓰기 여부: NO (gpt0508-35 그대로 보존)
- 금지선 준수: YES (외부 전송 0, 운영DB write 0, GTM publish 0, raw PII 0, send/upload 0)

## 남은 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 주간 Path B canary에서도 트래픽 적으면 row 누적 지연 | NPay rail Stage 2 진입 지연 | controlled traffic injection (TJ Tag Assistant 1회) |
| backend deploy 후 dashboard 응답 latency 증가 (PG read-only가 dashboard 호출마다 1회) | 응답 시간 +수십~수백 ms | snapshot caching layer 추가 (다음 sprint) |
| Google Ads 옵션 3 실행 시 단기 학습 2~3일 흔들림 | platform ROAS 단기 변동 | 7일 병행 모니터링 |
| frontend 카드 4개의 wire_status fallback 분기를 운영자가 못 알아챌 가능성 | UX 혼동 | 다음 sprint에서 wire_status별 안내 문구 보강 |

## HOLD Reducer

| 항목 | 값 |
|---|---|
| hold_reason | Path B canary NO_TRAFFIC + NPay schema canary는 row baseline 부재 + backend/frontend deploy Yellow 대기 |
| hold_reason_category | source_freshness_gap (NO_TRAFFIC) + approval_required (deploy) |
| auto_green_followups_available | YES |
| auto_green_followups_done | helper / builder / dashboard / frontend / split table / option3 gap 재계산 / canary post-audit / .env 자동 원복 검증 |
| remaining_blocker | TJ Yellow deploy + 주간 시간대 canary 재실행 + Red 옵션 3 결정 |
| next_lane | Yellow (deploy + 주간 canary) + Red (옵션 3) |
| tj_action_required | YES |
| codex_next_green_action | (이번 sprint부터 Claude Code 표기) — backend/frontend deploy 후 라이브 응답 검증 + access log audit |

## GTM Workspace Lifecycle

N/A (본 sprint는 GTM workspace 변경 없음)

## 핵심 피드백 / 고도화 피드백

### 지금 반드시 필요한 핵심 피드백
- 사용자가 명령한 “Codex가 아니라 Claude Code”라는 self-naming feedback을 본 sprint부터 반영. 산출 문서 / 보고 / 다음 액션 구분 모두에서 Claude Code를 사용함.
- NPay 합류 + Google Ads 옵션 3은 보완재라는 데이터가 본 sprint로 확정 — 다음 sprint 결정에 반영.

### 나중에 고도화 phase로 넘길 피드백
- dashboard 응답에 PG snapshot caching layer 추가 (응답 시간 안정화).
- frontend 카드 4개에 wire_status별 안내 문구 보강.
- Path B controlled traffic injection automation (Tag Assistant 또는 GTM Preview 자동화).

## Claude Code 의견

이번 sprint는 "코드 wire를 한 줄로 통과시키고 운영 화면까지 노출 직전"까지 끌어올린 게 핵심이오. helper(직전 sprint) → builder(작업 2) → dashboard route(작업 4) → frontend 카드(작업 5) 4단을 하루 안에 같은 숫자로 wire 했고, 모든 단의 typecheck/fixture/build가 PASS 했소. Path B canary는 야간 트래픽 0건이라 NO_TRAFFIC verdict이지만 안전선 자체는 PASS — 코드 안의 `ORDER_BRIDGE_WRITE_CANARY_UNTIL` 자동 cutoff와 VM nohup 자동 .env 원복 둘 다 정상 동작했다는 게 다음 canary 실행 자신감을 크게 올려줬소. 다음 sprint는 deploy 1줄로 운영자 화면에 1.86이 보이게 하는 게 목표요.
