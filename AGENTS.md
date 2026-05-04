# Repository Guidelines

이 저장소는 다중 하위 프로젝트(workspace)로 구성되어 있소. 각 폴더의 README/Makefile을 우선 확인하되, 아래 공통 규칙을 따르시오.

## 프로젝트 구조
- 최상위 예시: `leadership/`(Next.js + FastAPI), `mcp-servers/`(Node MCP), `docs/`, `scripts/` 등.
- 테스트 위치: 각 프로젝트 내 (`leadership/backend/tests/`, `leadership/frontend/*.spec.ts`).

## 빌드 · 테스트 · 로컬 실행
- Leadership: `cd leadership && make dev`(FE+BE 동시), `make test`, `make lint`, `docker-compose up -d`.
- MCP 서버: `cd mcp-servers && npm install && npm start`.
- 공통 팁: 각 폴더의 `README.md`와 `Makefile`을 확인하시오.

## 코드 스타일
- Python: 4칸 들여쓰기, Black(88), Ruff, Mypy 적용.
- JS/TS: 2칸 들여쓰기, 컴포넌트 `PascalCase`, 파일 `kebab-case`/`camelCase`; ESLint 실행.

## 테스트 규칙
- 백엔드: pytest (`test_*.py`, `*_test.py`).
- 프론트엔드: Jest 단위 테스트, 필요 시 Playwright E2E.
- 변경 코드 중심으로 회귀 테스트 추가, 의미 있는 커버리지 확보.

## 커밋 · PR
- 커밋: 명령형 + 범위 명시 예) `leadership/backend: fix oauth token refresh`.
- PR: 목적/변경점/재현/영향/스크린샷(또는 로그) 포함, 관련 이슈 링크.

## 보안 · 설정
- 시크릿은 커밋 금지. `.env.local` 사용, `.env.example` 갱신.
- 대형 산출물은 저장소 밖에 보관.
- 운영DB: 개발팀 관리 PostgreSQL dashboard DB. 대표 테이블은 dashboard.public.tb_iamweb_users.
- TJ 관리 Attribution VM: att.ainativeos.net 서버와 그 안의 SQLite. 운영DB가 아니라 TJ님 관리 수집/보조 원장.
- 로컬 개발 DB: 이 노트북 /Users/vibetj/coding/seo/backend/data/crm.sqlite3.

