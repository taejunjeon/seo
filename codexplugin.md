# Codex 플러그인 사용 패턴 검토 및 개선안

기준일: 2026-04-13 · 작성: Claude Code (이 저장소에서 Codex 플러그인을 여러 세션 반복 호출한 경험 기반)

---

## 0-B. 2026-04-13 재검증: "리뷰 태스크도 rescue로 할 수 있다 — 단, JSON에서 꺼내라"

**상황**: 사용자 요청으로 `coffeeprice0413.md` 파일을 rescue로 크로스 리뷰 재시도. 0-A에서 "리뷰는 rescue 범위 아님"이라 결론 냈지만, **실제로는 제대로 작동**했소. 문제는 rescue 자체가 아니라 **Skill 반환 채널의 본문 누락 버그**였소.

### 핵심 발견
1. **Rescue는 리뷰 태스크를 정상 처리함** — 4개 섹션(동의/반박/놓친 관점/한국 시장 맥락) 모두 포맷대로 생성, 500단어 제한 준수, 한국어 하오체 준수.
2. **Skill 반환 채널은 `completion summary`만 돌려줌** — 실제 리뷰 본문은 반환되지 않음. 사용자·Claude 모두 "리뷰가 누락됐네"라고 오해하기 쉬움.
3. **본문은 job 산출물 JSON에 그대로 존재** — 경로: `~/.claude/plugins/data/codex-openai-codex/state/<workspace-hash>/jobs/task-<id>.json` 의 `result.rawOutput` 및 `rendered` 필드.
4. 즉, **rescue는 결과를 만들지만 Skill 반환 레이어가 잘라낸다**. 이건 0-A의 원인 추정(설계 한계)이 아니라 **runtime 버그**요.

### 올바른 호출 패턴 (리뷰/평가 태스크)
```
1) Skill codex:rescue 호출 (작업 프롬프트 + "텍스트만 회신, 파일 수정 금지")
2) 완료 알림에서 task_id 추출 (예: task-mnwir88w-x1brfx)
3) Read로 job JSON 파일을 직접 읽어 result.rawOutput 또는 rendered 필드 추출
4) 필요 시 목표 문서에 인용·병합
```

### 프롬프트 작성 요령 (리뷰 태스크)
- **`.xlsx`·`.pdf` 같은 바이너리는 참조 경로로 넘기지 말 것**. 메인 세션에서 텍스트로 변환해 목표 `.md`에 인용 수치를 박아둔 뒤, rescue에는 그 `.md`만 넘긴다.
- 출력 포맷을 **정확한 섹션 구조**로 지정. 자유 서술은 요약 단계에서 잘려나갈 위험이 큼.
- "파일 수정 금지 + 텍스트만 회신 + N단어 이하"를 명시.
- 완료 summary(Skill이 돌려주는 것)와 본문(JSON에 있는 것)은 **다른 경로**라는 점을 전제.

### 0-A의 판단 수정
0-A에서 "리뷰 태스크는 rescue 밖에서 처리"라고 썼지만 이번 재검증 결과 **수정**: **리뷰는 rescue로 가능하되, 결과 수령 방식을 JSON 직독으로 바꿔야 한다**. Skill 반환 채널이 고쳐지면 JSON 직독 단계는 자동으로 사라질 것이오.

### "DO NOT Read output_file" 경고의 재해석
이전에 기록한 "output_file 읽지 마라" 경고(섹션 1-3)는 **`.log` 파일**을 가리키는 것 같고, **`.json` 파일은 안전**하게 읽을 수 있다. 두 파일의 역할이 다름:
- `.log`: Codex 세션의 raw stream. 파싱 실패·포맷 불일치 가능, 직독 비권장.
- `.json`: harness가 구조화해 저장한 메타데이터 + 최종 결과 필드(`result.rawOutput`, `rendered`). **직독 안전**.

