# TikTok Events API Shadow Candidate Rebuild Result

작성 시각: 2026-05-04 14:09 KST
Project: TikTok ROAS 정합성 개선
Sprint: TikTok Events API Shadow Candidate Rebuild
Lane: Yellow
Mode: shadow-only VM SQLite rebuild
Auditor verdict: PASS_WITH_NOTES
현재 판정: 승인 범위 안에서 완료. TikTok/GA4/Meta/Google 전송 0건
자신감: 95%

```yaml
harness_preflight:
  common_harness_read: "AGENTS.md, harness/common/HARNESS_GUIDELINES.md, harness/common/AUTONOMY_POLICY.md, harness/common/REPORTING_TEMPLATE.md"
  project_harness_read: "harness/tiktok/LESSONS.md"
  required_context_docs:
    - "docurule.md"
    - "tiktok/tiktok_events_api_shadow_rebuild_approval.md"
    - "tiktok/tiktok_events_api_production_canary_result_20260504.md"
    - "tiktok/tiktok_events_api_shadow_candidate_review_20260503.md"
  lane: "Yellow"
  allowed_actions:
    - "TJ 관리 Attribution VM에 패치된 shadow 후보 생성 로직 반영"
    - "VM dry-run"
    - "기존 candidate_version=2026-05-03.shadow.v1 row 백업"
    - "새 candidate_version으로 최대 50건 shadow-only upsert"
    - "새 후보 검토표 작성"
    - "audit"
    - "commit/push"
  forbidden_actions:
    - "TikTok Events API production send"
    - "TikTok Test Events send"
    - "GA4/Meta/Google 전환 전송"
    - "GTM 변경"
    - "Purchase Guard 변경"
    - "개발팀 관리 운영DB PostgreSQL write"
    - "firstTouch strict 승격"
    - "payment_success top-level attribution overwrite"
    - "scheduler/dispatcher ON"
  source_window_freshness_confidence:
    source: "TJ 관리 Attribution VM SQLite tiktok_pixel_events + attribution_ledger + tiktok_events_api_shadow_candidates"
    window: "최근 7일, sourceLimit=10000, selectedShadowRows=50"
    freshness: "2026-05-04 14:09 KST apply 직후"
    site: "biocom"
    confidence: 0.95
```

## 한 줄 결론

기존 shadow 후보 17건의 false-positive 위험을 닫고, 새 로직으로 50건을 shadow-only 재생성했다.

결과는 보수적으로 바뀌었다. 최근 7일 전체 후보 502건 중 Events API 미래 후보는 1건뿐이고, 기존 canary 주문 `202605036519253`은 `no_tiktok_evidence`로 차단됐다.

## 완료한 것

| 항목 | 결과 | 근거 | 데이터/DB 위치 |
|---|---|---|---|
| 로컬 후보 로직 보강 | 완료 | evidence는 주문 연결 row만 인정, `evidence_link_type`/row id/source refs 추가 | 로컬 개발 코드 |
| 로컬 테스트 | 통과 | `npx tsx --test tests/tiktok-events-api-shadow-candidates.test.ts` 6/6 | 로컬 개발 DB 임시 SQLite |
| 로컬 typecheck | 통과 | `npx tsc --noEmit --pretty false` | 해당 없음 |
| VM 파일 백업 | 완료 | `/home/biocomkr_sns/seo/backups/20260504-1456-tiktok-shadow-rebuild` | TJ 관리 Attribution VM |
| VM SQLite 파일 백업 | 완료 | 같은 backup dir의 `crm.sqlite3.before-shadow-rebuild` | TJ 관리 Attribution VM SQLite |
| VM 패치 반영 | 완료 | backend source/script/test 5개 파일 반영 | TJ 관리 Attribution VM |
| VM 테스트/typecheck | 통과 | 테스트 6/6, typecheck 0 error | TJ 관리 Attribution VM |
| VM dry-run | 완료 | 전체 후보 502건, eligible 1건, blocked 501건, write 0건 | TJ 관리 Attribution VM SQLite read |
| 기존 v1 row 백업 | 완료 | `tiktok_events_api_shadow_candidates_backup_20260504_rebuild_v2` 17건 | TJ 관리 Attribution VM SQLite |
| 새 shadow upsert | 완료 | `candidate_version=2026-05-04.shadow.rebuild.v2`, 50건 | TJ 관리 Attribution VM SQLite write |
| 새 후보 검토표 | 완료 | [[tiktok_events_api_shadow_candidate_review_20260504]] | 문서 |

## Dry-Run / Apply 결과

| 지표 | 값 |
|---|---:|
| 전체 source 후보 | 502 |
| selected shadow rows | 50 |
| writtenRows | 50 |
| eligible_for_future_send | 1 |
| blocked | 501 |
| selected row 중 blocked | 49 |
| send_candidate=true | 0 |
| platform_send_status != not_sent | 0 |
| dedupReady | 1 |

Block reason 분포:

| block reason | 전체 후보 건수 |
|---|---:|
| no_tiktok_evidence | 501 |
| pending_virtual_account | 50 |
| not_confirmed | 53 |
| canceled_or_overdue | 9 |
| none | 1 |

## Hard Fail Checks

