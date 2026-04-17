**안드레 카파시(Andrej Karpathy)의 Autoresearch(또는 AutoResearch) 개념 정리**

안드레 카파시(Andrej Karpathy, OpenAI 전 연구원, Tesla Autopilot AI 리더)가 2026년 3월에 공개한 **autoresearch**는 **AI 에이전트가 스스로 ML 연구를 수행하는 자율 연구 루프(Autonomous Research Loop)**입니다.
간단히 말해 “인간 연구원이 밤에 잠자는 동안 AI가 수십~수백 번의 실험을 반복하며 모델을 자동으로 개선하는” 시스템이에요.
이 프로젝트는 GitHub에서 공개된 오픈소스 repo(https://github.com/karpathy/autoresearch)로, 단일 GPU에서 작은 LLM(nanochat, GPT-2 규모) 훈련 실험을 자율적으로 돌리는 데 초점을 맞췄습니다.

### 1. 배경과 핵심 아이디어
- 기존 ML 연구는 **“가설 → 코드 수정 → 훈련 → 평가 → 판단”** 루프를 인간이 직접 반복해야 했습니다. 이 과정이 병목이 된다고 카파시는 지적했어요.
- Autoresearch는 이 루프 전체를 **AI coding agent(Claude, Cursor 등)**에게 넘겨줍니다.
- 인간은 **연구 방향(program.md)**만 작성하고, AI는 밤새 80~100+ 번의 실험을 autonomously 실행 → **개선된 것만 git commit**으로 남기고, 실패는 즉시 revert.
- 결과: 아침에 일어나면 **git history + results.tsv**에 검증된 개선 이력과 로그가 쌓여 있음. (카파시 본인 실험에서는 이미 최적화된 코드에서 val_bpb 11% 개선, 19% validation gain 달성)

카파시는 이를 “**Karpathy Loop**” 또는 “ratchet loop(톱니바퀴 루프)”라고 부르며, “AI가 연구원을 대체하는 초기 singularity 재미”라고 농담처럼 표현했습니다.

### 2. 구체적으로 어떻게 작동하나? (Ratchet Loop 상세 과정)
repo는 **극도로 미니멀**하게 설계됐습니다. AI가 자유롭게 코드를 바꾸되, **평가는 항상 공정하게** 유지하는 구조예요.

#### repo 핵심 파일 3개 (이게 전부입니다)
| 파일          | 역할                                      | 누가 수정 가능한가?          | 설명 |
|---------------|-------------------------------------------|------------------------------|------|
| **train.py** (~630줄) | 모델·옵티마이저·하이퍼파라미터·훈련 루프 전체 | **AI 에이전트만**           | 유일하게 AI가 편집 가능한 파일. 아키텍처, learning rate, optimizer(Muon+AdamW) 등 무엇이든 바꿀 수 있음 |
| **prepare.py**       | 데이터 준비 + **평가 하네스** (val_bpb 계산) | **절대 수정 불가** (human/AI 모두) | BPE 토크나이저, dataloader, evaluation 코드. AI가 cheating(쉬운 테스트 만들기) 못 하게 고정 |
| **program.md**       | AI에게 주는 **연구 지시서**              | **인간만** 편집             | 연구 방향, 규칙, baseline metric, “NEVER STOP”, “simpler is better” 등 지시사항 |

#### 1회 루프 (약 5분 + overhead, 시간당 ~12회)
1. AI가 **program.md**와 현재 **train.py**, **results.tsv**(과거 실험 로그) 읽음.
2. 가설 세움 (e.g. “QK-norm scaler 추가하면 val_bpb 낮아질 것”).
3. **train.py**만 수정.
4. git commit (feature branch).
5. **정확히 5분** 동안 훈련 실행 (wall-clock time, startup 제외).
6. **prepare.py**로 val_bpb(Validation Bits Per Byte, 낮을수록 좋음) 평가.
   - 개선 → commit 유지 (새 baseline)
   - 실패/동등 → `git reset HEAD~1`로 즉시 revert
7. **results.tsv**에 로그 기록 (commit hash, val_bpb, 메모리 사용량, 설명 등).
8. 반복 (AI는 스스로 “다음 실험” 결정).

이 “ratchet(톱니바퀴)” 구조 덕분에 **절대 뒤로 가지 않고** 개선만 누적됩니다.

### 3. 실제로 어떻게 시작하나? (Step-by-step)
1. **Clone**
   ```bash
   git clone https://github.com/karpathy/autoresearch.git
   cd autoresearch
   ```
2. **Dependencies 설치** (uv 추천)
   ```bash
   uv sync
   ```
3. **데이터 준비** (한 번만, ~2분)
   ```bash
   uv run prepare.py
   ```
4. **program.md 편집** → 연구 방향 작성 (기본 템플릿 있음. “NEVER STOP”, 실패 처리 규칙 등 명시).
5. **AI 코딩 에이전트 실행** (Claude Code, Cursor 등)
   - repo 전체를 열고 에이전트에게 이렇게 지시:
     > “Read program.md and let’s kick off a new experiment! Do the setup first and then start the autonomous loop. NEVER STOP.”
6. **자동 실행** → AI가 스스로 루프 돌림. 당신은 잠자러 가세요.
7. **아침 확인**
   - `git log` → 개선 commit 이력
   - `results.tsv` → 모든 실험 로그
   - `analysis.ipynb` → 시각화

**하드웨어**: NVIDIA GPU (H100 권장, 20GB+ VRAM). Mac/AMD/Windows는 커뮤니티 fork 존재.

### 4. 실제 효과와 사례
- 카파시 본인: depth 12 모델에서 650+ 실험 → depth 24로 transfer 성공, leaderboard 업데이트.
- Shopify CEO: Liquid templating 코드에 적용 → 53% rendering speedup.
- 수많은 사용자: prompt optimization, cold email, code optimization 등에 일반화해 사용 중.

### 5. 한계
- 5분 고정 예산 → local optima에 갇힐 수 있음 (큰 변화보다는 incremental 개선 위주).
- single GPU만 공식 지원.
- AI 에이전트의 “skill issue” (Claude 등 모델 성능에 따라 결과 차이).

### 6. 관련 링크 (필수)
- **공식 GitHub**: https://github.com/karpathy/autoresearch (README에 setup·loop·limitations 모두 상세)
- **DataCamp 상세 가이드**: https://www.datacamp.com/tutorial/guide-to-autoresearch (step-by-step + FAQ)
- **PM’s Guide (일반화 설명)**: https://www.news.aakashg.com/p/autoresearch-guide-for-pms (ML 외 적용법)
- **한국어 자료**:
  - PyTorch KR: https://discuss.pytorch.kr/t/auto-research-ai-vibe-training-feat-andrej-karpathy/9190
  - 네이버 블로그: https://blog.naver.com/simula/224217508290

**추가로 궁금한 부분** (e.g. program.md 예시 전체, TinyStories로 Mac에서 돌리는 법, 다른 도메인 적용 예시)이 있으면 말씀해주세요. 실제로 clone해서 돌려보는 걸 가장 추천합니다 — 1시간이면 셋업 끝나고 AI가 알아서 연구 시작해요! 🚀