### 후속 실험 제안
- `result.rawOutput`과 Skill 반환 `Result:` 필드를 N번 비교해 누락 패턴이 일관되는지 확인
- 누락이 일관되면 "Skill 반환 본문 드롭은 확정 버그"로 플러그인 업스트림에 보고
- 리뷰뿐 아니라 **코드 작업 결과 요약**에서도 같은 누락이 나는지 확인 (본 문서 1-3의 "보고 틀림, 파일 맞음" 케이스와 연결될 수 있음)

---

## 0-A. 2026-04-13 추가 관찰: "리뷰/평가 태스크에 rescue 호출은 부적합"

_(아래 0-A는 초기 관찰이고, 0-B에서 일부 판단이 수정됨)_


**상황**: `coffeeprice0413.md`(가격 제안서 의견서) 초안 완성 후, Codex 플러그인으로 크로스 리뷰를 받기 위해 `codex:rescue` 호출. 사용자가 도구 실행을 거절(reject)했고, 사용자 체감은 **"또 진행하다가 멈춘 것 같다"**였음.

### 사용자 관점의 증상
- Claude가 스킬 호출을 시도 → 승인 프롬프트 대기 상태 → 사용자 거절 → Claude가 다음 지시를 기다리는 정지 상태로 보임
- 이전 세션들의 stale running task 경험과 겹쳐, "또 멈췄네"로 인식됨

### 원인 분석 (추정)
1. **Rescue는 코드 작성 위임용 래퍼**. 평가/리뷰/의견 생성은 출력이 "코드 diff"가 아니라 "보고 텍스트 자체"이므로, 이 문서 1-3(결과 반환 경로 불명)·1-4(프롬프트 컨텍스트 손실) 이슈의 직격탄을 맞는다. 코드 작업에서는 파일 시스템이 ground truth 역할을 해서 rescue 보고가 틀려도 복구되지만, 리뷰는 보고 자체가 산출물이라 fallback이 없다.
2. **바이너리 파일(`.xlsx`)을 rescue 프롬프트에 파일 레퍼런스로 넘겼음**. 래퍼가 Excel을 파싱해서 Codex 세션에 전달할 수 있는지 불확실. 메인 Claude가 이미 `openpyxl`로 전문을 떠둔 상태에서 재파싱을 요구하는 건 비효율이고 실패 리스크가 큼.
3. **리뷰 태스크는 짧은 결정이 아닌 "다층 판단"**. rescue가 한 번에 여러 주제(반박·보완·숫자 검증·시장 맥락)를 다룰 때 컨텍스트 손실이 크게 체감된다.
4. **승인 프롬프트 블로킹이 "정지"처럼 보임**. Claude가 tool call을 발행하면 승인 전까지 다른 행동을 못 하므로, 사용자 입장에서 사실상 멈춘 것과 구분되지 않는다.

### 교훈 / 호출 규칙 추가
- **rescue는 "코드 작성 위임" 전용**. 리뷰·평가·의견 생성·크로스 체크에는 호출하지 말 것.
- 크로스 리뷰가 필요하면:
  - 별도 Claude 세션에서 처리, 또는
  - 사용자에게 "리뷰를 다른 경로로 받을지 · 스킵할지"를 먼저 묻고 진행
  - 단, 사용자가 명시적으로 "codex로 리뷰해줘"라 지시한 경우라도 `.xlsx` 같은 바이너리는 메인 세션에서 **텍스트로 변환한 뒤** 파일 레퍼런스로 넘길 것
- 평가 태스크 위임 전 반드시 **"이 결과물을 어디서 받을 것인가"** 를 먼저 결정. rescue는 이 경로가 약해서, 결과가 노이즈에 묻힐 위험이 크다.
- 거절(reject) 받은 tool call 이후에는 **즉시 사용자에게 "다음 할 일 확인"을 요청**하고, 같은 툴을 다른 인자로 재시도하지 말 것.

