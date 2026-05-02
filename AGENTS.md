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
- 최종 답변의 “다음 할일”은 한 줄로 끝내지 말고, 사용자가 실제로 무엇을 해야 하는지 직관적으로 알 수 있게 `무엇을/왜/어떻게/어디에서/누가/승인 필요 여부/성공 기준/실패 시 해석`을 포함하시오. 결과보고서 문서가 있으면 그 문서의 다음 액션을 요약해 대화에도 충분히 풀어쓰고, 링크만 던지지 마시오.
- Growth Data/Tracking/Attribution/ROAS 작업 시작 전 `harness/common/HARNESS_GUIDELINES.md`, `harness/common/AUTONOMY_POLICY.md`, `harness/common/REPORTING_TEMPLATE.md`를 읽고 Green/Yellow/Red Lane을 먼저 분류하시오.
- Green Lane은 문서, read-only, dry-run, runbook, monitoring script, test, audit, scoped commit/push 범위이며 확인 요청 없이 진행하시오. Yellow Lane은 스프린트 단위 1회 승인 후 cleanup/report까지 자율 진행하고, Red Lane은 GTM Production publish, permanent env ON, platform send, production DB write/import, auto dispatcher 등으로 반드시 멈추시오.
- 보고서형 프론트엔드 구현·수정 시 루트 `frontrule.md`를 먼저 참고하시오.
- GA4/NPay/ROAS/TikTok/BigQuery/운영 DB 정합성 작업 시 `docs/agent-harness/growth-data-harness-v0.md`와 `harness/npay-recovery/README.md`를 먼저 참고하시오.
- NPay recovery 또는 전환 복구 작업에서는 `harness/npay-recovery/RULES.md`, `VERIFY.md`, `APPROVAL_GATES.md`, `AUDITOR_CHECKLIST.md`를 기준으로 no-send/no-write/no-deploy를 확인하시오.
- 더클린커피 GA4/Imweb/NPay/Excel/ROAS 정합성 작업 시 `harness/coffee-data/README.md`, `RULES.md`, `VERIFY.md`, `AUDITOR_CHECKLIST.md`를 먼저 참고하시오.

세부 규칙과 예시는 루트 `AGENTS.md` 및 각 프로젝트의 `AGENTS.md`를 따르시오.

SEO
프론트 : 7010
백엔드 : 7020
