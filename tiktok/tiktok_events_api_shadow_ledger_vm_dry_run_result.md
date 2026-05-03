# TikTok Events API Shadow Candidate Ledger VM Dry Run Result

작성 시각: 2026-05-03 12:12 KST
Project: TikTok ROAS 정합성 개선
Sprint: TikTok Events API Shadow Candidate Ledger Local Implementation + VM Dry Run
Lane: Yellow
Mode: shadow-only ledger write
Auditor verdict: PASS_WITH_NOTES
현재 판정: 승인 범위 안에서 VM shadow 원장 생성과 17건 upsert 완료
자신감: 87%

```yaml
harness_preflight:
  common_harness_read: "harness/common/HARNESS_GUIDELINES.md, harness/common/AUTONOMY_POLICY.md, harness/common/REPORTING_TEMPLATE.md"
  project_harness_read: "harness/tiktok/LESSONS.md"
  required_context_docs:
    - "AGENTS.md"
    - "CLAUDE.md"
    - "docurule.md"
    - "docs/report/text-report-template.md"
    - "tiktok/tiktok_events_api_shadow_ledger_approval.md"
    - "tiktok/tiktok_events_api_shadow_ledger_design.md"
    - "confirm/gpt0503/tiktok_events_api_shadow_local_review.md"
  lane: "Yellow"
  allowed_actions:
    - "TJ 관리 Attribution VM 배포"
    - "VM SQLite tiktok_events_api_shadow_candidates table 생성"
    - "최근 7일 window dry-run"
    - "shadow row 최대 50건 insert/upsert"
    - "eligible_for_future_send / block_reason 분포 확인"
    - "결과 문서 업데이트"
    - "audit"
    - "commit/push"
  forbidden_actions:
    - "TikTok Events API production send"
    - "TikTok Test Events send"
    - "GA4/Meta/Google 전환 전송"
    - "GTM 변경"
    - "Purchase Guard 변경"
    - "firstTouch strict 승격"
    - "payment_success top-level attribution overwrite"
    - "개발팀 관리 운영DB PostgreSQL write"
    - "scheduler/dispatcher 상시 ON"
  source_window_freshness_confidence:
    source: "TJ 관리 Attribution VM SQLite: CRM_LOCAL_DB_PATH#tiktok_pixel_events + CRM_LOCAL_DB_PATH#attribution_ledger"
    window: "최근 7일, --window-days 7, site_source=biocom_imweb"
    freshness: "2026-05-03 12:07 KST VM apply 직후"
    site: "biocom"
    confidence: 0.87
```

## 한 줄 결론

TikTok Events API를 실제로 보내지 않고, TJ 관리 Attribution VM SQLite에 “나중에 서버 이벤트로 보낼 수 있는 후보인지”만 기록하는 shadow 원장을 만들었다.

이번 작업은 TikTok 전송 0건, TikTok Test Events 전송 0건, GA4/Meta/Google 전송 0건, 개발팀 관리 운영DB write 0건이다.

## 완료한 것

| 항목 | 결과 | 근거/파일 | 데이터/DB 위치 |
|---|---|---|---|
| raw `o...` event_id 저장 방지 | 완료 | `guard_raw_event_id`, `source_refs_json.event_id`를 `raw_order_event_id_sha256:...`로 저장 | TJ 관리 Attribution VM SQLite |
| 로컬 신규 테스트 | 통과, 5/5 | `node --import tsx --test tests/tiktok-events-api-shadow-candidates.test.ts` | 로컬 개발 DB 임시 SQLite |
| 로컬 타입체크 | 통과 | `npm --prefix backend run typecheck` | 해당 없음 |
| 로컬 빌드 | 통과 | `npm --prefix backend run build` | 해당 없음 |
| Harness preflight | 통과 | `python3 scripts/harness-preflight-check.py --strict` | 해당 없음 |
| VM SQLite 백업 | 완료 | `/home/biocomkr_sns/seo/backups/crm.sqlite3.20260503-030500.before-tiktok-events-shadow` | TJ 관리 Attribution VM SQLite |
| VM 파일 배포 | 완료 | backend source/script/test 3개 파일만 rsync | TJ 관리 Attribution VM |
| VM 테스트 | 통과, 5/5 | `node --import tsx --test tests/tiktok-events-api-shadow-candidates.test.ts` | TJ 관리 Attribution VM |
| VM 타입체크 | 통과 | `npm run typecheck` | TJ 관리 Attribution VM |
| VM dry-run | 완료 | `--window-days 7 --limit 50 --json`, `writtenRows=0` | TJ 관리 Attribution VM SQLite read |
| VM shadow apply | 완료 | `--apply --window-days 7 --limit 50 --json`, `writtenRows=17` | TJ 관리 Attribution VM SQLite write |
| VM health | 정상 | `https://att.ainativeos.net/health` status ok | TJ 관리 Attribution VM |

