# Harness document inventory

작성 시각: 2026-05-10 00:30 KST

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - docurule.md
    - docs/report/text-report-template.md
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
    - harness/gdn/APPROVAL_GATES.md
    - harness/gdn/AUDITOR_CHECKLIST.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/AUTONOMY_POLICY.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/npay-recovery/AUDITOR_CHECKLIST.md
  lane: Green documentation inventory
  allowed_actions:
    - local document read
    - rule proposal
    - gptconfirm packaging
  forbidden_actions:
    - operating deploy
    - GTM publish
    - DB write
    - platform send
  source_window_freshness_confidence:
    source: repo-local markdown inventory
    window: 2026-05-10 00:30 KST
    site: biocom
    freshness: same-session
    confidence: high
```

## 한 줄 결론

Green 자동 진행 원칙은 이미 여러 문서에 있지만, `HOLD가 나오면 자동으로 원인을 줄이는 Green 분석을 계속한다`는 강제 규칙은 아직 명시적으로 약합니다. GTM workspace lifecycle 규칙은 공통 하네스에는 이미 들어갔고, GDN 검증/승인 문서와 보고 템플릿에 연결하는 보강이 필요합니다.

## 문서별 역할과 우선순위

| 우선순위 | 문서 | 역할 | 현재 관련 규칙 | 보강 필요 |
|---:|---|---|---|---|
| 1 | `AGENTS.md` | 저장소 최상위 에이전트 규칙. 대화 결과보고, Green/Yellow/Red, DB 용어를 강제 | Green Lane 자율 진행, Yellow 재승인 반복 금지, VM Cloud/운영DB/로컬 용어 정리 | HOLD Reducer 한 줄 원칙 추가 권장 |
| 2 | `CLAUDE.md` | seo 프로젝트 로컬 실행 맥락과 Growth Data bootstrap | Green은 audit와 scoped commit/push까지 진행, Red는 명시 승인 전 중단 | HOLD Reducer는 없음. high-level 요약 추가 가능 |
| 3 | `harness/common/HARNESS_GUIDELINES.md` | Growth Data 공통 하네스 기준판 | Lane, momentum, Green autonomy, Yellow continuation, GTM Workspace Hygiene Rule 존재 | GTM lifecycle은 이미 있음. HOLD Reducer 섹션만 추가 권장 |
| 4 | `harness/common/AUTONOMY_POLICY.md` | Green/Yellow/Red별 에이전트 자율 실행 기준 | Green 자동 진행, Yellow 승인 후 끝까지 진행 | HOLD result 발생 시 Green follow-up 자동 수행 규칙 추가 최우선 |
| 5 | `harness/common/REPORTING_TEMPLATE.md` | 공통 결과보고, 승인요청, Auditor verdict 형식 | 다음 액션 판단 질문, blocked/access 구분 | `hold_reason`, `auto_green_followups_done` 필드 추가 권장 |
| 6 | `docurule.md` | 정본/결과보고서 작성 규칙 | 다음 할일 3 bucket, Auto Green 오래 두지 않기, Blocked/Parked 재개조건 | HOLD 보고서 구조와 원인 taxonomy 추가 권장 |
| 7 | `docs/report/text-report-template.md` | 대화/텍스트 보고용 축약 템플릿 | 진척률, 다음 액션, No-Send/No-Write 확인 | HOLD Reducer와 GTM lifecycle 필드 추가 권장 |
| 8 | `harness/gdn/README.md` | Google Ads/GDN ROAS 하네스 진입 문서 | Google Ads/GTM/VM Cloud read-only와 금지선 | GDN 특화 HOLD Reducer 요약 추가 가능 |
| 9 | `harness/gdn/RULES.md` | GDN ROAS, 전환 액션, send candidate 판정 규칙 | `send_candidate=N`, block_reason, Google click id required | Path B `identity_only_quarantine`, missing_click_bridge 후속 Green 분석 예시 추가 권장 |
| 10 | `harness/gdn/VERIFY.md` | GDN 작업 검증 명령과 기준 | no-send/no-write, GTM/tracking 검증 | GTM workspace capacity/live unchanged/write flag 순서 검증 추가 권장 |
| 11 | `harness/gdn/APPROVAL_GATES.md` | GDN 승인 레벨과 Yellow/Red 경계 | GTM Preview workspace Yellow, Production publish Red | Preview workspace lifecycle 승인 조건 추가 권장 |
| 12 | `harness/gdn/AUDITOR_CHECKLIST.md` | GDN 작업 종료 auditor hard/soft fail | 승인 없는 send/write/publish/deploy hard fail | HOLD Reducer와 GTM lifecycle auditor 항목 추가 최우선 |
| 13 | `docs/agent-harness/growth-data-harness-v0.md` | 초기 설계/배경 문서 | v0 원칙, 파일별 역할, 권한 모델 | 기준판이라 즉시 patch보다 proposal 링크 권장 |
| 14 | `harness/npay-recovery/README.md` | NPay recovery 하네스 진입 문서 | NPay intent와 confirmed order 매칭 흐름 | 이번 변경은 GDN/Path B 중심. cross-project patch는 later |
| 15 | `harness/npay-recovery/AUTONOMY_POLICY.md` | NPay recovery 자율 실행 기준 | block source만 blocked 처리하고 다음 read-only source 계속 확인 | HOLD Reducer와 가장 가까운 선례. common으로 역수입 가능 |
| 16 | `harness/npay-recovery/RULES.md` | NPay recovery 매칭/전송 차단 규칙 | send_candidate=N, block reason | 공통 taxonomy와 매핑 가능 |
| 17 | `harness/npay-recovery/VERIFY.md` | NPay recovery 검증 명령 | no-send/no-write/wiki link 검증 | 이번 patch 대상 우선순위 낮음 |
| 18 | `harness/npay-recovery/APPROVAL_GATES.md` | NPay recovery 승인 게이트 | L0-L3 자율, L4+ 승인 | 이번 patch 대상 우선순위 낮음 |
| 19 | `harness/npay-recovery/AUDITOR_CHECKLIST.md` | NPay recovery auditor | hard/soft fail, send_candidate 기본값 | HOLD Reducer auditor 선례로 참고 |
| 20 | `plans.md` 또는 `**/plans.md` | 계획 문서 후보 | repo에서 발견되지 않음 | 해당 없음 |

## 현재 규칙 갭

1. HOLD가 나오면 바로 `TJ님 승인 필요`로 넘기지 말라는 규칙이 공통 문서에 강제되어 있지 않습니다.
2. HOLD 원인 taxonomy가 문서마다 다릅니다.
3. 결과보고서에 `auto_green_followups_done` 필드가 없습니다.
4. GTM workspace lifecycle은 공통 하네스에 이미 있지만, GDN `VERIFY`, `APPROVAL_GATES`, `AUDITOR_CHECKLIST`에 체크 항목으로 내려오지 않았습니다.
5. ReportAuditor가 HOLD와 GTM workspace 순서 위반을 자동으로 잡는 규칙이 아직 문서화되지 않았습니다.

## 권장 적용 순서

1. 공통 자율정책과 보고 템플릿에 HOLD Reducer를 추가합니다.
2. `docurule.md`에 HOLD 보고서 구조를 추가합니다.
3. GDN 하네스에 Path B/GTM workspace 구체 체크를 추가합니다.
4. AGENTS/CLAUDE에는 중복 본문을 넣지 말고 상위 원칙 한 줄과 common 링크만 추가합니다.
5. NPay recovery는 이번 작업에서 직접 patch하지 않고, 공통 rule 적용 후 필요할 때 반영합니다.