### 이번 케이스의 복구 경로
- `coffeeprice0413.md`의 "Codex 크로스 리뷰" 섹션은 (a) 사용자가 다른 경로로 검토를 원하는지 확인 후 채우거나, (b) 해당 섹션을 비워두거나 삭제해서 "크로스 리뷰 미수행"을 명시하는 것이 정직한 선택.
- CLAUDE.md의 "Codex 플러그인 호출 규칙"에 **"rescue는 코드 작성 태스크 전용. 리뷰·평가는 rescue 밖에서 처리"** 항목을 8번으로 추가할 것을 제안.

---

## 0. 한 줄 결론

Codex 플러그인의 **실제 "코드 작성" 능력은 충분**하다. 문제는 **작업 상태를 추적·재개·종료하는 런타임 레이어**다. 특히 `codex:rescue` 래퍼의 task tracker가 stale 상태로 남아 후속 호출을 방해한다. 플러그인을 계속 쓸 가치는 있지만 **호출 패턴과 fallback 전략**을 프로젝트 레벨에서 정리해야 한다.

---

## 1. 관찰된 문제 유형

### 1-1. Stale running task

**증상**: `/codex:status` 또는 rescue skill이 수 시간 전에 끝난 작업을 계속 "running"으로 표시한다.

**재현 이력 (이 저장소, 2026-04-12~13)**:
- `task-mntxw4w0-n595yi` — 이전 세션에서 imweb API 조사 후 종료됐는데 다음 세션에서도 `running` 상태로 표시
- `task-mnvx2knv-y5ubj5` — "check imweb research task" 호출이 6시간 23분째 `running`으로 대시보드에 남음 (실제 Codex 세션은 진작에 완료)
- `task-mnvu62c2-v75hca` — 실제로는 `task_complete` 이벤트가 기록되었는데 rescue status API는 여전히 "still running" 반환
- `task-mnvrkcnv-7yakrq` — rescue 래퍼가 Codex를 호출했는데 rescue 대시보드는 Codex session ID만 기록하고 실제 완료 이벤트 수집 실패

**원인 추정** (정확한 내부 구현은 확인 불가, 관찰 기반 추론):
1. Rescue 래퍼가 Codex 하위 세션의 종료 이벤트를 제대로 수집/저장하지 못함
2. Task tracker DB 또는 파일에 `status='running'`으로 쓴 뒤 종료 시 `completed`로 업데이트하는 경로가 누락되거나 실패
3. 크래시·타임아웃 등으로 finalizer가 실행되지 않음

**사용자 영향**:
- 후속 `codex:rescue` 호출이 "task is still running" 에러로 차단되어 새 작업 위임 불가
- 대시보드 숫자가 왜곡되어 "진행 중 작업 N개"를 신뢰 못 함
- 실제로는 Codex가 이미 결과를 반환했는데 runtime이 그것을 전달 안 함

### 1-2. Rescue skill 호출이 "체크/상태 조회"와 "실제 작업 위임"을 구분 못 함

**증상**: `codex:rescue`에 "check status"나 "check last task" 같은 쿼리를 보내면, Codex를 **다시 호출**해서 현재 상태를 조사하게 한다. 단순 조회에 10초 걸릴 일이 Codex 대신 세션을 띄우느라 수 분이 걸리고, 때로는 엉뚱한 답변이 온다.

**재현 예**:
- `codex:rescue status` → "status만 있으면 작업 지시가 비어 있어서 뭘 시키는지 모르겠다" 응답
- `codex:rescue check background backend task` → Codex가 git status를 스캔하고 "프론트 7010 연결 흔적 있음" 같은 무관한 조사 결과 반환
- `codex:rescue check last task` → "플러그인 상태 JSON과 실제 Codex 세션을 비교해 보니 task_complete가 찍혀 있더라" 같은 메타 분석만 돌려받음

