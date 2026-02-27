# 문서 관리 정책 v1.0

> 작성일: 2026-02-26
> 작성: 헤파이스토스(코딩 에이전트)
> 대상: `/Users/vibetj/coding/seo/` 프로젝트

---

## 1. 현황 진단

### 1.1 수량

| 위치 | 파일 수 | 비고 |
|------|:-------:|------|
| 프로젝트 루트 (`*.md`) | **66개** | 전체 ~470KB |
| `frontend/README.md` | 1개 | Next.js 기본 생성 |
| `AGENTS.md` | 1개 | 레포 가이드라인 |
| **합계** | **68개** | node_modules 제외 |

### 1.2 카테고리 분류

| 카테고리 | 파일 수 | 파일 패턴 | 예시 |
|----------|:-------:|-----------|------|
| **코어 문서** | 3 | `AGENTS.md`, `objective*.md`, `apisolution*.md` | 프로젝트 목적, API 현황 |
| **Phase 기획** | 4 | `phase*.md`, `roadmap*.md` | 로드맵, 단계별 계획 |
| **기능 개발 (newfunc)** | 8 | `newfunc*.md` | 백엔드 기능 확장 |
| **프론트 UI/UX (front)** | 11 | `front*.md` | 디자인 프롬프트 |
| **성능/진단** | 5 | `pagespeed*.md`, `lcpfcp*.md`, `pageanal*.md`, `0212result*.md` | PageSpeed, CWV |
| **AI Citation (report0221)** | 10 | `report0221-*.md` | AEO 점수 개발 |
| **AIO 가중치** | 1 | `aio포함여부및가중치산식.md` | 의사결정 기록 |
| **GA4 AI 트래픽 (report02xx)** | 4 | `report0222*.md`, `report0223*.md`, `report0225*.md` | AI 유입 구현 |
| **일일 피드백 (feedback0226)** | 20 | `feedback0226*.md` | 요청-응답 쌍 |
| **작업 계획/현황** | 2 | `next*.md`, `codexreport*.md` | 다음 작업 계획, Codex 작업 리포트 |
| **합계** | **68** | | |

### 1.3 문제점

1. **루트 디렉토리 오염**: 66개 md 파일이 루트에 혼재 → 코드 파일과 구분 어려움
2. **명명 규칙 불일치**: `report0221-*`, `feedback0226*`, `front*`, `newfunc*` 등 5개 이상 패턴 혼용
3. **버전 추적 불가**: `newfunc.md → 1.1 → 1.2 → ... → 2.1` 체인이 있으나 어떤 것이 최신인지 파일명만으로 판단 어려움
4. **폐기 문서 미표시**: `newfunc.md`, `newfunc1.1.md` 등은 이미 `newfunc2.1.md`로 대체되었으나 삭제/이동 없음
5. **역할 구분 없음**: 요청(prompt)과 결과(reply)가 같은 레벨에 혼재
6. **날짜 인코딩 혼재**: `report0221-*` (4자리 날짜), `feedback0226*` (4자리 날짜), `0212result*` (4자리 날짜) — 형식은 유사하나 위치가 접두/접미 혼재
7. **docs/ 폴더 부재**: 글로벌 CLAUDE.md에서 권장하는 `docs/` 구조가 이 프로젝트에는 없음

---

## 2. 제안 디렉토리 구조

```
/Users/vibetj/coding/seo/
├── AGENTS.md                          # 레포 가이드라인 (유지)
├── roadmap0226.md                     # 현행 로드맵 (루트 유지 — 빠른 접근)
├── next1.0.md                         # ★ 다음 작업 계획 (Sprint 단위, 실행 우선순위)
├── codexreport1.0_0226.md             # ★ Codex 백엔드 최신 작업 리포트
├── document1.0.md                     # 본 문서 관리 정책
│
├── docs/                              # ★ 신규 생성
│   ├── core/                          # 코어 문서 (프로젝트 정의, 의사결정)
│   │   ├── objective1.0.md
│   │   ├── apisolution1.0.md
│   │   └── aio-weighting-decision.md  # (aio포함여부및가중치산식.md 이동+개명)
│   │
│   ├── phase/                         # Phase별 기획 문서
│   │   ├── phase1.md
│   │   ├── phase1.1.md
│   │   └── phase1.2.md
│   │
│   ├── feature/                       # 기능 개발 스펙/프롬프트
│   │   ├── newfunc2.1.md              # ← 최신 버전만 유지
│   │   ├── newfunc2.0.md
│   │   ├── pageanal1.0.md
│   │   └── pagespeed1.1.md
│   │
│   ├── frontend/                      # 프론트 UI/UX 프롬프트
│   │   ├── front2.5.md                # ← 최신 시리즈
│   │   ├── front2.4.md
│   │   └── ...
│   │
│   ├── report/                        # 개발 리포트 (날짜별)
│   │   ├── 0226/                      # 2026-02-26 작업
│   │   │   ├── feedback-back1.0.md
│   │   │   ├── feedback-back1.0-reply.md
│   │   │   ├── feedback-front1.0.md
│   │   │   ├── feedback-front1.0-reply.md
│   │   │   ├── feedback-front2.0.md
│   │   │   ├── feedback-front2.0-reply.md
│   │   │   ├── feedback-codex1.0.md
│   │   │   └── feedback-codex1.0-reply.md
│   │   ├── 0225/
│   │   │   └── frontmenu1.0.md
│   │   ├── 0223/
│   │   ├── 0222/
│   │   ├── 0221/
│   │   └── 0212/
│   │
│   └── archive/                       # 폐기/대체된 문서
│       ├── newfunc.md                 # newfunc2.1으로 대체됨
│       ├── newfunc1.1.md
│       ├── ...
│       └── pagespeed1.0.md            # 1.1로 대체됨
│
└── (기존 코드 파일들)
```

