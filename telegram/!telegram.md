# Claude Code → Telegram 작업 완료 알림 세팅 정본

작성: 2026-05-07 01:05 KST · 작성자: Claude Code
상태: 운영 중. 본 agent 가 응답을 끝낼 때마다 자동으로 텔레그램 알림 1건 발송.
용도: Claude Code Stop hook 으로 텔레그램 메시지 받기. 재설치·다른 머신 이전·트러블슈팅 시 본 문서로 복원.

## 한 줄 결론

`~/.claude/settings.json` 의 `hooks.Stop` 이 매 응답 종료 시 `~/.claude/scripts/telegram-notify.sh` 를 호출하고, 스크립트가 `backend/.env` 의 `Telegram_token` / `Telegram_chat_id` 두 변수만 grep+eval 로 source 한 뒤 sendMessage 를 백그라운드로 발송한다.

## 결과 메시지 형식

```
✅ Claude Code 작업 완료
📁 <basename $PWD>
🕐 <HH:MM>
```

검증 시점 (2026-05-07 01:05 KST) 도착 3건:

| 시각 | 메시지 | 의미 |
|---|---|---|
| 01:02 | `✅ chat_id 등록 완료 — Claude Code Stop hook 설치 진행합니다` | chat_id 검증 1회성 |
| 01:04 | `✅ Claude Code 작업 완료 / 📁 backend / 🕐 01:04` | pipe-test (`echo '{}' \| script`) |
| 01:04 | `✅ Claude Code 작업 완료 / 📁 backend / 🕐 01:04` | 응답 종료 시 hook 자동 발화 |

## 구성요소

| # | 위치 | 역할 | git tracked |
|---|---|---|---|
| 1 | `@BotFather` 로 만든 봇 (`@Tj_coding_agent_bot`) | Telegram Bot API 인증 | N/A (Telegram 측) |
| 2 | `backend/.env` 270~273행 — `Telegram_token` / `Telegram_chat_id` 등 4 키 | 토큰·chat_id·봇 메타데이터 저장 | NO (`.gitignore` 20행 `backend/.env`) |
| 3 | `~/.claude/scripts/telegram-notify.sh` | hook → curl sendMessage wrapper. .env 의 두 변수만 source | NO (홈 디렉토리) |
| 4 | `~/.claude/settings.json` 의 `hooks.Stop` 블록 | Claude Code 가 응답 종료 시 wrapper 를 호출하게 만드는 등록 | NO (홈 디렉토리) |

토큰 평문은 `~/.claude/settings.json` 에 **0건**. 모두 `backend/.env` 안에서만 소비.

## 재현 절차 (다른 머신·재설치 시)

### Step 1 — 봇 생성 (TJ 직접, 30초)

Telegram `@BotFather` → `/start` → `/newbot` → display name + username 입력 → 토큰 발급. 토큰은 1Password 에 즉시 저장.

### Step 2 — chat_id 확보 (1분)

(a) 만든 봇 username 검색 → 1:1 대화창 → `/start` 한 번 누름 (필수)
(b) 어떤 텍스트든 한 번 더 입력
(c) 터미널:
```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | python3 -m json.tool | grep -A2 '"chat"'
```
응답의 `"id": 123456789` 가 chat_id.

대안: Telegram `@userinfobot` 검색 → `/start` → user id 즉시 표시 (1:1 chat_id 와 동일).

### Step 3 — `.env` 에 4 줄 추가

`/Users/vibetj/coding/seo/backend/.env` (gitignored) 아무 위치에 다음 4 줄. 본 환경은 269~273행에 둠:

```bash
# 텔레그램 코딩 알람
Telegram_token=<TOKEN>
Telegram_bot_name=coding agent alarm
Telegram_bot_username=<봇 username>
Telegram_chat_id=<chat_id 숫자>
```

(소문자 시작 변수명을 그대로 유지한 이유는 기존 .env 와의 충돌·rename 비용을 피하기 위함. 신규 머신에서는 `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` 대문자 컨벤션 으로 가도 무방 — 단 Step 4 의 grep 패턴도 함께 갱신할 것.)

### Step 4 — wrapper 스크립트 작성

```bash
mkdir -p ~/.claude/scripts
```

`~/.claude/scripts/telegram-notify.sh` (chmod +x):