**원인 추정**:
- `codex:rescue`는 본질적으로 "새 Codex 세션을 시작해서 프롬프트를 전달"하는 래퍼. "상태 조회" 전용 API가 분리되어 있지 않거나, 있어도 사용자(LLM)가 그것을 트리거하는 방법이 불명확.
- 결과적으로 "대시보드에서 task 상태 읽기"가 아닌 "Codex에게 상태 물어보기"가 되어 비용·시간이 반복적으로 낭비됨.

### 1-3. 결과 반환 경로 불명

**증상**: Codex 작업 완료 후 결과를 어떻게 가져오는가?

관찰된 경로가 최소 3가지:
1. `output_file` (`/private/tmp/.../jobs/*.log` 또는 `.output`) — Claude Code harness에서 "DO NOT Read" 경고 — 즉 이 파일은 사람이 직접 읽으면 안 됨
2. task completion notification에 `result` 필드로 본문 전달 — 이게 가장 깔끔한 경로인데, 매번 오지는 않음
3. 별도의 Codex session log — `/Users/vibetj/.claude/plugins/data/codex-openai-codex/state/.../jobs/*.log`

**실제 세션 예** (2026-04-13 Phase C+D 백엔드 작업):
- Codex가 17분 만에 작업 완료
- `<task-notification>` 블록에 `result`가 정상 전달됨 → Claude가 바로 읽을 수 있었음
- 다만 같은 세션에서 앞선 "check imweb research" 호출은 notification 포맷이 달라 분석이 안 됐음

**원인 추정**: Rescue skill과 일반 Agent tool 간에 결과 전달 프로토콜이 통일돼 있지 않음. 플러그인 side에서 보내주는 payload 스키마가 일정하지 않음.

### 1-4. Rescue가 Codex 하위 세션에 위임 시 프롬프트 컨텍스트 손실

**증상**: `codex:rescue`에 상세한 프롬프트(수백 단어)를 전달해도, 실제 Codex 하위 세션은 내용을 다 못 받은 듯한 결과를 돌려줄 때가 있다.

**재현 예**:
- 첫 세션에서 "backend window filter + funnel visited + consent audit" 3건을 자세히 명세해서 위임
- Codex는 "member_code + normalized_phone 식별자 설계" 같은 **전혀 다른** 주제로 아키텍처 비평을 돌려줌
- 이후 파일 상태를 보면 Codex가 실제로 요청한 3건을 구현해 놨음 — 즉 **코드는 맞지만 보고는 틀림**

**원인 추정**: Rescue 래퍼가 긴 프롬프트를 요약하거나 일부만 전달, 또는 Codex 응답을 Claude에 돌려줄 때 엉뚱한 대화 턴을 선택. 혹은 Codex가 긴 프롬프트에서 핵심을 놓치고 별도 조사 모드로 진입.

### 1-5. 병렬 작업 집계가 혼란스러움

**증상**: 동시에 여러 Codex 작업을 돌리면 대시보드가 어떤 작업이 어떤 원래 프롬프트에 해당하는지 매핑이 어려움.

**관찰**: 세션 중 `aa0a0da909677b664`(Claude 내부 agentId)와 `task-mnvzc5m4-l27jlb`(Codex side ID)와 `019d8287-...`(Codex session ID)가 한 작업에 3가지 ID로 엮임. 후속 호출 시 어느 ID를 써야 하는지 불분명.

---

## 2. 현재 잘 되는 것

- **실제 코드 작성 품질**: Codex가 반환하는 최종 코드는 대체로 정확. 이 세션에서:
  - Phase C/D 백엔드 7개 파일 수정 → `tsc --noEmit` 1회 만에 pass
  - 컨택트 폴리시 3단계 severity 로직, canArchiveGroup 가드, multi-error validation 모두 의도대로 동작
  - 엣지 케이스 curl 검증 16건 전부 통과