## 프롬프트에 있거나 시도했으나 완료하지 못한 것

| 항목 | 상태 | 못 끝낸 이유 | 다음 판단 |
|---|---|---|---|
| TikTok Events API production send | 금지 범위라 미실행 | 이번 sprint는 shadow-only | Red Lane 별도 승인 전까지 금지 |
| TikTok Test Events send | 금지 범위라 미실행 | 이번 sprint는 Test Events도 0건 조건 | Yellow Lane 별도 승인 전까지 금지 |
| GTM 변경 | 금지 범위라 미실행 | 현재 작업은 VM shadow 원장만 대상 | 변경 필요 없음 |
| Purchase Guard 변경 | 금지 범위라 미실행 | 현재 guard는 정상 동작 중 | 변경 필요 없음 |
| 개발팀 관리 운영DB write | 금지 범위라 미실행 | 운영DB는 개발팀 관리 PostgreSQL | write 금지 유지 |
| scheduler/dispatcher 상시 ON | 금지 범위라 미실행 | 자동 전송 장치가 생기면 platform send 위험 증가 | 상시 ON 금지 유지 |

## VM Dry-Run / Apply 결과

데이터 기준:
- source: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#tiktok_pixel_events`, `CRM_LOCAL_DB_PATH#attribution_ledger`
- window: 최근 7일, `--window-days 7`
- site/source: `biocom`, `site_source=biocom_imweb`
- 기준 시각: 2026-05-03 12:07 KST

| 지표 | dry-run | apply |
|---|---:|---:|
| totalCandidates | 17 | 17 |
| writtenRows | 0 | 17 |
| eligibleForFutureSend | 15 | 15 |
| blocked | 2 | 2 |
| dedupReady | 15 | 15 |
| sendCandidateTrue | 0 | 0 |
| platformSent | 0 | 0 |

Block reason 분포:

| block reason | 건수 | 쉬운 의미 |
|---|---:|---|
| `(none)` | 15 | 향후 서버 이벤트 후보로 볼 수 있음. 단, 아직 TikTok으로 보내지 않음 |
| `pending_virtual_account` | 1 | 가상계좌 pending 근거가 있어 후보 제외 |
| `not_confirmed` | 1 | 확정 구매로 닫히지 않아 후보 제외 |

Payment status 분포:

| payment_status | 건수 |
|---|---:|
| confirmed | 16 |
| pending | 1 |

Evidence 분포:

| TikTok evidence | 건수 |
|---|---:|
| `ttclid,utm_source_tiktok,referrer_tiktok,metadata_tiktok_match_reasons` | 7 |
| `ttclid,referrer_tiktok,metadata_tiktok_match_reasons` | 10 |

## Hard Fail 체크

| 체크 | 결과 | 근거 |
|---|---:|---|
| shadow table 존재 | PASS | `tableExists=1` |
| candidate_version row 수 50건 이하 | PASS | `versionRows=17`, `overLimitThisVersion=0` |
| 모든 row `send_candidate=false` | PASS | `sendCandidateTrue=0` |
| 모든 row `platform_send_status=not_sent` | PASS | `platformSent=0` |
| pending 가상계좌 eligible 금지 | PASS | `pendingEligible=0` |
| TikTok evidence 없는 confirmed eligible 금지 | PASS | `noEvidenceEligible=0` |
| raw `o...` server event_id 저장 금지 | PASS | `rawServerEventIdRows=0` |
| raw `o...` guard/source event_id 저장 금지 | PASS | `rawGuardEventIdRows=0`, `rawSourceRefEventIdRows=0` |
| raw PII 저장 금지 | PASS | `piiRows=0` |
| TikTok endpoint 호출 | PASS | 코드 검색상 `fetch/axios/http request/events.tiktok` 없음, CLI output `noPlatformSend=true` |
| TikTok Test Events 호출 | PASS | 코드 검색상 Test Events 호출 없음 |
| 개발팀 관리 운영DB write | PASS | CLI output `noOperatingDbWrite=true`; 운영DB 접속/write 없음 |