```bash
#!/usr/bin/env bash
# Claude Code Stop hook → Telegram 알림
# backend/.env 에서 Telegram_token / Telegram_chat_id 두 변수만 추출 (다른 dirty 라인 무시)

set -a
eval "$(grep -E '^(Telegram_token|Telegram_chat_id)=' /Users/vibetj/coding/seo/backend/.env 2>/dev/null)"
set +a

# 변수 누락 시 silent exit — hook 가 작업 흐름을 끊지 않게
[ -z "${Telegram_token}" ] && exit 0
[ -z "${Telegram_chat_id}" ] && exit 0

PROJECT="$(basename "$PWD")"
TIME="$(date '+%H:%M')"
TEXT="✅ Claude Code 작업 완료
📁 ${PROJECT}
🕐 ${TIME}"

# 백그라운드 전송 (hook block 시간 ~0)
curl -s -X POST "https://api.telegram.org/bot${Telegram_token}/sendMessage" \
  --data-urlencode "chat_id=${Telegram_chat_id}" \
  --data-urlencode "text=${TEXT}" \
  >/dev/null 2>&1 &

exit 0
```

```bash
chmod +x ~/.claude/scripts/telegram-notify.sh
```

설계 포인트:

- `grep -E '^(Telegram_token|Telegram_chat_id)='` — `.env` 의 다른 dirty 라인(공백, 한글 주석, KEY=VALUE 가 아닌 라인) 무시
- `set -a; eval; set +a` — eval 결과를 자동 export
- 변수 누락 시 `exit 0` — hook 실패가 Claude Code 흐름을 끊지 않게 silent
- `--data-urlencode` — 다행 텍스트와 이모지 안전
- `curl ... &` — 백그라운드. hook 이 hang 되어 다음 응답을 늦추지 않게
- `>/dev/null 2>&1` — curl 출력이 stdout 으로 새서 hook JSON output 으로 오해되지 않게

### Step 5 — `~/.claude/settings.json` 에 hook 등록

기존 키는 보존하고 hooks 블록만 추가:

```json
{
  "...": "기존 키 그대로",
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/Users/vibetj/.claude/scripts/telegram-notify.sh"
          }
        ]
      }
    ]
  }
}
```

검증:

```bash
python3 -c "import json; json.load(open('/Users/vibetj/.claude/settings.json')); print('json_ok')"
jq -e '.hooks.Stop[] | select(.matcher == "") | .hooks[] | select(.type == "command") | .command' ~/.claude/settings.json
# → "/Users/vibetj/.claude/scripts/telegram-notify.sh" 출력
```

### Step 6 — pipe-test + live 검증

```bash
echo '{"session_id":"test","stop_hook_active":false}' | ~/.claude/scripts/telegram-notify.sh
# 텔레그램에 메시지 1건 도착하면 OK
```

이후 Claude Code 응답이 끝나면 자동 발화 1건 추가 도착해야 함. 안 도착하면 `/hooks` 슬래시 명령을 한 번 열거나 Claude Code 재시작 (settings watcher reload).

## 보안·운영 팁

| 항목 | 권장 |
|---|---|
| 토큰 노출 시 | `@BotFather` → `/revoke` → 새 토큰 발급. `backend/.env` 270행 갱신 |
| .env 보호 | `backend/.env` 는 `.gitignore` 20행에 등록되어 있음 — git push 노출 0 |
| settings.json 보호 | `~/.claude/settings.json` 은 dotfiles repo 분리 권장. 현재 `apiKey` 도 평문 저장 — 별도 결정 필요 |
| 봇 권한 축소 | `@BotFather` → `/setjoingroups Disable` (그룹 초대 금지), `/setprivacy Enable` (그룹 메시지 read 금지) |
| 메시지 길이 | Telegram 최대 4096자. 길면 잘림 |
| Rate limit | 분당 ~30건. Claude Code Stop 빈도로 안전. 다중 세션 동시 발화도 OK |

## 메시지 커스터마이즈

`~/.claude/scripts/telegram-notify.sh` 의 `TEXT=` 부분만 수정. settings.json 안 건드림.

예시 — git branch 추가:

```bash
BRANCH="$(git -C "$PWD" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '-')"
TEXT="✅ Claude Code 작업 완료
📁 ${PROJECT} (${BRANCH})
🕐 ${TIME}"
```

예시 — 세션 ID 포함 (stdin JSON 활용):

```bash
INPUT="$(cat)"
SESSION="$(echo "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id","-")[:8])' 2>/dev/null || echo '-')"
TEXT="✅ Claude Code 작업 완료
📁 ${PROJECT}
🆔 ${SESSION}
🕐 ${TIME}"
```