---

## 3. 명명 규칙 (Naming Convention)

### 3.1 파일명 형식

```
{카테고리}-{주제}-{버전}.md           # 일반 문서
{카테고리}-{주제}-{버전}-reply.md     # 응답 문서
```

### 3.2 카테고리 접두어

| 접두어 | 용도 | 예시 |
|--------|------|------|
| `spec-` | 기능 스펙/PRD | `spec-ai-traffic-2.0.md` |
| `prompt-` | AI 에이전트 작업 지시 | `prompt-front-kpi-card.md` |
| `report-` | 개발 결과 리포트 | `report-front-kpi-card-reply.md` |
| `decision-` | 의사결정 기록 | `decision-aio-weighting.md` |
| `analysis-` | 분석/조사 결과 | `analysis-pagespeed-1.1.md` |
| `roadmap-` | 로드맵/진행률 | `roadmap-0226.md` |

### 3.3 버전 규칙

- 마이너 변경: `1.0 → 1.1 → 1.2`
- 메이저 변경 (방향 전환): `1.x → 2.0`
- **최신 버전이 아닌 파일**은 `docs/archive/`로 이동

### 3.4 날짜 인코딩

- 파일명에 날짜가 필요한 경우: `MMDD` 형식 (예: `0226`)
- 리포트 폴더: `docs/report/MMDD/`
- 문서 내부 헤더에 full date 기재: `2026-02-26`

---

## 4. 문서 라이프사이클

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Draft   │───▶│  Active  │───▶│ Superseded│───▶│ Archived │
│  (작성중)  │    │  (현행)   │    │  (대체됨)  │    │  (보관)   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

| 상태 | 위치 | 설명 |
|------|------|------|
| **Draft** | 해당 카테고리 폴더 | 작성 중 — 파일 상단에 `> ⚠️ DRAFT` 표기 |
| **Active** | 해당 카테고리 폴더 | 현행 유효 문서 |
| **Superseded** | 해당 카테고리 폴더 | 신버전 존재 — 파일 상단에 `> ⛔ SUPERSEDED by {파일명}` 표기 |
| **Archived** | `docs/archive/` | 더 이상 참조 불필요 — 히스토리 보존 목적 |

---

## 5. 즉시 실행 가능한 정리 계획

### 5.1 Phase A: docs/ 폴더 생성 + 코어 문서 이동 (소규모)

```bash
mkdir -p docs/{core,phase,feature,frontend,report/{0212,0221,0222,0223,0225,0226},archive}
```

이동 대상 (6개):
- `objective1.0.md` → `docs/core/`
- `apisolution1.0.md` → `docs/core/`
- `aio포함여부및가중치산식.md` → `docs/core/decision-aio-weighting.md`
- `phase1.md`, `phase1.1.md`, `phase1.2.md` → `docs/phase/`

### 5.2 Phase B: 리포트/피드백 정리 (중규모)

이동 대상 (34개):
- `report0221-*.md` (10개) → `docs/report/0221/`
- `report0222*.md` (2개) → `docs/report/0222/`
- `report0223*.md` (2개) → `docs/report/0223/`
- `report0225*.md` (1개) → `docs/report/0225/`
- `feedback0226*.md` (20개) → `docs/report/0226/`
  - 파일명에서 `feedback0226` 접두어 제거하여 간결화

### 5.3 Phase C: 기능/프론트 문서 정리 + 아카이브 (대규모)