## 하지 않은 것

| 항목 | 하지 않은 이유 | 승인 필요 여부 |
|---|---|---|
| TikTok Events API production send | ROAS 중복 오염 방지. 이번 sprint 조건상 전송 0건 | YES, Red Lane |
| TikTok Test Events send | 이번 승인 범위 밖 | YES, Yellow Lane |
| GA4/Meta/Google 전환 전송 | 외부 플랫폼 전환값 변경 방지 | YES, Red Lane |
| GTM 변경 | 이번 작업은 VM SQLite shadow 원장만 대상 | YES |
| Purchase Guard 변경 | 현재 pending/Purchase 분기 안정화 상태 유지 | YES |
| 운영DB PostgreSQL write | 개발팀 관리 운영DB는 이번 범위 밖 | YES |
| PM2 restart | 서버 API 런타임 변경이 아니라 CLI shadow 작업이라 영향 최소화를 위해 미실행 | 필요 시 별도 판단 |

## No-Send / No-Write 확인

| 항목 | 결과 |
|---|---|
| No TikTok production send | YES |
| No TikTok Test Events send | YES |
| No GA4/Meta/Google send | YES |
| No GTM change | YES |
| No Purchase Guard change | YES |
| No operating DB PostgreSQL write | YES |
| VM SQLite shadow write | YES, 승인 범위 안에서 17건 |
| Scheduler/dispatcher permanent ON | NO, 만들지 않음 |

## Changed Files

로컬 repo 변경:

| 파일 | 변경 이유 |
|---|---|
| `backend/src/tiktokEventsApiShadowCandidates.ts` | raw `o...` event_id를 VM shadow 테이블에 그대로 저장하지 않도록 해시 저장 처리 |
| `backend/tests/tiktok-events-api-shadow-candidates.test.ts` | raw event_id 저장 금지 조건을 테스트로 고정 |
| `tiktok/tiktok_events_api_shadow_ledger_vm_dry_run_result.md` | 이번 VM dry-run/apply 결과 문서 |

VM 반영 파일:

| 파일 | 반영 방식 |
|---|---|
| `/home/biocomkr_sns/seo/repo/backend/src/tiktokEventsApiShadowCandidates.ts` | rsync |
| `/home/biocomkr_sns/seo/repo/backend/scripts/tiktok-events-api-shadow-candidates.ts` | rsync |
| `/home/biocomkr_sns/seo/repo/backend/tests/tiktok-events-api-shadow-candidates.test.ts` | rsync |

## Rollback

문제 발생 시 아래 중 하나를 실행한다.

1. 이번 version row만 제거:

```sql
DELETE FROM tiktok_events_api_shadow_candidates
WHERE candidate_version='2026-05-03.shadow.v1';
```

2. 백업 SQLite로 복구:

```bash
/home/biocomkr_sns/seo/backups/crm.sqlite3.20260503-030500.before-tiktok-events-shadow
```

3. 배포 파일을 이전 commit 버전으로 되돌린 뒤 필요 시 VM에서 같은 테스트를 재실행한다.

## 다음 액션

다음 액션을 제시하기 전 판단:

- 데이터가 충분한가: shadow 원장 단계 기준으로 충분하다. production send 판단에는 아직 부족하다.
- 더 조사할 것이 있는가: TikTok Events API Test Events 수신, TikTok Events Manager dedup 진단은 아직 없다.
- 지금 바로 진행해도 되는가: Test Events only는 별도 Yellow Lane 승인 후 가능하다. Production send는 아직 진행하면 안 된다.
- 진행 추천 자신감: Test Events only 준비 78%, Production send 42%.
- 사용자가 직접 해야 하는 일이 있는가: Test Events 단계에서는 TJ님이 TikTok Events Manager 화면에서 Test Event Code를 확인해야 할 가능성이 높다.
- Codex가 대신 가능한가: API token과 화면 권한이 있으면 일부 가능하지만, TikTok Events Manager UI 확인은 TJ님 브라우저 권한이 필요할 수 있다.
- 다른 에이전트 검증이 필요한가: Production send 전에는 권장. 이유는 광고 플랫폼 최적화 신호와 비용 판단에 직접 영향이 있기 때문이다.

