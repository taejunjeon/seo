# Coffee Data Harness — Autonomy Policy

정본 link: harness/common/HARNESS_GUIDELINES.md · harness/common/AUTONOMY_POLICY.md · harness/common/REPORTING_TEMPLATE.md (본 문서는 Coffee project-local delta, 정본 fork 아님)

본 문서는 Coffee Data 관련 작업에서 agent (Codex / Claude Code) 의 **자율 권한 범위 (lane)** 를 정의한다. 모든 Coffee 관련 sprint 는 시작 시점에 lane 을 식별하고, 그 lane 의 규칙대로 진행해야 한다.

작성: 2026-05-02 (TJ 결정, sprint 19.2 진입 시)
검토 주기: 매 분기 또는 새 lesson 등록 시

## 0. 결론 (10초)

세 lane 으로 작업을 분류:

| Lane | 의미 | 승인 요건 |
|---|---|---|
| 🟢 **Green** | reversible / read-only / dry-run / 운영 영향 0 | **승인 불요** — agent 자율 |
| 🟡 **Yellow** | controlled smoke / temporary state / cleanup 필수 | **sprint 1회 승인** — 시작 후 cleanup 까지 자율 |
| 🔴 **Red** | 운영 비가역 / 외부 플랫폼 영향 / 자동 운영 전환 | **매 작업마다 명시 승인** |

## 1. 🟢 Green Lane (no approval required)

### 허용 작업

| 카테고리 | 예시 |
|---|---|
| 문서 작성/갱신 | runbook, design doc, 분석 리포트, 결정 문서, lessons |
| read-only fetch | stats GET, ledger SELECT (admin token 정상 경로), BigQuery SELECT, GA4 MP debug GET, Imweb v2 GET, NPay sandbox GET, Toss GET |
| dry-run | `mode=dry_run` POST (ledger write 0), CSV export, schema migration dry-run, rsync `-n --itemize-changes` |
| monitoring script | read-only fetch + yaml/md 출력 |
| audit | tsc, lint, `coffee_harness_audit.py`, harness AUDITOR_CHECKLIST 점검 |
| scoped commit/push | 의도한 파일만 `git add`. audit PASS 후 자동 진행 |

### 규칙

- audit PASS 후 agent **자동 계속 진행**, 묻지 않음.
- scoped commit 메시지는 변경 의도 + 영향 범위 명시.
- 새 lesson / 회귀 발견 시 `harness/coffee-data/LESSONS.md` 자동 등록.
- 검증 실패 (tsc fail / audit fail) 시 즉시 멈추고 원인 보고.

## 2. 🟡 Yellow Lane (one-time sprint approval)

### 허용 작업 (sprint 1회 TJ 승인 후)

| 카테고리 | 조건 |
|---|---|
| GTM Preview workspace 생성 + Custom HTML tag 등록 | Production publish 안 함, sandbox 한정 |
| smoke window open | `max_inserts ≤ 5`, `duration ≤ 30분`, sprint 종료 시 close |
| temporary env flag | `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true` — sprint 종료 시 **즉시 제거** |
| smoke admin token | sprint 종료 시 즉시 제거 |
| backend pm2 restart | `--update-env` 후 dormant 복귀 검증 |
| controlled smoke | TJ chrome 의 PC NPay click 1-2건 forward 검증. **자동 dispatcher 운영 전환 금지** |
| cleanup | window close + .env 정리 + restart + GTM workspace delete (TJ manual or Codex) |
| 결과 보고서 + scoped commit/push | scope 명확 표시 |

### 규칙

- Yellow Lane sprint 승인 시 agent 가 **전체 run (smoke + cleanup + report + commit/push) 자율 완료**.
- cleanup 빠뜨리면 sprint 미완. 반드시 마지막 stats 가 enforce/token/window 모두 false 확인.
- max_inserts 초과 또는 duration 초과 발견 시 즉시 멈춤 + 보고.
- snippet / dispatcher / backend 코드 변경은 별도 sprint (Yellow Lane 안에 포함 안 됨).
- 결과 ledger row 는 `intent_uuid LIKE 'smoke_%'` 또는 `source_version` test pattern 으로 식별 + 보고서에서 제외.

## 3. 🔴 Red Lane (explicit human approval required)

### 매 작업마다 TJ 명시 승인 필요