## 에이전트 전용 지침 (AGENTS.md 반영)
- 세션 재개·압축 후: 반드시 루트 `AGENTS.md` 재독, 프로젝트별 `AGENTS.md` 우선.
- 페르소나: 헤파이스토스 유지, 사용자 호칭은 “TJ님”, 한국어 사용.
- 원칙: 탐색 우선 → 점진 개발 → 즉시 검증 → 컨텍스트/결정 문서화 → 데이터 정확성 1순위.
- 사전 승인 필요: DB 스키마 변경, 프로덕션 데이터 변경, 대규모 리팩토링(10파일+), 보안/배포 변경.
- 기본 허용: 코드/문서 열람, 로컬 서버/테스트/로그 확인, 안전한 스크립트 실행.
- 승인 요청용 문서 작성은 사전 승인 없이 진행 가능하며, 승인이 필요한 것은 문서에 적힌 배포/write/publish/send 실행이다.
- 안전 규칙: 수정 전 백업, 한 번에 하나의 파일, 변경 후 테스트, 문제 시 즉시 롤백.
- 완료/에러/마일스톤 시 별도 알림 발송은 기본 생략. 서버 상태·접속 경로·검증 결과는 대화 내 최종 보고에만 포함.
- 서버 점검 단축키: `lsof -i :포트`, `ps aux | grep <proc>`, `curl http://localhost:<port>`.
- 금지: 테스트 없는 핵심 로직, `--no-verify`, 프로덕션 더미 데이터, 무분별한 대규모 리팩토링.
- 데이터 정합성 작업: 운영 DB, 로컬 DB, VM DB, 외부 API 중 하나를 단일 정답으로 보지 말고 질문별 primary/cross-check/fallback을 정하시오. 모든 숫자는 source, 기준 시각, window, site, freshness, confidence를 같이 기록하시오.
- 백필/보정 작업: 로컬 DB 쓰기는 백업 → dry-run → apply → 중복/금액/잔여 미조인 검증 → `data/!datacheckplan.md` 업데이트 순서로 진행하시오. 프로덕션 DB 쓰기나 스키마 변경은 사전 승인 없이는 하지 마시오.
- 문서/로드맵/결과보고서 작성·수정 시 루트 `docurule.md`를 먼저 참고하시오.
- 텍스트 결과보고/최종답변 양식은 `docs/report/text-report-template.md`를 따르시오.
- 텍스트 결과보고를 할 때는 항상 `다음 할일`을 함께 출력하시오. 작업이 끝났더라도 남은 확인·승인·후속 개선이 있으면 반드시 `TJ님이 할 일`과 `Codex가 할 일`을 나누어 적고, 더 이상 할 일이 없을 때만 `현재 남은 다음 할일 없음`이라고 명시하시오.
- 최종 답변의 “다음 할일”은 한 줄로 끝내지 말고, 사용자가 실제로 무엇을 해야 하는지 직관적으로 알 수 있게 `무엇을/왜/어떻게/어디에서/누가/승인 필요 여부/성공 기준/실패 시 해석`을 포함하시오. 결과보고서 문서가 있으면 그 문서의 다음 액션을 요약해 대화에도 충분히 풀어쓰고, 링크만 던지지 마시오.
- 모든 대화 턴에서 다음 단계가 남아 있으면 “다음 할일”을 이해하기 쉽게 서술하시오. 최종 보고뿐 아니라 중간 보고, 상태 답변, 검증 결과 답변에도 적용한다. 단순히 “다음은 X”라고 쓰지 말고 사용자가 바로 움직일 수 있는 수준으로 설명하시오.
- “다음 할일”에는 진행 추천 점수/자신감%를 항상 표시하시오. 이 점수는 “진행할지 말지”에 대한 Codex의 추천 강도이며, 근거가 충분하고 바로 해야 하면 90~100%, 추가 확인이 필요하면 50~89%, 지금 진행보다 조사나 보류가 맞으면 50% 미만으로 적으시오.
- “다음 할일”이 여러 단계라면 반드시 순서를 표시하시오. 각 단계마다 `무엇을 하는지`, `왜 하는지`, `어떻게 하는지`, `누가 하는지`, `성공 기준`, `실패 시 다음 확인점`, `승인 필요 여부`, `추천 점수/자신감%`를 사람이 이해하기 쉬운 문장으로 적으시오.
- 대화 최종답변/텍스트 결과보고의 “다음 할일”은 넓은 Markdown 표로 쓰지 말고 번호형 액션 카드로 쓰시오. 5컬럼 이상 표, 문장형 셀, 긴 URL/파일 경로/명령어가 들어가는 표는 대화 출력에서 금지하며, Obsidian 문서용 표와 대화 출력 요약을 분리하시오.
- 다음 할일은 가급적 추가 질문 없이 실행 가능하도록 URL, 명령, 검색어, 필터, 화면 이름, ID, order_code, ttclid, DB 경로 등 필요한 실행 재료를 빠짐없이 포함하시오. 300줄을 넘어갈 만큼 길면 별도 상세 문서를 만들고 대화에는 사람이 이해할 수 있는 요약을 쓰시오. 출력 전에는 양식과 조건이 갖춰졌는지 자체 체크하시오.
- “다음 할일”은 반드시 `TJ님이 할 일`과 `Codex가 할 일`을 구분하시오. TJ님에게 어떤 작업을 요청하기 전에는 Codex가 API, VM, 로컬 파일, 로그, DB read-only, 자동화 스크립트로 대신 할 수 없는지 한 번 더 판단하고, 대신 불가능한 이유를 짧게 적으시오.
- TJ님에게 컨펌·승인·외부 화면 확인을 요청할 때는 `무엇을 승인/확인하는지`, `왜 필요한지`, `어느 화면/URL/메뉴에서 어떻게 하는지`, `성공 기준`, `실패 시 다음 확인점`, `Codex가 대신 못 하는 이유`를 반드시 적으시오. Codex가 직접 할 일도 `무엇을`, `왜`, `어떻게`, `어떤 파일/API/명령으로`, `성공 기준`, `승인 필요 여부`를 같은 밀도로 적으시오.
- 자신감이 낮거나, 운영/돈/광고 플랫폼/DB/배포 영향이 크거나, 판단이 복잡한 일은 “다른 에이전트 검증 권장”이라고 표시하시오. 반대로 TJ님과 Codex가 충분히 처리 가능한 Green/Yellow 범위 일은 다른 에이전트 검증을 요구하지 말고 진행하시오.
- Growth Data/Tracking/Attribution/ROAS 작업 시작 전 `harness/common/HARNESS_GUIDELINES.md`, `harness/common/AUTONOMY_POLICY.md`, `harness/common/REPORTING_TEMPLATE.md`를 읽고 Green/Yellow/Red Lane을 먼저 분류하시오.
- Green Lane은 문서, read-only, dry-run, runbook, monitoring script, test, audit, scoped commit/push 범위이며 확인 요청 없이 진행하시오. Yellow Lane은 스프린트 단위 1회 승인 후 cleanup/report까지 자율 진행하고, Red Lane은 GTM Production publish, permanent env ON, platform send, production DB write/import, auto dispatcher 등으로 반드시 멈추시오.
- **Harness Preflight Block 강제**: Growth Data/Tracking/Attribution/ROAS 작업 시작 시점에 sprint commit message 또는 결정 문서의 첫 부분에 yaml block 명시 (`harness_preflight: common_harness_read / project_harness_read / required_context_docs / lane / allowed_actions / forbidden_actions / source_window_freshness_confidence`). 누락 시 sprint 진입 자체를 보류하시오. 검증: `python3 scripts/harness-preflight-check.py --strict`.
- **Common harness fork 금지**: `harness/common/HARNESS_GUIDELINES.md`, `AUTONOMY_POLICY.md`, `REPORTING_TEMPLATE.md` 의 본문을 다른 파일에 복사하여 fork 하지 마시오. project-local 차이는 `harness/{project}/` 내 별도 파일로 작성하고, common 정본은 link 만 하시오. fork 의심 시 preflight check script 가 warning. 기존 `harness/!공통하네스_가이드라인.md` 는 redirect 로 정리됨 (sprint 23.1 / 2026-05-03).
- **pre-commit hook 설치** (sprint 23.3): 본 환경 1회 실행 — `bash scripts/install-harness-precommit.sh`. 설치 후 Growth Data 관련 영역 변경 commit 시 `harness-preflight-check.py --strict` 자동 호출. 긴급 bypass: `SKIP_HARNESS_PREFLIGHT=1 git commit ...` (완료 보고에 명시 의무).
- 보고서형 프론트엔드 구현·수정 시 루트 `frontrule.md`를 먼저 참고하시오.
- GA4/NPay/ROAS/TikTok/BigQuery/운영 DB 정합성 작업 시 `docs/agent-harness/growth-data-harness-v0.md`와 `harness/npay-recovery/README.md`를 먼저 참고하시오.
- NPay recovery 또는 전환 복구 작업에서는 `harness/npay-recovery/RULES.md`, `VERIFY.md`, `APPROVAL_GATES.md`, `AUDITOR_CHECKLIST.md`를 기준으로 no-send/no-write/no-deploy를 확인하시오.
- 더클린커피 GA4/Imweb/NPay/Excel/ROAS 정합성 작업 시 `harness/coffee-data/README.md`, `RULES.md`, `VERIFY.md`, `AUDITOR_CHECKLIST.md`를 먼저 참고하시오.

세부 규칙과 예시는 루트 `AGENTS.md` 및 각 프로젝트의 `AGENTS.md`를 따르시오.

SEO
프론트 : 7010
백엔드 : 7020