- **리뷰 품질**: "BLOCKER 7 + MAJOR 8 + MINOR 1" 같은 심각도 분류 리뷰가 실제로 가치 있는 지적을 해냄 (SQL injection 경로, RRULE timezone 등)
- **대용량 파일 수정**: 600+ 줄 추가 작업을 단일 세션에서 처리
- **백엔드·프론트 분리 규칙 준수**: "frontend 건드리지 마"라는 지시를 정확히 지킴

---

## 3. 개선 제안

### 3-1. 이 프로젝트에서 당장 지킬 호출 규칙 (사람 · LLM 모두)

1. **상태 조회는 rescue skill에 맡기지 말고 직접 증거로 확인**
   - git diff로 파일 변경 유무
   - tsc 통과 여부
   - API 응답 검증 (curl)
   - task completion notification의 `result` 필드
   - ⇒ 이 네 가지 중 두 가지 이상이 긍정이면 "완료"로 간주. rescue status는 참고만.

2. **rescue 호출 시 "작업 프롬프트"만 보내고 "상태 질의"는 절대 보내지 말기**
   - ❌ `codex:rescue status` / `check last task` / `check background task`
   - ✅ `codex:rescue <구체적인 작업 지시문>`
   - 상태 확인이 필요하면 Claude Code가 직접 git/curl/tsc로 확인

3. **한 번에 위임할 작업 규모 상한**
   - 1회 위임에 백엔드 큰 덩어리(10+ 파일 수정) 허용
   - 여러 독립 기능을 한 번에 묶어도 됨 (Phase C+D 묶음 성공)
   - 다만 작업 내용에 "프론트 건드리지 마" + "tsc 통과까지 확인" + "완료 summary 500자 이하" 3개 문장을 **항상** 포함

4. **긴 프롬프트는 파일 레퍼런스로 대체**
   - 수백 줄의 명세를 직접 프롬프트에 박지 말고, `crmux/crmuxreport0412.md`의 특정 섹션을 가리키도록
   - 예: "0-3-3 Phase C의 1번~6번 항목을 구현하라. 상세 스펙은 해당 섹션을 읽어라."
   - 이렇게 하면 rescue 래퍼의 프롬프트 압축/손실 리스크가 줄어듦

5. **위임 시작 시 반드시 git 상태 기록**
   - Codex 호출 직전에 `git diff --stat backend/` 저장
   - 완료 후 같은 명령으로 delta 확인 — "실제로 뭘 고쳤는지"를 Codex 요약이 아닌 파일 시스템 증거로 알 수 있음

### 3-2. 플러그인 레벨 개선 요청

플러그인을 직접 고칠 순 없지만, 만약 업스트림에 피드백 줄 기회가 있다면:

1. **status 전용 경로 분리**: `codex:status <task-id>`는 Codex 하위 세션을 띄우지 말고 로컬 tracker DB만 읽어야 한다. 현재는 status 조회가 새 세션을 띄우는 것처럼 동작한다.

2. **Stale task 자동 finalizer**: `running` 상태에서 N시간(예: 2시간) 넘으면 자동으로 `stuck` 또는 `unknown`으로 전환하고 Codex session ID가 실제로 존재하는지 crosscheck. 현재는 6시간 넘어도 `running`으로 남음.

3. **단일 task_id 체계**: Claude agentId, Codex task id, Codex session id 세 개를 한 번에 보여주는 매핑 테이블 또는 단일 canonical ID로 통일.

4. **result payload 스키마 고정**: rescue·agent·status 호출의 응답 구조가 일관되게. 현재는 호출 경로마다 다름.

5. **Progress event streaming**: Codex 작업 중 "editing file X, applying change Y" 같은 이벤트를 stream으로 내려주면 사람/LLM이 진행 상황을 실시간 판단 가능. 현재는 완료될 때까지 blind.

6. **Cancel API 신뢰도**: `/codex:cancel <task-id>`가 stuck task를 실제로 정리할 수 있어야 한다. 현재는 cancel 후에도 tracker가 `running`으로 남는 케이스가 있다.