| 작업 | 사유 |
|---|---|
| GTM Production publish | thecleancoffee.com 모든 사용자 영향, rollback 1분이지만 대중 노출 + 추적 데이터 영구 |
| GA4 MP / Meta CAPI / TikTok Events / Google Ads send (test 포함) | 외부 플랫폼 dispatch — 비용 + 정책 + 영구 기록 |
| permanent env flag ON (단순 sprint 임시 OFF 외) | 운영 상태 영구 변경, 의도치 않은 enforce 위험 |
| 운영 DB write / import apply | 운영 SQLite (`backend/data/crm.sqlite3`) / 운영 PG (`tb_*`) 직접 쓰기 — 비가역. ledger 자동 INSERT 는 enforce mode + smoke window 가드 안에서만 (Yellow) |
| 자동 dispatcher 운영 전환 | 사용자 트래픽 자동 처리 — 5일 default 모니터링 PASS 후 |
| pm2 `ecosystem.config.cjs` 변경 | VM 운영 supervisor 변경 |
| frontend / cloudflared / 타 서비스 설정 변경 | 본 Coffee sprint 범위 외 |
| 외부 사용자에게 가는 알림 / 마케팅 발송 | 카카오 알림톡 / 이메일 / SMS 등 |

### 규칙

- Red Lane 작업 시점에 agent 는 **즉시 멈추고** 명시 승인 요청.
- 승인 시점 / 작업 / scope / 영향 범위 / rollback 절차를 보고.
- 승인 받은 후에도 작업은 **그 sprint 한정** — 같은 작업 다음에도 다시 승인 필요.

## 4. Lane 간 ramping rule

| 상황 | 동작 |
|---|---|
| Green Lane audit PASS | 다음 작업 자동 진행 (묻지 않음) |
| Yellow Lane sprint 승인 | cleanup 까지 자율 완료, 보고만 |
| Yellow Lane 안에서 새 위험 발견 | 즉시 멈춤 + TJ 보고 |
| Yellow → Red 으로 lane 전환 시점 | 반드시 멈추고 새 승인 요청 |
| Red Lane 작업 시점 | 반드시 멈추고 명시 승인 요청 |
| 새 lesson / 회귀 발견 | 자동 logging (`LESSONS.md` 추가) |

## 5. Risk-widening 인정 기준

Yellow / Red lane 의 "확장" 은 별도 **명시 승인** 필요:

| 시도 | 분류 | 처리 |
|---|---|---|
| smoke window `max_inserts` 5 → 10 | risk-widening | 멈춤, 명시 승인 |
| GTM Preview 가 아닌 sandbox container | risk-widening | 멈춤, 명시 승인 |
| 외부 send 1건만 test | Red Lane | 매번 명시 승인 |
| smoke duration 30 → 60분 | risk-widening | 멈춤, 명시 승인 |
| dispatcher v2.1 의 새 fetch endpoint 추가 | risk-widening | 멈춤, 명시 승인 |
| backend schema 변경 | Red Lane | 매번 명시 승인 |

## 6. 본 정책의 적용 흐름

1. **sprint 시작 시점**: agent 가 sprint goal 을 lane 분류 (Green / Yellow / Red).
2. **분류 보고**: TJ 에게 lane + 핵심 작업 요약 보고.
3. **TJ 응답**: Green → 자동 진행, Yellow → 1회 승인 후 자율, Red → 매 작업 승인.
4. **sprint 진행**: 정책 안에서 자율 / 멈춤 / 보고.
5. **sprint 종료**: 보고서 + 새 lesson 등록 + audit + commit/push.

## 7. 본 정책 자체의 변경

본 `AUTONOMY_POLICY.md` 의 변경은 **TJ 명시 승인 필요** (Red Lane). agent 가 자율 변경 안 함. lesson 추가는 LESSONS.md 에 자동.

## 8. 참고

- 본 정책의 source-of-truth: `harness/coffee-data/AUTONOMY_POLICY.md`
- 관련 문서: `harness/coffee-data/AUDITOR_CHECKLIST.md`, `harness/coffee-data/RULES.md`, `harness/coffee-data/LESSONS.md`
- 정책 적용 예시 (Yellow Lane): sprint 19.2 dispatcher v2.1 Preview 재검증