| Lane | 옵션 | 추천도/자신감 | 담당 | 무엇을 하는가 | 왜 하는가 | Codex가 대신 가능한가 | 어떻게 하는가 | 어디에서 확인하나 | 성공 기준 | 실패 시 해석/대응 | 다른 에이전트 검증 | 승인 필요 |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|
| Green | A | 92% | Codex | shadow 후보 17건을 읽어서 어떤 주문이 eligible이고 어떤 주문이 blocked인지 사람이 읽는 요약표를 만든다 | 서버 이벤트를 켜기 전 “보낼 후보”가 사업적으로 맞는지 검토하기 위해 | YES | VM SQLite read-only 쿼리로 order_no, 금액, evidence, block reason 요약 | TJ 관리 Attribution VM SQLite | eligible 15건의 근거가 모두 ttclid/referrer/metadata로 설명됨 | 특정 주문이 이상하면 해당 row만 deep dive | 불필요 | NO |
| Yellow | B | 78% | TJ + Codex | TikTok Test Events only runbook을 실행한다 | 실제 TikTok endpoint에 보내기 전 dedup 수신 형식을 검증하기 위해 | 부분 가능. Test Event Code와 Events Manager 화면 확인은 TJ님 권한 필요 | Test Event Code 발급 -> send_candidate=false 유지한 shadow payload 1건을 test endpoint로만 전송 -> Events Manager에서 test 수신 확인 | TikTok Events Manager, TJ 관리 Attribution VM | Test Events에만 1건 표시되고 optimization 신호에는 쓰이지 않음 | 미수신이면 payload/event_id/pixel_code/token 권한부터 확인 | 권장 | YES |
| Red | C | 42% | TJ + Codex | Production Events API send를 켠다 | 서버 이벤트로 구매 신호를 보강하기 위해 | NO. 광고 플랫폼 최적화에 직접 영향 | 별도 승인 문서, dispatcher off-by-default, kill switch, 1건 canary 후 확장 | TikTok Events Manager, VM SQLite | browser/server dedup 정상, 중복 구매 증가 없음 | 중복 전환 위험. 즉시 중단과 rollback | 권장 | YES |

권장안:

- 지금은 Green Lane A를 먼저 진행한다. 즉, 이번 17건 shadow row를 주문별로 사람이 읽을 수 있게 풀어 쓴다.
- 그 다음 Test Events only 승인 문서를 별도로 만든다.
- Production send는 아직 승인 요청하지 않는다.

## 남은 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| shadow eligible 15건이 “실제 전송 가능”이지 “전송 승인”은 아님 | TikTok으로 바로 보내면 중복 전환이 생길 수 있음 | Test Events only와 dedup diagnostics 전까지 production send 금지 |
| VM SQLite 기준이며 운영DB PostgreSQL cross-check는 이번에 하지 않음 | 주문 상태 최종 진실과 차이가 날 수 있음 | Production send 전 운영DB read-only cross-check 또는 Imweb/Toss cross-check 추가 |
| browser Pixel event_id와 server event_id가 같아도 TikTok 실제 dedup 결과는 별도 확인 필요 | 중복 전환 리스크 | Test Events only에서 pixel_code, event_name, event_id 일치 확인 |
| pending/canceled 상태가 이후 바뀔 수 있음 | shadow row의 eligible/block 판정이 시간이 지나면 달라질 수 있음 | candidate_version/window를 남기고 재평가 방식 유지 |

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

승인된 Yellow Lane 범위 안에서 완료됐다. VM SQLite에는 `candidate_version='2026-05-03.shadow.v1'` row 17건이 생겼고, 모든 row는 `send_candidate=false`, `platform_send_status=not_sent`다.

Production TikTok Events API 전송은 여전히 Red Lane이다. 이번 결과만으로 켜면 안 된다.