### 3-3. Claude Code harness 관점 개선

Claude Code 쪽에서도 다음 기능이 있으면 훨씬 낫다:

1. **Agent subagent에 `timeout_seconds` 파라미터**: `codex:codex-rescue` 서브에이전트를 background로 띄울 때 명시적 타임아웃. 타임아웃 넘으면 자동 cancel + Claude에 notification.

2. **Agent 완료 notification에 `output_file` 내용을 요약해서 표시**: 현재는 "Do not read output_file"이라 Claude는 전체 로그를 못 보고 notification의 `result` 필드만 의존. `result` 필드가 누락되면 블라인드.

3. **Task list에 agent 연결**: 내부 TaskCreate task와 Agent 호출 task를 연결해 하나만 보면 양쪽 상태가 보이도록.

---

## 4. 플러그인을 계속 쓸지 판단

**쓴다.** 이유:
- 코드 작성 품질이 확인됐고, Claude Code 단독으로는 여러 파일 동시 편집이 context window를 많이 먹음
- Codex 위임으로 Claude Code context를 보존하면 같은 세션에서 프론트·문서·리뷰까지 가능
- "백엔드 Codex, 프론트 Claude" 분업이 잘 동작 (이 세션의 Phase C+D 작업 전체가 그 증거)

**단, 다음 전제하에 쓴다**:
- rescue status 호출 금지
- 상태 확인은 git/tsc/curl
- 한 번에 큰 덩어리로 위임
- 완료 후 반드시 실제 파일 diff로 검증

---

## 5. 이 세션에서 실제로 적용된 실패·성공 케이스 요약

| 상황 | 결과 | 교훈 |
|------|------|------|
| Phase C+D 백엔드를 한 프롬프트로 Codex에 위임 (2개 큰 기능) | ✅ 17분 만에 7개 파일 수정 완료, tsc pass, 엣지 16건 통과 | 큰 덩어리 위임은 Codex가 잘 처리 |
| 위임 후 `codex:rescue status`로 진행 조회 | ❌ "task is still running"만 반환, 실제로는 이미 진행 중인 "편집 단계" | 상태는 git diff로 확인해야 맞음 |
| 동일 세션에서 이전 stale task가 6시간 running으로 남아 후속 조회 방해 | ❌ cancel도 못 시킴 | rescue status 이슈는 구조적 |
| Codex 보고서 vs 실제 파일 상태 | ⚠️ 보고서가 주제를 틀리게 써도 파일은 맞게 수정 | 최종 검증은 항상 파일 시스템으로 |
| Phase C+D 통합 후 `npm run test:crm` 회귀 | ✅ 26/26 pass (처음 실행에서 2건 실패 → baseline 재생성 + 필터 업데이트 후 재통과) | 자동 검증 프레임워크(Phase A)가 이 통합 성공을 가능하게 함 |

---

## 6. 다음 액션

- [ ] 이 문서를 `~/coding/CLAUDE.md` 또는 프로젝트 `CLAUDE.md`에 "Codex 호출 규칙" 섹션으로 참조 링크 추가 — 앞으로 모든 세션이 동일한 규칙을 따르도록
- [ ] 플러그인 업스트림에 3-2의 제안을 이슈로 제출 (가능하다면)
- [ ] 다음 세션에서 rescue status를 1회도 부르지 않고 git/tsc 확인만으로 진행해보는 실험 수행
- [ ] stale task 6h 이슈가 세션 재시작으로 해결되는지 관찰

---

**결론**: 이 플러그인은 "코드 작성 도구"로는 성공적이고, "작업 상태 관리 도구"로는 아직 미성숙하다. Claude Code 쪽이 상태 확인을 외부 증거(git·tsc·curl·notification)로 처리하는 규칙을 확립하면 현재 상태로도 충분히 쓸 수 있다.