이동 대상 (26개):
- `newfunc2.0.md`, `newfunc2.1.md` → `docs/feature/` (최신 유지)
- `newfunc.md` ~ `newfunc1.9.md` → `docs/archive/` (대체됨)
- `front*.md` (11개) → `docs/frontend/`
- `pagespeed1.1.md`, `pageanal1.0.md`, `lcpfcp1.0.md` → `docs/feature/`
- `pagespeed1.0.md` → `docs/archive/` (1.1로 대체됨)
- `0212result1.0.md` → `docs/report/0212/`

### 5.4 루트에 남는 파일 (정리 후)

```
/Users/vibetj/coding/seo/
├── AGENTS.md              # 레포 가이드라인
├── roadmap0226.md         # 현행 로드맵 (빠른 접근)
├── next1.0.md             # ★ 다음 작업 계획 — Sprint별 할 일 + 진행 상황
├── codexreport1.0_0226.md # ★ Codex 백엔드 최신 작업 리포트
├── document1.0.md         # 본 문서 관리 정책
└── docs/                  # 전체 문서 (66개 → 구조화)
```

> **루트 유지 기준**: "지금 당장 열어서 확인해야 하는 실행 문서"는 루트에 둔다.
> - `roadmap*.md` — 전체 방향 + 진행률
> - `next*.md` — 구체적인 다음 할 일 (Sprint 단위)
> - `codexreport*.md` — 백엔드 에이전트(Codex) 최신 작업 결과
> - 이들은 버전이 올라가면 이전 버전을 `docs/archive/`로 이동

---

## 6. 요청-응답 쌍 관리 규칙

현재 프로젝트의 핵심 패턴인 **요청(prompt) → 응답(reply)** 쌍에 대한 규칙:

### 6.1 파일 쌍 규칙

```
{주제}-{버전}.md          # 요청 (TJ님 → 에이전트)
{주제}-{버전}-reply.md    # 응답 (에이전트 → TJ님)
```

- 요청과 응답은 **반드시 같은 폴더**에 위치
- 응답 파일명은 요청 파일명 + `-reply` 접미어
- 한 요청에 여러 응답이 필요하면: `-reply1.md`, `-reply2.md`

### 6.2 응답 파일 필수 헤더

```markdown
# {제목} — 응답

> 요청 문서: `{요청파일경로}`
> 작성일: YYYY-MM-DD
> 작성: 헤파이스토스(코딩 에이전트)
```

---

## 7. .gitignore 권장 사항

현재 모든 md 파일이 git에 추적 대상이오. 다음을 고려:

```gitignore
# 아카이브된 문서는 git 추적 제외 (선택)
# docs/archive/

# 드래프트 문서 (선택)
# *-DRAFT.md
```

> **판단 기준**: 아카이브 문서를 git 히스토리로 보존할지, 폴더로 보존할지는 TJ님이 결정하시면 되오.
> - git 히스토리 보존 → archive 문서 삭제 후 `git log`로 추적
> - 폴더 보존 → `docs/archive/`에 유지 (현재 권장)

---

## 8. 현재 파일 전체 매핑 (현행 → 제안)

### 코어 문서

| 현재 위치 | 제안 위치 | 상태 |
|-----------|-----------|------|
| `AGENTS.md` | `AGENTS.md` (유지) | Active |
| `objective1.0.md` | `docs/core/objective1.0.md` | Active |
| `apisolution1.0.md` | `docs/core/apisolution1.0.md` | Active |
| `aio포함여부및가중치산식.md` | `docs/core/decision-aio-weighting.md` | Active |

### 작업 계획/현황 (루트 유지)

| 현재 위치 | 제안 위치 | 상태 | 비고 |
|-----------|-----------|------|------|
| `next1.0.md` | `next1.0.md` (루트 유지) | Active | Sprint별 다음 작업 계획 + 진행률 — Claude Code/Codex 담당 구분 |
| `codexreport1.0_0226.md` | `codexreport1.0_0226.md` (루트 유지) | Active | Codex(백엔드) server.ts 라우터 분리 결과 리포트 |

> **규칙**: 버전이 올라가면 이전 버전은 `docs/archive/`로 이동. 루트에는 항상 최신 버전 1개만 유지.

### Phase 기획

| 현재 위치 | 제안 위치 | 상태 |
|-----------|-----------|------|
| `phase1.md` | `docs/phase/phase1.md` | Completed |
| `phase1.1.md` | `docs/phase/phase1.1.md` | Completed |
| `phase1.2.md` | `docs/phase/phase1.2.md` | Active |
| `roadmap0226.md` | `roadmap0226.md` (루트 유지) | Active |

### 기능 개발 (newfunc)