## 다른 hook event 추가

같은 wrapper 를 재활용해 다른 시점에도 알림을 받을 수 있음. `~/.claude/settings.json` 의 `hooks` 블록에 추가:

| event | 의미 | matcher |
|---|---|---|
| `Stop` | 응답 종료 | `""` (전체) |
| `Notification` | 권한 요청·idle 알림 | `""` |
| `SubagentStop` | 서브에이전트 종료 | `""` |
| `SessionStart` | 세션 시작 | `""` |
| `PreCompact` | 자동 압축 직전 | `"manual"` 또는 `"auto"` |

이벤트 종류만 다르고 wrapper 는 동일하게 호출. 단 발화 빈도가 늘면 텔레그램 spam 가능 — Stop 만 켜두는 것을 기본 권장.

## 끄기 / 임시 비활성화

| 방법 | 명령 |
|---|---|
| 슬래시 명령 UI | `/hooks` → Stop 선택 → disable |
| 영구 제거 | `~/.claude/settings.json` 의 `"hooks"` 블록 삭제 후 저장 |
| 임시 차단 | `~/.claude/scripts/telegram-notify.sh` 첫 줄 다음에 `exit 0` 추가 (스크립트만 죽임 — settings.json 손 안 댐) |
| 모든 hook 일괄 차단 | `~/.claude/settings.json` 에 `"disableAllHooks": true` 추가 |

## 트러블슈팅

| 증상 | 원인 후보 | 조치 |
|---|---|---|
| 메시지 0건 | settings watcher 가 신규 hooks 필드를 reload 안 함 | `/hooks` 한 번 열기, 또는 Claude Code 재시작 |
| `Forbidden: bot can't initiate conversation with a user` | 봇과 `/start` 한 번도 안 누름 | 봇 대화창에서 `/start` 누르고 재시도 |
| `chat not found` | chat_id 오타 또는 서로 다른 봇과 대화함 | `getUpdates` 로 chat_id 다시 추출 |
| `error_code: 401` | 토큰 오타·revoked·만료 | `.env` 270행 토큰 재확인. 필요시 `/revoke` 후 갱신 |
| pipe-test OK 인데 hook 안 발화 | `~/.claude/settings.json` JSON 문법 오류 → 전체 settings 무효 | `python3 -c "import json; json.load(open('~/.claude/settings.json'))"` 로 검증 |
| 메시지 도착 지연 | 백그라운드 curl 의 네트워크 지연 | 정상. hook 자체는 즉시 종료 (`&` ) |
| 메시지에 `📁 backend` 가 항상 표시 | 직전 Bash command 가 `cd backend` 했고 그 cwd 가 유지됨 | 다른 디렉토리에서 작업하면 자동 변경. wrapper 의 `basename "$PWD"` 가 그대로 반영 |

디버깅용 로그 추가:

```bash
# wrapper 첫 부분에 추가
exec > >(tee -a /tmp/telegram-notify.log) 2>&1
echo "$(date) hook fired in $PWD"
```

`/tmp/telegram-notify.log` 에 매 발화 기록됨.

## stdin JSON payload

Claude Code 가 hook 에 보내는 JSON 입력 (참고용):

```json
{
  "session_id": "abc123...",
  "stop_hook_active": false,
  "tool_name": "...",        // PreToolUse/PostToolUse 만
  "tool_input": { ... }
}
```

현 wrapper 는 stdin 을 안 읽음. `cat` 으로 받아 `jq -r '.session_id'` 로 활용 가능.

## 변경 기록

| 시각 | 변경 |
|---|---|
| 2026-05-07 01:05 KST | 최초 작성. .env 4줄, wrapper 27줄, settings.json hooks.Stop 1블록 등록. 검증 메시지 3건 도착 확인 (chat_id verify / pipe-test / 응답 종료 자동 발화) |

## 관련 파일 (절대 경로)

```
/Users/vibetj/coding/seo/backend/.env             # 269~273행: Telegram_* 4줄 (gitignored)
/Users/vibetj/.claude/scripts/telegram-notify.sh  # wrapper, chmod +x, 27줄
/Users/vibetj/.claude/settings.json               # hooks.Stop 블록 등록
/Users/vibetj/coding/seo/telegram/!telegram.md    # 본 문서 (정본)
```