| Check | Result | 근거 |
|---|---|---|
| 기존 canary `202605036519253`이 eligible=true면 FAIL | PASS | 새 row에서 `eligible_for_future_send=0`, `block_reasons_json=["no_tiktok_evidence"]` |
| 주문과 직접 연결되지 않은 marketing_intent가 evidence로 쓰이면 FAIL | PASS | `marketing_intent_linked=true` row 0건 |
| source_refs_json에 unrelated marketing_intent가 들어가면 FAIL | PASS | linked_refs without order/payment match 0건 |
| evidence_link_type 없이 TikTok evidence가 붙으면 FAIL | PASS | evidence present but link_type missing 0건 |
| 50건 초과 insert 금지 | PASS | 새 version row 50건 |
| 모든 row send_candidate=false | PASS | violation 0건 |
| 모든 row platform_send_status=not_sent | PASS | violation 0건 |
| raw/hash PII 저장 금지 | PASS | `pii_in_payload=0`, payload preview PII regex violation 0건 |
| TikTok Events API production send 금지 | PASS | 실행한 CLI는 shadow-only, TikTok endpoint 호출 없음 |
| TikTok Test Events send 금지 | PASS | Test Events 호출 없음 |
| 개발팀 관리 운영DB PostgreSQL write 금지 | PASS | 운영DB 접속/write 없음 |

## 핵심 해석

이번 결과는 TikTok Events API를 바로 확대할 근거가 아니라, 오히려 확장을 막는 근거다.

TikTok Pixel Purchase는 사이트 결제완료 페이지에서 많이 발생한다. 하지만 새 로직 기준으로 주문 연결 TikTok evidence가 있는 confirmed 주문은 502개 후보 중 1건뿐이다. 이 말은 “브라우저 픽셀이 Purchase를 보냈다”와 “TikTok 광고로 온 주문이다”가 완전히 다르다는 뜻이다.

기존 canary 1건은 API 수신은 성공했지만, 내부 귀속 기준으로는 TikTok 주문이 아니었다. 이 주문은 새 후보표에서 C등급 차단 대상으로 고정한다.

## 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `backend/src/attribution.ts` | attribution ledger row id를 후보 source refs에 남길 수 있게 optional `entryId` 추가 |
| `backend/src/attributionLedgerDb.ts` | SQLite `entry_id`를 `AttributionLedgerEntry.entryId`로 매핑 |
| `backend/src/tiktokEventsApiShadowCandidates.ts` | 주문 연결 evidence만 인정, evidence link metadata/source refs 추가, 새 candidate version 적용 |
| `backend/scripts/tiktok-events-api-shadow-candidates.ts` | source 조회 limit과 shadow write limit 분리, selected row 우선순위 추가 |
| `backend/tests/tiktok-events-api-shadow-candidates.test.ts` | unrelated marketing intent 차단과 evidence link 필드 회귀 테스트 강화 |
| `tiktok/tiktok_events_api_shadow_candidate_review_20260504.md` | 새 후보 50건 human-readable 검토표 |

## 남은 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| eligible 1건도 production send 승인 근거로는 아직 약함 | TikTok 최적화 신호를 잘못 보낼 수 있음 | Test Events만 별도 Yellow 승인 또는 production send는 Red Lane 유지 |
| `global_intent_excluded_count=4754` | TikTok 클릭 intent가 많지만 주문 연결이 대부분 안 됨 | firstTouch/checkout 연결 품질을 계속 모니터링 |
| v1 row 15건이 main table에 남아 있음 | 옛 version row를 실수로 읽으면 혼동 가능 | 화면/API/문서에서 최신 candidate_version을 명시해서 조회 |

## 다음 액션

| Lane | 옵션 | 추천도/자신감 | 담당 | 무엇을 하는가 | 왜 하는가 | Codex가 대신 가능한가 | 어떻게 하는가 | 어디에서 확인하나 | 성공 기준 | 실패 시 해석/대응 | 다른 에이전트 검증 | 승인 필요 |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|
| Green | A | 95% | Codex | `/ads/tiktok`과 문서에서 Events API 후보는 `candidate_version=2026-05-04.shadow.rebuild.v2`만 보도록 정리한다 | v1 false-positive 후보를 사람이 다시 승인 근거로 쓰는 것을 막기 위해서다 | YES | read-only API/UI 문구 확인 후 필요 시 화면 문구만 수정 | 로컬 `http://localhost:7010/ads/tiktok`, TJ 관리 Attribution VM read-only | 화면/문서가 v2 기준을 명확히 표시 | v1 숫자가 섞이면 source filter를 추가 | 불필요 | NO |
| Yellow | B | 70% | TJ + Codex | eligible 1건을 TikTok Test Events only 후보로 다시 검토한다 | 서버 payload 형식 검증은 가능하지만, 후보가 1건뿐이라 확대 판단은 아직 이르다 | 부분 가능. Test Event Code와 TikTok UI 확인은 TJ님 권한 필요 | 별도 승인 후 Test Events endpoint 1건 이하 전송 | TikTok Events Manager Test Events, TJ 관리 Attribution VM shadow row | Test Events에만 표시되고 production event로 잡히지 않음 | 미수신이면 token/event_id/payload 검토 | 권장 | YES |
| Red | C | 10% | TJ + Codex | TikTok Events API production send를 추가 진행한다 | 현재 evidence가 너무 적어 최적화 신호 오염 위험이 크다 | NO. 명시 승인 전 금지 | 별도 Red 승인 문서와 다른 에이전트 검증 후 1건 canary부터 | TikTok Events Manager Overview/Diagnostics | 중복/오귀속 없이 표시 | gap이 더 커지면 즉시 중단 | 권장 | YES |

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

No-send verified: YES
No-platform-send verified: YES
No operating DB write verified: YES
No GTM change verified: YES
No Purchase Guard change verified: YES
VM SQLite write: YES, 승인된 shadow-only 50건 범위 안