| 현재 위치 | 제안 위치 | 상태 |
|-----------|-----------|------|
| `newfunc.md` | `docs/archive/newfunc.md` | Superseded by 1.1 |
| `newfunc1.1.md` | `docs/archive/newfunc1.1.md` | Superseded by 1.2 |
| `newfunc1.2.md` | `docs/archive/newfunc1.2.md` | Superseded by 1.3 |
| `newfunc1.3.md` | `docs/archive/newfunc1.3.md` | Superseded by 1.4 |
| `newfunc1.4.md` | `docs/archive/newfunc1.4.md` | Superseded by 1.5 |
| `newfunc1.5.md` | `docs/archive/newfunc1.5.md` | Superseded by 1.6 |
| `newfunc1.6.md` | `docs/archive/newfunc1.6.md` | Superseded by 1.7 |
| `newfunc1.7.md` | `docs/archive/newfunc1.7.md` | Superseded by 1.8 |
| `newfunc1.8.md` | `docs/feature/newfunc1.8.md` | Active (GA4 AI 트래픽 가이드) |
| `newfunc1.9.md` | `docs/archive/newfunc1.9.md` | Superseded by 2.0 |
| `newfunc2.0.md` | `docs/feature/newfunc2.0.md` | Active |
| `newfunc2.1.md` | `docs/feature/newfunc2.1.md` | Active (최신) |

### 프론트 UI/UX

| 현재 위치 | 제안 위치 | 상태 |
|-----------|-----------|------|
| `front1.0.md` ~ `front1.4.md` | `docs/frontend/` | Active (각각 독립 프롬프트) |
| `front2.0.md` ~ `front2.5.md` | `docs/frontend/` | Active |

### 성능/진단

| 현재 위치 | 제안 위치 | 상태 |
|-----------|-----------|------|
| `pagespeed1.0.md` | `docs/archive/pagespeed1.0.md` | Superseded by 1.1 |
| `pagespeed1.1.md` | `docs/feature/pagespeed1.1.md` | Active |
| `lcpfcp1.0.md` | `docs/feature/lcpfcp1.0.md` | Active |
| `pageanal1.0.md` | `docs/feature/pageanal1.0.md` | Active |
| `0212result1.0.md` | `docs/report/0212/result1.0.md` | Historical |

### 리포트/피드백

| 현재 위치 | 제안 위치 | 비고 |
|-----------|-----------|------|
| `report0221-*.md` (10개) | `docs/report/0221/` | 파일명에서 `report0221-` 제거 |
| `report0222*.md` (2개) | `docs/report/0222/` | |
| `report0223*.md` (2개) | `docs/report/0223/` | |
| `report0225*.md` (1개) | `docs/report/0225/` | |
| `feedback0226*.md` (20개) | `docs/report/0226/` | 파일명에서 `feedback0226` 제거 |

---

## 9. 향후 신규 문서 작성 가이드

### 새 기능 개발 시

```
docs/feature/spec-{기능명}-{버전}.md        # 스펙/프롬프트
docs/feature/spec-{기능명}-{버전}-reply.md  # 결과
```

### 일일 피드백 사이클

```
docs/report/MMDD/
├── {담당}-{주제}-{버전}.md          # back, front, codex 등
└── {담당}-{주제}-{버전}-reply.md
```

### 의사결정 기록

```
docs/core/decision-{주제}.md
```

### 로드맵/작업 계획 갱신

```
roadmap{MMDD}.md                     # 루트에 유지 — 전체 방향
next{버전}.md                         # 루트에 유지 — 구체적 Sprint 할 일
codexreport{버전}_{MMDD}.md           # 루트에 유지 — Codex 최신 작업 결과
```
이전 버전은 `docs/archive/`로 이동. **루트에는 최신 1개만 유지.**

---

## 10. 실행 우선순위 제안

| 우선순위 | 작업 | 영향 | 난이도 |
|:--------:|------|:----:|:------:|
| **P0** | `docs/` 폴더 구조 생성 | 즉시 개선 | 쉬움 |
| **P0** | 아카이브 대상 이동 (newfunc 구버전 등) | 루트 정리 | 쉬움 |
| **P1** | 리포트/피드백 날짜별 정리 | 34개 파일 이동 | 중간 |
| **P1** | 기능/프론트 문서 이동 | 20개 파일 이동 | 중간 |
| **P2** | 파일명 통일 (접두어 정리) | 가독성 향상 | 중간 |
| **P2** | 각 문서 상단에 상태 배지 추가 | 추적 용이 | 쉬움 |

> **TJ님의 승인을 받은 후 Phase A부터 순차 실행하면 되겠소.**
> 한 번에 전체 이동하면 기존 참조가 깨질 수 있으니, Phase 단위로 진행하는 것을 권장하오.
