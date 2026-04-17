# 맥북 휴대 vs 집 고정 원격 개발 비교

최종 업데이트: 2026-04-14 KST

## 최우선 사용 원칙: Claude/Codex는 tmux 안에서 실행

앞으로 이 프로젝트의 Claude Code/Codex 세션은 기본적으로 `tmux` 안에서 실행한다.

이유:

- 맥북 에어 SSH 접속이 끊겨도 맥북 프로 안의 작업 세션은 살아 있어야 한다.
- 일반 터미널에서 Claude/Codex를 실행하면 터미널 창 종료, 네트워크 끊김, SSH 세션 종료 때 작업이 같이 죽을 수 있다.
- `tmux` 안에서 실행하면 맥북 프로, 맥북 에어, VS Code Remote SSH 어디서든 같은 세션에 다시 붙을 수 있다.

기본 개념:

```text
맥북 프로 = 실제 작업이 돌아가는 컴퓨터
tmux = 맥북 프로 안에 계속 살아 있는 터미널 방
맥북 에어 = 그 방에 원격으로 들어가는 화면/키보드
Claude Code/Codex = tmux 방 안에서 실행하는 작업 프로세스
```

맥북 프로에서 시작할 때:

```bash
tmux new -A -s seo
cd /Users/vibetj/coding/seo
claude
```

Codex를 쓸 때:

```bash
tmux new -A -s seo
cd /Users/vibetj/coding/seo
codex
```

맥북 에어에서 이어받을 때:

```bash
ssh vibetj@100.109.66.22
tmux new -A -s seo
```

VS Code 터미널에서 실행해도 된다. 단, 그 터미널이 맥북 프로 환경이어야 한다.

확인 명령:

```bash
hostname
pwd
```

맥북 프로 환경이면 프로젝트 경로가 아래처럼 보여야 한다.

```text
/Users/vibetj/coding/seo
```

맥북 에어 로컬 VS Code 터미널에서 `tmux`를 실행하면 그건 맥북 에어 안에서 도는 세션이라서, 집 맥북 프로 세션 유지와는 무관하다. 맥북 에어에서는 반드시 SSH 또는 VS Code Remote SSH로 맥북 프로에 붙은 뒤 `tmux new -A -s seo`를 실행한다.

세션에서 빠져나오기:

```text
Ctrl + b 누르고, 손 떼고, d
```

이것은 종료가 아니라 detach다. Claude/Codex는 맥북 프로 안에서 계속 살아 있다.

다시 붙기:

```bash
tmux new -A -s seo
```

tmux로 이어받을 수 있는 것:

- 터미널 화면
- Claude Code/Codex CLI 세션
- 서버 로그
- 실행 중인 명령

tmux로 이어받을 수 없는 것:

- 맥북 프로에 떠 있는 VS Code GUI 창
- Chrome 창
- Meta Pixel Helper 화면
- Claude 웹/앱 GUI

GUI까지 그대로 보고 싶으면 macOS 화면 공유 또는 Chrome Remote Desktop을 별도로 쓴다. 하지만 출퇴근 중 개발 지속성은 `SSH + tmux`가 기본이다.

## 먼저 세팅할 것

역할을 먼저 나눈다.

```text
이 PC = 집에 두는 실제 개발 실행 장비
새 맥북 에어 = 외부에서 접속하는 가벼운 클라이언트 장비
운영 backend / CAPI = GCP VM 유지
```

## Phase 요약표

완성도는 “문서 조사”가 아니라 실제로 출퇴근 중 원격 개발을 안정적으로 할 수 있는지 기준이다.

| Phase | 목표 | 내가 할 것 | TJ님이 할 것 | 현재 완성도 | 다음 판정 기준 |
| --- | --- | --- | --- | ---: | --- |
| Phase 0. 현황 정리 | 집 노트북 원격 개발 전략과 네트워크 조건 정리 | 현재 회선, 장비, iPad/MacBook Air 한계, Mac Studio 필요성 문서화 | 없음 | 100% | 문서 기준으로 선택지가 명확하면 완료 |
| [[#Phase 1 Detail|Phase 1. 이 PC 집 고정 준비]] | 이 PC를 항상 접속 가능한 개발 실행 장비로 세팅 | 전원/sleep, SSH, tmux, keepawake LaunchAgent 적용/진단 | 새 맥북 에어 공개키 등록, 외부 접속 테스트 | 75% | 외부에서 `ssh home-mac` 접속되고 `tmux` 세션이 유지되면 85% |
| Phase 2. 새 맥북 에어 클라이언트 준비 | 새 맥북 에어에서 이 PC로 접속해 개발 | SSH config, 포트포워딩 명령, VS Code/Cursor Remote SSH 절차 제공 | 맥북 에어에 Tailscale 설치, SSH 키 생성, 공개키를 이 PC에 등록 | 0% | 맥북 에어에서 `ssh home-mac` 접속 성공 |
| Phase 3. 7010/7020 원격 개발 검증 | 새 맥북 에어 브라우저로 이 PC의 로컬 개발 서버 확인 | `7010/7020` 포트포워딩, 서버 상태 점검 명령, 장애 시 진단 | 이 PC에서 프론트/백엔드 실행 후 맥북 에어에서 접속 테스트 | 10% | 맥북 에어에서 `http://localhost:7010` 접속 성공 |
| Phase 4. 출퇴근 실사용 테스트 | 이동 중에도 Claude Code/Codex 세션 유지 | 끊김 대응 루틴, tmux 재접속 방식, 최소 명령 세트 정리 | 5G/핫스팟/지하철 Wi-Fi에서 20분 이상 접속 테스트 | 0% | 이동 중 `tmux` 세션 재접속과 짧은 코드 수정 성공 |
| Phase 5. iPad 보조 사용 | iPad Air를 긴급 확인/짧은 명령용으로 쓸지 판단 | iPad 한계와 Blink/Termius류 사용 기준 정리 | 키보드/트랙패드 연결 후 SSH 접속 테스트 | 30% | iPad에서 문서 수정/로그 확인이 불편하지 않으면 보조 채택 |
| Phase 6. Mac Studio 256GB 구매 판단 | M4 Max 128GB 유지 vs Mac Studio 256GB 구매 결정 | 1주 실사용 후 병목 재평가 기준 정리 | 이 PC 집 고정 원격 개발을 1주 사용해 체감 기록 | 60% | 메모리/발열/세션 유지가 병목이면 Mac Studio 재검토 |
| Phase 7. 보안/백업 정리 | 원격 개발 중 시크릿/데이터 손실 리스크 축소 | 점검 명령, `.env` 보관 원칙, 백업 기준 정리 | FileVault, 화면 잠금, Time Machine 또는 Git 원격 백업 확인 | 25% | 분실/재부팅/네트워크 끊김에도 작업 복구 가능 |

우선순위:

```text
1순위: [[#Phase 1 Detail|Phase 1 이 PC 집 고정 준비]]
2순위: Phase 2 새 맥북 에어 SSH 접속
3순위: Phase 3 7010/7020 포트포워딩 검증
4순위: Phase 4 출퇴근 실사용 테스트
```

## Phase 1 Detail

### 목표

이 PC를 집에 고정해 두고, 외부에서는 새 맥북 에어 또는 iPad로 접속해서 Claude Code/Codex 작업을 이어갈 수 있게 만든다.

핵심은 이 PC가 “항상 켜져 있는 개발 실행 장비”가 되는 것이다. 새 맥북 에어는 개발 서버를 직접 실행하는 장비가 아니라, SSH/tmux/Remote SSH로 이 PC에 접속하는 클라이언트로 본다.

완료 조건:

```text
이 PC가 전원 연결 상태에서 잠들지 않는다.
Tailscale로 외부에서 이 PC를 찾을 수 있다.
SSH 키 기반 접속이 된다.
tmux 세션이 끊김 없이 유지된다.
7010/7020 로컬 서버를 새 맥북 에어에서 포트포워딩으로 볼 수 있다.
```

### 왜 필요한가

출퇴근 중 개발을 계속하려면 “작업이 돌아가는 컴퓨터”와 “들고 다니는 입력 장치”를 분리해야 한다. 이동 중 네트워크는 끊길 수 있으므로, 노트북 화면 공유나 일반 터미널 세션만 믿으면 작업이 중단될 수 있다.

`tmux`를 쓰면 새 맥북 에어의 네트워크가 끊겨도 이 PC 안의 세션은 계속 살아 있다. Tailscale을 쓰면 공유기 포트포워딩 없이 안전하게 집 PC에 접속할 수 있다. `caffeinate` 또는 Amphetamine을 쓰면 macOS sleep 때문에 SSH와 개발 서버가 죽는 일을 줄일 수 있다.

### 작업 순서

Phase 1은 내가 할 일과 TJ님이 할 일이 고정된 순서로 나뉘지 않는다. 실제 완성 기준은 “밖에서 끊김 없이 이 PC에 붙어서 작업할 수 있는가”이므로, 아래 순서대로 서로 필요한 작업을 교차해서 진행한다.

| 순서 | 담당 | 상태 | 무엇을 하는가 | 왜 필요한가 | 어떻게 확인하는가 |
| --- | --- | --- | --- | --- | --- |
| 1 | TJ님 | 완료 | 이 PC를 전원 어댑터에 계속 연결 | 배터리 상태에서는 macOS sleep 정책이 달라져 원격 접속이 끊길 수 있음 | `pmset -g batt`에서 `AC Power` 확인 |
| 2 | TJ님 | 완료 | 클램쉘 모드 동작 확인 | 집에 두고 외부 모니터/키보드/마우스로 운용할 수 있는지 확인 | 뚜껑을 닫아도 외부 화면/입력이 유지되는지 확인 |
| 3 | TJ님 | 완료 | macOS 원격 로그인 켜기 | SSH 접속을 받기 위한 필수 설정 | 시스템 설정 > 일반 > 공유 > 원격 로그인 ON |
| 4 | 나 | 완료 | AC 전원 sleep 설정 확인 | 시스템/디스크 sleep 때문에 SSH와 로컬 서버가 죽지 않는지 확인 | `pmset -g custom`에서 AC Power `sleep 0`, `disksleep 0` 확인 |
| 5 | 나 | 완료 | SSH 서버 리스닝 확인 | 원격 로그인 UI가 켜져 있어도 실제 22번 포트가 열려 있는지 확인 | `netstat -an`에서 `*.22 LISTEN` 확인 |
| 6 | 나 | 완료 | `tmux` 설치 | 외부 네트워크가 끊겨도 작업 세션을 유지하기 위함 | `tmux -V`에서 `tmux 3.6a` 확인 |
| 7 | 나 | 완료 | `seo` tmux 세션 생성 | 출퇴근 중 재접속할 기본 작업 세션 확보 | `tmux ls`에서 `seo` 세션 확인 |
| 8 | 나 | 완료 | keepawake LaunchAgent 생성 | 단순 `caffeinate` 백그라운드 실행이 오래 유지되지 않아 재로그인 후에도 sleep 방지를 유지하기 위함 | `launchctl print gui/501/com.biocom.keepawake`에서 `state = running` 확인 |
| 9 | TJ님 | 완료 | Tailscale 설치 승인/로그인 | 공유기 포트포워딩 없이 외부에서 집 PC를 안전하게 찾기 위함 | Tailscale 앱에서 이 PC가 온라인으로 보이면 완료 |
| 10 | 나 | 완료 | Tailscale 접속명/SSH config 정리 | 새 맥북 에어에서 `ssh home-mac`처럼 짧게 접속하기 위함 | 장비명 `tjmac-macbookpro`, Tailscale IP `100.109.66.22` 확인 |
| 11 | TJ님 | 대기 | 새 맥북 에어 SSH 공개키 생성/전달 | 비밀번호보다 안정적이고 안전한 SSH 접속을 위해 필요 | `~/.ssh/id_ed25519.pub` 생성 |
| 12 | 나 | 대기 | 새 맥북 에어 공개키를 이 PC에 등록 | 외부 장비가 이 PC에 SSH 키로 접속할 수 있게 함 | `ssh home-mac` 접속 성공 |
| 13 | 나/TJ님 | 대기 | 외부 5G/핫스팟 접속 테스트 | 집 Wi-Fi가 아닌 실제 출퇴근 환경에서 끊김을 봐야 함 | `ssh home-mac`, `tmux new -A -s seo` 성공 |
| 14 | 나/TJ님 | 대기 | 7010/7020 포트포워딩 테스트 | 새 맥북 에어 브라우저에서 이 PC 로컬 서버를 보기 위함 | `ssh -N -L 7010:localhost:7010 -L 7020:localhost:7020 home-mac` 후 브라우저 접속 |

### 2026-04-14 진행 결과

내가 진행한 것:

- `pmset -g batt`로 이 PC가 AC Power 연결 상태임을 확인했다.
- `pmset -g custom`으로 AC 전원에서 `sleep 0`, `disksleep 0`, `displaysleep 10`, `womp 1` 상태임을 확인했다.
- `netstat -an`으로 SSH 22번 포트가 `LISTEN` 상태임을 확인했다.
- `tmux`가 없어 Homebrew로 설치했다.
- `tmux new-session -d -s seo -c /Users/vibetj/coding/seo`로 기본 `seo` 세션을 만들었다.
- 단순 `nohup caffeinate -dims`는 비대화형 셸에서 오래 유지되지 않아 LaunchAgent 방식으로 전환했다.
- `/Users/vibetj/Library/LaunchAgents/com.biocom.keepawake.plist`를 생성했다.
- `launchctl bootstrap gui/501 ...`로 `com.biocom.keepawake`를 등록했고, `state = running`을 확인했다.
- `pmset -g assertions`에서 `PreventUserIdleSystemSleep`, `PreventUserIdleDisplaySleep`, `PreventSystemSleep`, `PreventDiskIdle`가 `asserting forever`로 잡힌 것을 확인했다.
- Tailscale CLI 상태를 확인했다.
- 이 PC의 Tailscale 장비명은 `tjmac-macbookpro`, Tailscale IPv4는 `100.109.66.22`다.

TJ님이 진행한 것:

- 이 PC가 전원 어댑터에 계속 연결되어 있음을 확인했다.
- 클램쉘 모드가 되는 것을 확인했다.
- macOS 시스템 설정에서 원격 로그인을 켰다.
- Tailscale 설치, 권한 승인, 로그인까지 완료했다.

남은 것:

- 새 맥북 에어에서 SSH 키를 생성하고 공개키를 이 PC에 등록해야 한다.
- 외부 네트워크에서 `ssh home-mac` 접속을 테스트해야 한다.

새 맥북 에어용 SSH config 초안:

```sshconfig
Host home-mac
  HostName 100.109.66.22
  User vibetj
  ServerAliveInterval 30
  ServerAliveCountMax 6
  TCPKeepAlive yes
  Compression yes
```

새 맥북 에어에서 할 다음 명령:

```bash
ssh-keygen -t ed25519 -C "macbook-air"
cat ~/.ssh/id_ed25519.pub
```

위 공개키 내용을 이 PC의 `~/.ssh/authorized_keys`에 추가하면 다음 단계로 넘어간다.

### Phase 1 완성도 기준

현재 완성도는 75%다.

근거:

```text
완료: 집 회선 속도/품질 측정
완료: 이 PC 하드웨어와 메모리 여유 확인
완료: AC 전원 상태와 sleep 설정 1차 확인
완료: 장시간 유지용 caffeinate 기준 문서화
완료: keepawake LaunchAgent 등록 및 실행 확인
완료: SSH 22번 포트 LISTEN 확인
완료: tmux 설치 및 seo 세션 생성
완료: Tailscale 설치/로그인 및 이 PC 온라인 확인
완료: Tailscale 장비명 `tjmac-macbookpro`, IP `100.109.66.22` 확인
미완료: 새 맥북 에어 SSH 키 등록
미완료: 외부 네트워크에서 ssh home-mac 접속 검증
미완료: tmux 세션 장시간 유지 검증
미완료: 7010/7020 포트포워딩 검증
```

80% 기준:

```text
새 맥북 에어 또는 다른 외부 장비에서 Tailscale로 이 PC가 보인다.
ssh home-mac 접속이 된다.
tmux new -A -s seo 세션이 유지된다.
접속이 끊긴 뒤 다시 붙어도 작업 세션이 살아 있다.
```

100% 기준:

```text
출퇴근 구간에서 1주일 이상 실사용한다.
7010/7020 포트포워딩으로 브라우저 확인이 된다.
잠자기/재부팅/네트워크 끊김에도 작업 복구 루틴이 안정적이다.
시크릿과 백업 정책까지 정리되어 있다.
```

### 상세 세팅 항목

이 PC는 코드를 실제로 실행하고, Claude Code/Codex 세션을 오래 유지하는 장비로 둔다.

필수 세팅:

1. 전원과 잠자기 방지

- 전원 어댑터를 항상 연결한다.
- 시스템 설정 > 배터리에서 전원 연결 시 자동 잠자기를 최대한 막는다.
- 장시간 작업 세션은 `caffeinate -dimsu` 또는 Amphetamine 같은 앱으로 유지한다.
- 2026-04-13 10:29 KST 기준 확인 결과, 현재 이 PC는 AC Power 연결 상태이고 배터리는 100% 충전 완료 상태다.
- 같은 시점의 `pmset -g custom` 기준으로 AC 전원에서는 `sleep 0`, `disksleep 0`, `displaysleep 10`, `womp 1`로 잡혀 있다. 즉 전원 연결 상태에서는 시스템 자동 sleep과 디스크 sleep은 꺼져 있고, 디스플레이만 10분 후 꺼지는 설정이다.
- 현재 실행 중이던 `caffeinate`는 `caffeinate -i -t 300` 형태라서 5분짜리 임시 방지다. 장시간 원격 개발용으로는 부족하다.
- 장시간 원격 개발 세션을 안정적으로 유지하려면 아래처럼 실행한다.

```bash
caffeinate -dimsu
```

- 백그라운드로 계속 켜둘 때:

```bash
nohup caffeinate -dimsu >/tmp/caffeinate.log 2>&1 &
pgrep -fl caffeinate
```

- 끌 때:

```bash
pkill caffeinate
```

- 확인 명령:

```bash
pmset -g assertions
```

- 주의: 맥북을 뚜껑 닫은 상태로 집에 둘 경우, 전원 연결만으로 항상 깨어 있다고 가정하면 안 된다. 외부 모니터/키보드/마우스가 연결된 클램쉘 모드이거나 Amphetamine 같은 앱에서 lid close 관련 설정을 별도로 잡아야 안정적이다.
- 가장 안전한 집 고정 방식은 `전원 연결 + 뚜껑 열어둠 + caffeinate -dimsu 또는 Amphetamine 유지`다.

2. 원격 접속 경로

- Tailscale을 설치하고 로그인한다.
- 이 PC의 Tailscale 장비명을 `home-mac`처럼 고정해서 기억하기 쉽게 둔다.
- 공유기 포트포워딩은 하지 않는다. 외부 공개 SSH보다 Tailscale 사설망 접속이 안전하다.

3. SSH 서버

- 시스템 설정 > 일반 > 공유 > 원격 로그인을 켠다.
- 접속 허용 사용자는 실제 개발 계정으로 제한한다.
- 새 맥북 에어의 공개키를 이 PC의 `~/.ssh/authorized_keys`에 추가한다.
- 가능하면 비밀번호 로그인보다 SSH 키 로그인을 기본으로 쓴다.

4. 개발 세션 유지

- `tmux`를 설치하고 개발 세션을 유지한다.
- 기본 세션:

```bash
tmux new -A -s seo
cd /Users/vibetj/coding/seo
```

- 출퇴근 중 접속이 끊겨도 `tmux` 세션은 이 PC에 남아 있어야 한다.

5. 로컬 개발 서버 접근

- 이 PC에서 프론트/백엔드를 실행한다.
- SEO 기본 포트:

```text
프론트: 7010
백엔드: 7020
```

- 새 맥북 에어에서 브라우저로 직접 확인할 때는 SSH 포트포워딩을 쓰는 것이 가장 안전하다.

```bash
ssh -N -L 7010:localhost:7010 -L 7020:localhost:7020 home-mac
```

- 이후 새 맥북 에어 브라우저에서 `http://localhost:7010`, `http://localhost:7020`으로 확인한다.

6. 시크릿과 데이터

- `.env`, API 토큰, 운영 접근키는 기본적으로 이 PC에 둔다.
- 새 맥북 에어에는 꼭 필요한 SSH 키와 최소 개발 도구만 둔다.
- 운영 서버 배포용 시크릿은 GCP VM 또는 별도 안전한 저장소 기준으로 관리한다.

7. 백업과 보안

- FileVault를 켠다.
- 화면 잠금 시간을 짧게 둔다.
- Time Machine 또는 Git 원격 저장소로 주요 작업물을 백업한다.
- 장시간 원격 작업 전 확인:

```bash
git status --short
tailscale status
lsof -i :7010
lsof -i :7020
```

### 새 맥북 에어에서 세팅할 것

새 맥북 에어는 “개발을 실행하는 컴퓨터”가 아니라 “집 PC에 안정적으로 접속하는 터미널/에디터/브라우저”로 쓴다.

필수 세팅:

1. Tailscale

- 이 PC와 같은 Tailscale 계정으로 로그인한다.
- `home-mac` 장비가 보이는지 확인한다.
- 새 맥북 에어에도 Tailscale macOS 앱을 설치하는 것을 기본으로 한다.
- Tailscale 웹 콘솔은 장비 목록, 접속 상태, ACL 같은 “관리 화면”이다. 웹 콘솔만으로는 새 맥북 에어가 Tailnet 안으로 들어오지 않으므로, `ssh home-mac`, VS Code Remote SSH, `7010/7020` 포트포워딩을 안정적으로 쓰기 어렵다.
- 결론: 새 맥북 에어는 Tailscale 앱 설치가 필요하다. 웹 콘솔은 앱 설치 후 상태 확인용으로만 쓴다.

```bash
tailscale status
```

Tailscale 앱 vs 웹 콘솔:

| 방식 | 역할 | 원격 개발 적합도 | 판단 |
| --- | --- | --- | --- |
| Tailscale macOS 앱 | 새 맥북 에어를 Tailnet에 직접 연결 | 높음 | 필수 |
| Tailscale 웹 콘솔 | 장비 상태/권한/ACL 관리 | 낮음 | 관리용 |
| Chrome Remote Desktop 같은 웹 원격 화면 | 화면을 통째로 스트리밍 | 보조 | 이동 중 랙이 커서 1순위 아님 |

왜 앱이 필요한가:

- Tailscale 앱이 켜져야 새 맥북 에어에 `100.x.x.x` Tailnet 경로가 생긴다.
- 이 경로가 있어야 집 PC의 Tailscale IP `100.109.66.22`로 SSH 접속할 수 있다.
- VS Code Remote SSH, Cursor Remote SSH, `ssh -L 7010:localhost:7010` 같은 개발 흐름은 브라우저 관리 콘솔이 아니라 로컬 네트워크 터널이 필요하다.
- 웹 콘솔은 “집 PC가 온라인인지 확인”하는 데는 좋지만, 실제 개발 접속을 대신하지 못한다.

설치 후 확인:

```bash
tailscale status
tailscale ping 100.109.66.22
ssh home-mac
```

권장 운용:

```text
새 맥북 에어: Tailscale 앱 ON + SSH/tmux/Remote SSH
웹 콘솔: 장비 온라인 여부, 이름, ACL, 로그인 상태 확인
원격 화면 공유: 브라우저/결제/Pixel Helper처럼 화면 확인이 필요한 경우만 보조 사용
```

2. SSH 키

- 새 맥북 에어에서 별도 SSH 키를 만든다.

```bash
ssh-keygen -t ed25519 -C "macbook-air"
```

- 생성된 공개키 `~/.ssh/id_ed25519.pub` 내용을 이 PC의 `~/.ssh/authorized_keys`에 추가한다.
- 개인키는 새 맥북 에어 밖으로 공유하지 않는다.

3. SSH 접속 설정

- 새 맥북 에어의 `~/.ssh/config`에 접속 별칭을 만든다.

```sshconfig
Host home-mac
  HostName <이 PC의 Tailscale IP 또는 hostname>
  User <이 PC의 macOS 사용자명>
  ServerAliveInterval 30
  ServerAliveCountMax 6
  TCPKeepAlive yes
  Compression yes
```

- 접속 테스트:

```bash
ssh home-mac
tmux new -A -s seo
cd /Users/vibetj/coding/seo
```

4. 개발 도구

- iTerm2 또는 기본 Terminal을 설치/설정한다.
- VS Code 또는 Cursor를 설치한다.
- Remote SSH 확장을 설치한다.
- 로컬에 전체 개발 환경을 복제하기보다, 우선 이 PC의 원격 세션을 여는 방식으로 시작한다.

5. 로컬 브라우저 확인

- 포트포워딩을 켜고 새 맥북 에어 브라우저에서 확인한다.

```bash
ssh -N -L 7010:localhost:7010 -L 7020:localhost:7020 home-mac
```

- 접속 URL:

```text
http://localhost:7010
http://localhost:7020
```

6. 출퇴근용 운영 습관

- 이동 중에는 Chrome Remote Desktop보다 `SSH + tmux`를 우선한다.
- 화면이 끊겨도 명령이 계속 돌아가야 하므로 긴 작업은 반드시 `tmux` 안에서 실행한다.
- 네트워크가 불안정한 지하철 구간에서는 코드 편집보다 로그 확인, 문서 정리, 짧은 커맨드 위주로 쓴다.
- 무거운 브라우저 DevTools, 결제 테스트, Pixel Helper 검증은 가능하면 안정적인 네트워크에서 한다.

첫날 검증 체크리스트:

```text
집 Wi-Fi에서 ssh home-mac 접속 성공
외부 5G 핫스팟에서 ssh home-mac 접속 성공
tmux 세션 재접속 성공
VS Code/Cursor Remote SSH 접속 성공
7010/7020 포트포워딩 접속 성공
출퇴근 구간에서 20분 이상 세션 유지 테스트
```

## 결론

현재 단계에서는 **운영 서버는 GCP VM에 두고, 개발 환경은 “주 노트북 휴대”와 “집 고정 원격 개발”을 병행 테스트하는 것이 가장 현실적이다.**

운영 서버 대체는 검토 대상이 아니다. 목표는 **출퇴근 왕복 1시간 40분 동안에도 맥북 에어 또는 아이패드로 집 노트북에 접속해서 Claude Code/Codex 개발을 계속하는 것**이다.

현재 측정한 회선 기준으로는 집 노트북을 원격 개발 워크스테이션으로 쓰기에 충분하다. 단, 출퇴근 중 실제 병목은 집 회선이 아니라 **이동 중 5G/LTE/지하철 Wi-Fi 품질**이다.

```text
추천:
운영 backend / CAPI / Cloudflare Tunnel = GCP VM 유지
주 개발 = 주 노트북 휴대 또는 집 고정 원격 개발 병행
출퇴근 개발 = 맥북 에어 + Tailscale + SSH/tmux + VS Code Remote SSH
아이패드 = 긴급 확인/짧은 명령/문서 수정용
```

## 현재 네트워크 측정 결과

측정 환경:

```text
측정 시각: 2026-04-13 07:53-07:55 KST
측정 위치: 현재 이 노트북이 연결된 네트워크
기본 라우트 인터페이스: en10
로컬 게이트웨이: 192.168.75.1
ISP: SK Broadband
```

속도 측정:

| 도구 | 다운로드 | 업로드 | 지연시간 | 비고 |
| --- | ---: | ---: | ---: | --- |
| `speedtest --json --secure` | 482.9 Mbps | 459.8 Mbps | 4.3 ms | MOACK Data Center, Yongin-si |
| `networkQuality -v` | 310.2 Mbps | 448.6 Mbps | idle 6.9 ms | Apple endpoint, responsiveness medium |

품질 측정:

| 대상 | 결과 | 해석 |
| --- | --- | --- |
| 공유기 `192.168.75.1` ping 20회 | loss 0%, avg 1.36 ms | 로컬 Wi-Fi/유선 구간 매우 안정적 |
| Cloudflare `1.1.1.1` ping 20회 | loss 0%, avg 5.42 ms | 외부망 지연 매우 양호 |
| `https://att.ainativeos.net/health` 10회 | min 0.216s / avg 0.250s / max 0.282s | 우리 VM endpoint 접근 안정적 |

판정:

```text
500메가 광랜급 회선으로 충분하다.
집 노트북을 원격 개발 워크스테이션으로 두는 데 업로드 450Mbps 수준은 매우 여유롭다.
Claude Code/Codex 터미널 작업은 수 Mbps도 충분하므로 회선 용량보다 지연/끊김이 더 중요하다.
현재 집 쪽 회선 기준으로는 SSH, tmux, VS Code Remote SSH, code-server 모두 사용 가능 수준이다.
```

주의:

```text
집 회선은 충분하다.
출퇴근 중 실제 품질은 맥북 에어/아이패드가 쓰는 5G/LTE/지하철 Wi-Fi가 결정한다.
터널 접속은 괜찮아도 원격 화면 공유는 이동 중 끊김과 지연이 체감될 수 있다.
```

## M4 Max 128GB 맥북 vs Mac Studio 256GB 검토

### 현재 장비 상태

현재 이 노트북에서 확인한 하드웨어:

```text
Chip: Apple M4 Max
CPU count: 16
Memory: 128GB
```

현재 메모리 상태:

```text
memory_pressure 기준 free percentage: 55%
현재 관찰 기준 RAM 병목은 아님
```

해석:

```text
지금 프로젝트의 주 병목은 RAM 128GB 부족이 아니다.
병목은 이동 중 개발 지속성, 원격 접속 안정성, 브라우저/결제/Pixel 테스트의 작업 방식이다.
```

### Mac Studio 256GB가 정확히 무엇인지

Apple 공식 사양 기준으로 Mac Studio는 M4 Max 모델과 M3 Ultra 모델로 나뉜다. M4 Max Mac Studio는 128GB까지, 256GB unified memory는 M3 Ultra 모델 옵션이다.

```text
Mac Studio M4 Max:
최대 128GB unified memory
410GB/s 또는 546GB/s memory bandwidth

Mac Studio M3 Ultra:
96GB 기본, 256GB 구성 가능
819GB/s memory bandwidth
10Gb Ethernet
더 많은 Thunderbolt 5 포트/디스플레이 지원
```

참고:

- Apple 공식 Mac Studio 사양: https://www.apple.com/mac-studio/specs/

즉 “Mac Studio 256GB”는 단순히 지금 맥북의 RAM만 2배로 늘리는 선택이 아니라, **고정형 M3 Ultra 워크스테이션으로 전환**하는 선택에 가깝다.

### 프로젝트 기준 체감 차이

| 작업 | M4 Max 128GB 맥북 | Mac Studio 256GB | 체감 |
| --- | --- | --- | --- |
| Claude Code/Codex | 충분 | 충분 | 거의 차이 없음. 모델 추론은 로컬 RAM보다 클라우드/네트워크 영향이 큼 |
| Next.js/Node/FastAPI 개발 | 충분 | 충분 | 대형 빌드가 아니면 차이 작음 |
| Chrome 탭 다수 + DevTools | 충분 | 더 여유 | 128GB에서도 이미 충분한 편 |
| Docker/VM 여러 개 | 충분 | 더 안정적 | VM을 많이 띄우면 256GB가 유리 |
| 로컬 LLM 대형 모델 | 일부 한계 | 훨씬 유리 | 70B급 이상/다중 모델이면 256GB 가치 있음 |
| 장시간 원격 워크스테이션 | 가능하지만 노트북 관리 필요 | 더 적합 | 발열/배터리/잠자기 면에서 Mac Studio 유리 |
| 이동 개발 | 직접 가능 | 불가 | Mac Studio는 맥북 에어/아이패드 원격 접속 전제 |
| 결제/Pixel 브라우저 테스트 | 직접 빠름 | 원격/별도 클라이언트 필요 | 현재 프로젝트에서는 맥북 직접 작업이 편함 |

### Mac Studio 256GB로 바꿀 때 장점

- 집에 항상 켜둘 원격 개발 워크스테이션으로는 맥북보다 적합하다.
- 배터리/덮개/발열/잠자기 관리 리스크가 줄어든다.
- 10Gb Ethernet으로 유선 고정 연결을 만들기 쉽다.
- 256GB RAM은 Docker, VM, 로컬 LLM, 대량 데이터 처리에 여유가 크다.
- 맥북 에어를 가벼운 클라이언트로 쓰고, 무거운 작업은 Mac Studio에서 돌리는 구조가 깔끔하다.

### Mac Studio 256GB로 바꿀 때 단점

- 현재 M4 Max 128GB가 이미 매우 강해서, 일반 개발 체감 성능 향상은 제한적이다.
- 256GB가 필요한 작업이 명확하지 않으면 비용 대비 효율이 낮다.
- Mac Studio는 들고 다닐 수 없으므로, 이동 중 작업은 원격 접속 품질에 의존한다.
- 브라우저 결제 테스트, Meta Pixel Helper, DevTools 관찰은 로컬 맥북에서 직접 하는 쪽이 여전히 편하다.
- M3 Ultra는 멀티코어/메모리 대역폭은 강하지만, 일반 개발의 단일 작업 체감은 M4 Max 맥북과 큰 차이가 안 날 수 있다.

### 256GB가 정말 필요한 경우

아래에 해당하면 Mac Studio 256GB 전환 가치가 있다.

```text
로컬 LLM을 크게 돌릴 계획이 있다.
Docker/VM을 여러 개 상시 띄운다.
BigQuery/CSV/로컬 DB 대용량 분석을 노트북에서 자주 한다.
브라우저 수십 개 + DevTools + 여러 프로젝트 서버 + 디자인/영상 툴을 동시에 켠다.
집에 항상 켜져 있는 고정 개발 워크스테이션이 필요하다.
맥북 에어를 메인 이동 단말로 쓰고, 무거운 작업은 전부 집 장비에 맡길 계획이다.
```

### 256GB가 아직 과한 경우

아래가 현재에 가깝다면 굳이 바꿀 필요가 낮다.

```text
주 작업이 Claude Code/Codex, 문서, Next.js, Express, 데이터 조회 중심이다.
운영 서버는 이미 GCP VM으로 분리했다.
현재 128GB 메모리 압박이 없다.
결제/Pixel/브라우저 관찰 작업을 직접 노트북에서 자주 한다.
출퇴근 중 원격 접속이 실제로 안정적인지 아직 검증하지 않았다.
```

### 비용 대비 판단

현재 확인 기준으로는 **Mac Studio 256GB를 바로 사는 것보다, 먼저 1주일 원격 개발 실험을 하는 것이 맞다.**

실험 순서:

```text
1. 현재 M4 Max 128GB 맥북을 집에 하루 고정
2. 맥북 에어로 Tailscale + SSH + tmux 접속
3. 출퇴근 중 Claude Code/Codex 작업 3회 이상 테스트
4. VS Code Remote SSH 또는 Cursor Remote SSH 체감 확인
5. 집 노트북의 잠자기/발열/재접속 문제 확인
6. 실제로 “고정 워크스테이션이 필요하다”는 결론이 나오면 Mac Studio 검토
```

구매 판단 기준:

```text
원격 접속은 만족스럽지만, 집에 맥북을 계속 고정해두기 불편하다:
Mac Studio 구매 검토 가치 있음

원격 접속 자체가 출퇴근 중 불안정하다:
Mac Studio를 사도 문제 해결 안 됨. 이동망 품질이 병목

현재 M4 Max 128GB에서도 메모리 압박이 없다:
256GB는 성능 목적보다 고정 워크스테이션 목적일 때만 정당화됨

로컬 LLM/VM/대용량 분석을 본격화한다:
Mac Studio 256GB 가치 상승
```

### 내 판단

현재 기준 추천:

```text
지금 바로 Mac Studio 256GB로 바꾸는 것은 보류.
먼저 M4 Max 128GB 맥북을 집 고정 원격 개발기로 1주일 테스트.
테스트가 성공하고 “항상 켜둘 고정 개발기”가 필요해지면 Mac Studio 256GB 검토.
```

이유:

- 현재 128GB RAM은 부족하지 않다.
- Claude Code/Codex 중심 개발은 Mac Studio 256GB의 RAM보다 접속 품질과 세션 유지가 더 중요하다.
- 운영 서버는 GCP VM이라 Mac Studio가 운영 안정성을 직접 올리는 구조가 아니다.
- Mac Studio의 진짜 가치는 “더 빠른 개발”보다 “항상 켜져 있는 고정 고성능 워크스테이션”이다.
- 따라서 구매 전 원격 개발 루틴이 실제로 맞는지 먼저 검증해야 한다.

## 비교 대상

### 방식 A. 현재처럼 주 노트북을 들고 다니기

지금 쓰는 노트북에 코드, 터미널, 로컬 DB, 개발 서버, Claude Code/Codex 환경을 그대로 두고 집과 회사 사이를 이동한다.

### 방식 B. 주 노트북을 집에 두고 서버처럼 쓰기

주 노트북을 집에 전원 연결 상태로 고정해두고, 회사에서는 맥북 에어 또는 아이패드 에어로 접속한다.

접속 방식 후보:

```text
맥북 에어 -> SSH / VS Code Remote SSH / Tailscale / Chrome Remote Desktop
아이패드 -> Blink Shell / Termius / code-server / VS Code Web / Chrome Remote Desktop
```

## 핵심 비교표

| 항목 | 주 노트북 휴대 | 집 고정 원격 개발 |
| --- | --- | --- |
| 개발 속도 | 가장 빠름 | 네트워크 품질에 따라 흔들림 |
| Claude Code/Codex 사용 | 바로 사용 | SSH/원격 터미널로 가능 |
| 출퇴근 중 개발 | 주 노트북을 펼칠 수 있으면 가능 | 맥북 에어/아이패드로 접속 가능 |
| iPad 개발 | 해당 없음 | 가능은 하나 보조용에 가까움 |
| 서버 안정성 | 노트북 잠자기/이동 영향 큼 | 집 전원/인터넷 영향 큼 |
| 운영 서버 대체 가능성 | 부적합 | 부적합 |
| 보안 | 분실 리스크 있음 | 외부 접속 보안 설정 필요 |
| 이동 편의 | 무거움/번거로움 | 편함 |
| 장애 대응 | 손에 있으니 즉시 대응 | 집 노트북이 죽으면 접근 불가 |
| 추천 용도 | 주 개발 | 원격 개발 워크스테이션 |

## 방식 A. 주 노트북 휴대

### 장점

- 로컬 파일, 터미널, 브라우저, 개발 서버를 직접 제어하므로 작업 속도가 가장 빠르다.
- 네트워크가 불안정해도 로컬 코딩과 문서 작업은 계속 가능하다.
- Chrome DevTools, Meta Pixel Helper, 아임웹 테스트처럼 브라우저 관찰이 필요한 작업이 쉽다.
- 로컬 DB, `.env`, SSH 키, Claude Code/Codex 세션을 그대로 유지할 수 있다.
- 문제 발생 시 바로 포트, 프로세스, 로그를 확인하기 쉽다.

### 단점

- 매일 들고 다녀야 한다.
- 분실/파손/침수 리스크가 있다.
- 집과 회사 이동 중에는 서버 역할을 할 수 없다.
- 노트북 배터리/잠자기/와이파이 전환 때문에 장시간 자동 작업에는 부적합하다.
- 모든 개발 컨텍스트가 한 장비에 몰릴 수 있다.

### 적합한 상황

```text
프론트/백엔드 개발을 빠르게 반복해야 할 때
브라우저 기반 테스트가 많을 때
아임웹/Meta Pixel/결제 테스트처럼 직접 화면을 보며 해야 할 때
외부 접속 설정에 시간을 쓰기 싫을 때
출퇴근 중에도 같은 장비에서 모든 것을 처리하고 싶을 때
```

## 방식 B. 집 고정 원격 개발

### 장점

- 집과 회사 사이에 무거운 노트북을 들고 다니지 않아도 된다.
- 회사 맥북 에어는 가벼운 접속 단말로 쓰고, 실제 개발 환경은 집 노트북에 고정할 수 있다.
- iPad도 긴급 접속, 로그 확인, 간단한 문서 수정에는 사용할 수 있다.
- `.env`, 로컬 DB, 캐시, node_modules 등 무거운 개발 환경을 한 곳에 유지할 수 있다.
- `tmux`, `pm2`, `ssh`를 쓰면 장시간 터미널 작업을 이어가기 좋다.

### 단점

- 집 인터넷이나 집 전원이 끊기면 접근할 수 없다.
- macOS 업데이트, 잠자기, 배터리, 와이파이 절전 때문에 “서버처럼” 안정적으로 운영하려면 세팅이 필요하다.
- 아이패드는 키보드 단축키, 멀티 윈도우, 브라우저 DevTools, 파일 업로드/다운로드가 불편하다.
- 원격 화면 제어 방식은 딜레이가 생기고, Claude Code/Codex 터미널 작업은 가능해도 브라우저 디버깅은 답답할 수 있다.
- 외부 접속을 열면 SSH 키, 방화벽, Tailscale, FileVault 등 보안 관리가 필요하다.

### 적합한 상황

```text
문서 작성, 코드 수정, 로그 확인이 주 작업일 때
집 노트북을 항상 켜둘 수 있을 때
회사에서는 맥북 에어로 접속만 하면 될 때
출퇴근 시간에도 Claude Code/Codex 작업을 이어가고 싶을 때
아이패드는 긴급 대응용으로만 쓸 때
운영 서버는 이미 GCP VM에 올려둔 상태일 때
```

## 중요한 구분: 개발 워크스테이션 vs 운영 서버

집에 둔 맥북은 “개발 서버” 또는 “원격 개발 PC”로 쓰는 것이 맞다. 하지만 **운영 서버로 쓰면 안 된다.**

운영 서버로 부적합한 이유:

- 집 인터넷은 고정 IP, uptime, 장애 대응이 약하다.
- 노트북은 잠자기, 재부팅, 배터리, macOS 업데이트 영향을 받는다.
- 장시간 백그라운드 작업은 GCP VM, Cloud Run, Render 같은 서버 환경이 더 안전하다.
- CAPI, Attribution sync, Cloudflare Tunnel 같은 운영성 작업은 이미 GCP VM으로 옮긴 방향이 맞다.

따라서 역할은 이렇게 나누는 것이 좋다.

```text
GCP VM:
CAPI auto-sync, Attribution status sync, Cloudflare Tunnel, backend 운영 endpoint

주 노트북:
개발, 테스트, 문서화, 로컬 분석, 임시 실험

맥북 에어:
가벼운 원격 접속 클라이언트

아이패드:
긴급 SSH, 문서 확인, 간단한 명령 실행
```

## 집 고정 원격 개발을 한다면 필요한 세팅

### 1. 네트워크

권장:

```text
Tailscale
```

이유:

- 공유기 포트포워딩 없이 SSH 접속 가능하다.
- 집 IP가 바뀌어도 접속 가능하다.
- 회사 맥북 에어와 아이패드에서도 같은 Tailnet으로 접근할 수 있다.
- 외부에 SSH 포트를 직접 열지 않아도 된다.

### SK 고정 IP 신청 여부

결론:

```text
현재 목적에서는 SK 고정 IP 신청 필요 없음.
Tailscale VPN이 이미 고정 IP가 하던 역할 대부분을 대체한다.
```

현재 확인된 상태:

```text
ISP: SK Broadband
집 PC Tailscale 장비명: tjmac-macbookpro
집 PC Tailscale IPv4: 100.109.66.22
접속 방식: Tailscale 사설망 + SSH + tmux
```

왜 고정 IP가 필요 없는가:

- SK 집 인터넷의 공인 IP가 바뀌어도 Tailscale 장비 주소 `100.109.66.22`는 Tailnet 안에서 계속 같은 방식으로 접근할 수 있다.
- 공유기 포트포워딩이 필요 없다.
- 외부 인터넷에 SSH 22번 포트를 직접 노출하지 않아도 된다.
- CGNAT, 유동 IP, 공유기 재부팅 같은 문제를 Tailscale이 우회해 준다.
- 새 맥북 에어와 iPad도 같은 Tailscale 계정에 로그인하면 집 PC를 사설망 장비처럼 볼 수 있다.

고정 IP가 필요한 경우는 별도다:

- 외부 고객이나 외부 서버가 우리 집 PC로 직접 접속해야 하는 경우
- DNS A 레코드를 집 공인 IP에 직접 연결해야 하는 경우
- Tailscale을 쓸 수 없는 장비나 외부 협력사가 접속해야 하는 경우
- 공유기 포트포워딩으로 직접 공개 서비스를 열어야 하는 경우

현재 목적은 “내 장비에서 내 집 PC로 원격 개발 접속”이므로 위 조건에 해당하지 않는다.

운영 서버 관점에서도 고정 IP는 필요 없다:

- CAPI, backend, Cloudflare Tunnel 같은 운영성 workload는 GCP VM에 둔다.
- 집 PC는 운영 서버가 아니라 개발 워크스테이션이다.
- 따라서 SK 고정 IP를 사서 집 PC를 운영 endpoint처럼 만들 필요가 없다.

현재 추천:

```text
SK 고정 IP 신청: 보류
공유기 포트포워딩: 하지 않음
Tailscale 네트워크 확장 프로그램: ON 유지
SSH 접속: Tailscale IP 또는 Tailscale hostname 기준
```

대안:

```text
Chrome Remote Desktop
Cloudflare Tunnel
ZeroTier
공유기 포트포워딩 + SSH
```

포트포워딩은 가능하면 피하는 편이 낫다. 보안 관리 부담이 커진다.

출퇴근 중 개발까지 고려하면 우선순위는 아래가 맞다.

```text
1순위: Tailscale + SSH + tmux
2순위: VS Code Remote SSH 또는 Cursor 원격 SSH
3순위: code-server
4순위: Chrome Remote Desktop
```

이유:

- Claude Code/Codex는 터미널 기반이므로 SSH/tmux가 가장 안정적이다.
- SSH는 이동 중 네트워크가 잠깐 끊겨도 tmux 세션을 유지할 수 있다.
- 원격 데스크톱은 화면 스트리밍이라 출퇴근 중 이동망에서는 더 끊기기 쉽다.
- 브라우저 DevTools가 필요한 작업은 집/회사 고정 회선에서 하는 것이 낫다.

### 1-1. 외부 접속 체감과 랙 최소화

결론부터 말하면, **Claude Code/Codex 중심 개발은 외부 접속이어도 크게 불편하지 않게 만들 수 있다.** 단, 원격 화면 공유 방식으로 개발하면 랙이 바로 체감된다. 그래서 접속 방식을 분리해야 한다.

체감 랙이 적은 순서:

```text
1. SSH + tmux + Claude Code/Codex
2. VS Code Remote SSH / Cursor Remote SSH
3. code-server
4. Chrome Remote Desktop / 화면 공유
```

이유:

- SSH/tmux는 텍스트만 오가므로 데이터 사용량이 작고 지연에 강하다.
- Claude Code/Codex는 대부분 터미널 입출력이라 5G/LTE에서도 비교적 잘 버틴다.
- VS Code Remote SSH는 파일 탐색/검색/확장 기능 때문에 SSH보다 무겁지만, 실제 코드는 집 노트북에서 실행되므로 로컬 클론을 들고 다니는 것보다 관리가 쉽다.
- 원격 데스크톱은 화면 전체를 계속 전송하므로 이동 중 네트워크에서는 가장 먼저 답답해진다.

권장 운영 방식:

```text
출퇴근 중:
SSH + tmux에서 Claude Code/Codex 실행
문서/코드 수정은 터미널 에디터 또는 VS Code Remote SSH로 최소화

회사 도착 후:
맥북 에어에서 VS Code Remote SSH/Cursor Remote SSH 사용
필요하면 브라우저는 회사 맥북에서 직접 열고, 서버/코드는 집 노트북에 둠

집/회사 고정 회선:
브라우저 DevTools, Meta Pixel Helper, 결제 테스트, 원격 화면 공유 사용
```

랙을 줄이는 설정:

```text
Tailscale 사용
SSH KeepAlive 설정
tmux 기본 사용
원격 데스크톱 대신 Remote SSH 우선
대용량 npm install/build는 집 노트북에서 실행
파일 동기화 앱 중복 사용 금지
화면 공유가 필요하면 해상도 낮추기
이동 중에는 핫스팟보다 안정적인 5G/LTE 우선
```

SSH 설정 예시:

```sshconfig
Host home-mac
  HostName <tailscale-ip-or-hostname>
  User <mac-user>
  ServerAliveInterval 30
  ServerAliveCountMax 6
  TCPKeepAlive yes
  Compression yes
```

`tmux` 사용 원칙:

```text
ssh home-mac
tmux new -A -s seo
cd /Users/vibetj/coding/seo
codex 또는 claude 실행
```

이렇게 하면 지하철 구간에서 접속이 끊겨도 Claude Code/Codex 세션 자체는 집 노트북에서 계속 살아 있다. 다시 접속해서 `tmux attach -t seo`만 하면 이어서 볼 수 있다.

불편할 수 있는 지점:

- 이동 중 네트워크가 끊기면 화면이 멈추거나 SSH가 재접속된다.
- VS Code Remote SSH는 지하철 음영 구간에서 재연결 시간이 생길 수 있다.
- 브라우저 DevTools, 결제 테스트, Pixel Helper 관찰은 이동 중에는 비효율적이다.
- iPad는 SSH는 가능하지만 장시간 프롬프트 작성과 코드 리뷰는 맥북 에어보다 불편하다.

판정:

```text
출퇴근 중 Claude Code/Codex 개발:
가능. SSH/tmux 기준이면 체감 랙은 관리 가능.

출퇴근 중 VS Code Remote SSH 개발:
가능. 다만 이동망 품질에 따라 재연결/지연 체감 가능.

출퇴근 중 원격 화면 공유 개발:
비추천. 랙과 끊김 체감이 커질 가능성이 높음.

출퇴근 중 브라우저 결제/Pixel 디버깅:
비추천. 집/회사 고정 회선에서 하는 편이 낫다.
```

### 2. macOS 전원/잠자기

집 노트북은 아래 설정이 필요하다.

```text
전원 어댑터 연결 유지
디스플레이 꺼져도 컴퓨터 잠자기 방지
네트워크 접근 시 깨우기 활성화
자동 업데이트 시간 관리
필요하면 Amphetamine 또는 caffeinate 사용
```

주의:

- 맥북을 완전히 닫은 채 오래 쓰려면 발열과 배터리 관리가 필요하다.
- 배터리 부풀음 리스크 때문에 장기 고정 서버는 맥미니가 더 적합하다.

### 3. 접속 도구

맥북 에어에서 추천:

```text
VS Code Remote SSH
Cursor Remote SSH 가능 여부 확인
터미널 ssh + tmux
Chrome Remote Desktop
```

아이패드에서 추천:

```text
Blink Shell
Termius
code-server
GitHub Codespaces 또는 VS Code Web
Chrome Remote Desktop
```

아이패드는 “주 개발 장비”로 보기 어렵다. 긴급 수정, 서버 상태 확인, 문서 정리 정도가 현실적이다.

### 4. 보안

필수:

```text
FileVault ON
강한 로그인 비밀번호
SSH password login OFF
SSH key only
Tailscale ACL 또는 접속 기기 제한
1Password/비밀번호 관리자 사용
분실 대비 Find My Mac ON
```

금지:

```text
공유기에서 22번 포트를 그대로 외부 오픈
.env 파일을 여러 장비에 무분별하게 복사
아이패드에 운영 시크릿을 평문 저장
```

### 5. 개발 세션 유지

권장:

```text
tmux
pm2
git worktree 또는 명확한 branch 관리
정기 git push
Time Machine 또는 외장 백업
```

원격 개발에서는 접속이 끊겨도 작업이 살아 있어야 한다. `tmux`를 쓰면 SSH가 끊겨도 터미널 세션을 유지할 수 있다.

## iPad Air로 개발할 때의 현실적인 한계

iPad는 가능하지만 주 개발기보다는 보조 장비다.

가능한 것:

- SSH 접속
- 서버 로그 확인
- 간단한 파일 수정
- 문서 작성
- 간단한 git commit/push
- 웹 대시보드 확인

불편한 것:

- Chrome DevTools 수준의 브라우저 디버깅
- 로컬 파일 여러 개를 빠르게 넘나드는 작업
- 긴 코드 리뷰
- 복잡한 conflict 해결
- 결제/픽셀 테스트처럼 여러 브라우저 창과 Network 탭이 필요한 작업
- Claude Code/Codex를 장시간 안정적으로 쓰는 작업

### 맥북 에어 대비 왜 불편한가

핵심은 성능만의 문제가 아니다. iPad Air에 키보드와 트랙패드를 붙여도, iPadOS와 앱 구조 때문에 개발 워크플로우가 맥북보다 끊긴다.

| 항목 | 맥북 에어 | iPad Air | 왜 불편한가 |
| --- | --- | --- | --- |
| 터미널 | macOS 기본 터미널, iTerm2, SSH, tmux, 로컬 명령 모두 자연스러움 | Blink Shell/Termius 같은 앱 필요 | SSH는 가능하지만 로컬 개발 명령, 파일 시스템, 여러 세션 관리가 맥보다 제한적 |
| Claude Code/Codex | 터미널에서 장시간 안정적으로 실행 | SSH 앱 안에서 실행 가능 | 앱 전환, 백그라운드 유지, 연결 끊김, 복사/붙여넣기 흐름이 맥보다 불안정 |
| 파일 작업 | Finder, VS Code/Cursor, 터미널이 같은 파일 시스템을 공유 | 앱별 샌드박스와 Files 앱 중심 | 파일 이동, 경로 복사, 대량 파일 검색, hidden file 취급이 불편 |
| 에디터 | VS Code/Cursor/JetBrains 등 데스크톱 앱 사용 | VS Code Web, code-server, 텍스트 앱 위주 | 확장, 단축키, 멀티파일 탐색, 터미널 통합이 데스크톱보다 약함 |
| 브라우저 DevTools | Chrome DevTools 전체 기능 사용 | Safari Web Inspector는 Mac 연결이 필요하거나 제한적 | Meta Pixel Helper, Network 탭, 결제 완료 페이지 디버깅이 실전에서 불편 |
| 멀티태스킹 | 여러 창/모니터/스페이스 자유롭게 사용 | Stage Manager가 있어도 앱 전환 중심 | 터미널, 브라우저, 문서, 로그, Slack/메모를 동시에 보는 흐름이 답답 |
| 키보드 단축키 | 개발 도구 단축키가 일관적 | 앱마다 단축키가 다르고 일부 충돌 | Vim/tmux/브라우저/에디터 단축키를 오래 쓰면 피로도가 높음 |
| 마우스/트랙패드 | 정밀 포인터, 우클릭, 드래그, 멀티윈도우 자연스러움 | 포인터는 개선됐지만 터치 중심 UX | 세밀한 코드 선택, DevTools 패널 조작, 여러 창 드래그가 맥보다 느림 |
| 백그라운드 작업 | 빌드/테스트/서버를 계속 실행 가능 | 앱 백그라운드 제한 존재 | 접속 앱이 백그라운드로 밀리면 세션 유지가 불안정할 수 있음 |
| 외부 모니터 | 완전한 데스크톱 확장 | 모델/앱/Stage Manager 의존 | 화면은 넓어져도 macOS식 개발 환경이 되는 것은 아님 |

### 키보드가 붙어 있으면 해결되는가

일부는 해결된다.

해결되는 것:

- 긴 프롬프트 입력
- SSH 터미널 명령 입력
- 문서 작성
- 간단한 코드 수정
- 단축키 기반 앱 전환 일부

그래도 남는 문제:

- iPadOS의 앱 샌드박스와 파일 시스템 제약
- 백그라운드 세션 유지 불안정성
- VS Code/Cursor 데스크톱 앱 부재
- Chrome DevTools/Meta Pixel Helper 같은 브라우저 개발 도구 제약
- 여러 창을 동시에 띄워 비교하는 개발 흐름의 불편함
- 마우스 포인터가 있어도 macOS 수준의 정밀한 창/패널 조작은 아님

결론:

```text
키보드가 있으면 "긴급 대응 단말"에서 "가벼운 원격 터미널 단말"까지는 올라간다.
하지만 "맥북 에어 대체 개발기"까지 올라가지는 않는다.
```

### 마우스나 트랙패드를 쓰면 해결되는가

마우스/트랙패드는 분명히 도움이 된다. 특히 SSH 앱, 문서, 브라우저 대시보드 조작은 훨씬 낫다.

하지만 개발에서 중요한 병목은 포인터가 아니라 아래다.

```text
데스크톱급 에디터 부재
브라우저 DevTools 제약
파일 시스템 제약
백그라운드 세션 제약
멀티윈도우 생산성 한계
```

따라서 트랙패드를 붙여도 “원격 접속 보조 장비”라는 성격은 크게 바뀌지 않는다.

### 사양 문제인가

부분적으로만 사양 문제다.

사양이 영향을 주는 부분:

- 화면 크기
- RAM
- 외부 디스플레이 지원
- Stage Manager 체감
- 브라우저 탭/웹앱 동시 사용
- 원격 화면 공유 디코딩 체감

사양이 거의 해결하지 못하는 부분:

- iPadOS 앱 샌드박스
- macOS 터미널/파일 시스템 부재
- VS Code/Cursor 데스크톱 앱 부재
- Chrome DevTools 확장/Pixel Helper 제약
- 백그라운드 프로세스 제약
- 개발용 멀티윈도우 워크플로우

즉, iPad Air가 느려서 문제라기보다 **iPadOS가 개발 워크스테이션 OS가 아니기 때문에 생기는 불편**이 크다.

### iPad Pro면 나아지는가

나아지는 부분은 있다.

```text
더 좋은 화면
더 빠른 칩
더 높은 주사율
더 좋은 외부 디스플레이/Stage Manager 체감
Magic Keyboard 조합의 완성도
원격 화면 공유나 웹앱 반응성
```

하지만 핵심 한계는 여전히 남는다.

```text
macOS가 아니다.
로컬 개발 환경을 온전히 구성하기 어렵다.
Chrome DevTools/Meta Pixel Helper 실전 디버깅은 여전히 맥북이 낫다.
Claude Code/Codex 장시간 작업은 SSH/tmux로 가능하지만 맥북보다 편하지 않다.
```

판정:

```text
iPad Pro는 iPad Air보다 좋은 원격 접속 단말이다.
하지만 맥북 에어 대체 개발기는 아니다.
```

### TJ님 상황 기준 판단

출퇴근 중 1시간 40분을 개발에 쓰려면 우선순위는 아래가 맞다.

```text
1순위: 맥북 에어 + Tailscale + SSH/tmux
2순위: 맥북 에어 + VS Code Remote SSH
3순위: iPad Air + 키보드 + Blink Shell
4순위: iPad Pro + Magic Keyboard
```

iPad Pro를 새로 사는 것보다, 이미 있는 맥북 에어를 원격 개발 클라이언트로 세팅하는 것이 먼저다. iPad Air는 “짧은 확인/간단 수정/긴급 대응”에 쓰고, 실제 Claude Code/Codex 장시간 개발은 맥북 에어 쪽이 낫다.

결론:

```text
iPad Air = 긴급 대응 단말
MacBook Air = 원격 개발 클라이언트
집 고정 주 노트북 = 실제 개발 워크스테이션
```

출퇴근 1시간 40분 활용 기준:

```text
맥북 에어:
Claude Code/Codex, 문서 작성, 코드 수정, git 작업까지 현실적으로 가능

아이패드 에어:
SSH로 로그 확인, 간단 수정, 문서 메모는 가능
장시간 Claude Code/Codex 개발은 키보드/멀티태스킹/세션 안정성 때문에 보조용
```

## 추천 운영안

### 단기 추천

지금은 주 노트북을 계속 들고 다니는 방식을 유지하되, 집 고정 원격 개발을 1주일 정도 병행 테스트한다.

이유:

- 현재 Meta/CAPI/아임웹/결제 테스트는 브라우저 관찰이 많다.
- 원격 개발 환경을 새로 만들면 생산성이 잠시 떨어질 수 있다.
- 운영 backend는 이미 GCP VM으로 분리했으므로, 노트북을 들고 다녀도 운영 서버 리스크는 줄었다.
- 집 회선은 원격 개발에 충분하므로, 출퇴근 시간 활용 목적의 원격 개발 테스트는 해볼 가치가 있다.

### 중기 추천

집 고정 원격 개발 환경을 “보조”로 만든다.

순서:

```text
1. 집 노트북에 Tailscale 설치
2. 회사 맥북 에어에도 Tailscale macOS 앱 설치
3. SSH key 접속 확인
4. tmux 설치 및 기본 세션 구성
5. VS Code Remote SSH 또는 Cursor 원격 접속 확인
6. iPad Air에서 Blink Shell로 SSH 접속 확인
7. 출퇴근 중 맥북 에어 또는 아이패드 핫스팟/이동망으로 SSH 유지 테스트
8. 하루 정도 문서 작업과 로그 확인만 원격으로 테스트
9. 괜찮으면 점진적으로 Claude Code/Codex 작업 일부를 원격으로 전환
```

출퇴근 테스트 체크리스트:

```text
1. 지하철/버스 이동 중 SSH가 끊기는지
2. 끊겨도 tmux 세션이 살아 있는지
3. Claude Code/Codex 응답이 체감상 답답하지 않은지
4. git pull/push가 안정적인지
5. VS Code Remote SSH가 이동 중 재연결을 잘 하는지
6. 아이패드에서 Blink Shell로 최소한의 긴급 작업이 가능한지
7. 원격 화면 공유 없이도 실제 개발 흐름이 충분한지
8. 출퇴근 구간 중 음영 구간이 반복되는 위치가 있는지
```

### 장기 추천

집 노트북을 장기 서버처럼 계속 켜둘 생각이면 맥북보다 맥미니 또는 클라우드 VM이 낫다.

```text
상시 운영 = GCP VM
상시 원격 개발 = 맥미니 또는 데스크톱
이동 개발 = 맥북
긴급 접속 = 아이패드
```

## 최종 판단

현재 작업 성격을 기준으로 보면:

```text
지금 당장 생산성 최우선:
주 노트북 들고 다니기

출퇴근 시간 활용 최우선:
집 고정 원격 개발 + 맥북 에어 접속

이동 피로 감소 최우선:
집 고정 원격 개발 환경을 보조로 구축

운영 안정성 최우선:
GCP VM 유지

iPad 활용:
주 개발이 아니라 긴급 대응/로그 확인/문서 확인
```

내 의견:

```text
1순위: 집 고정 원격 개발 환경을 보조로 바로 구축
2순위: 1주일 동안 주 노트북 휴대와 병행
3순위: 출퇴근 중 맥북 에어로 Claude Code/Codex 작업이 안정적이면 주 노트북 고정 전환 검토
4순위: 아이패드는 긴급 대응용으로만 본다
```

이유는 명확하다. 현재 집 회선은 원격 개발용으로 충분하고, 운영 서버는 이미 GCP VM으로 빠져 있다. 따라서 집 노트북을 운영 서버로 쓰는 리스크 없이, 출퇴근 시간 1시간 40분을 개발 시간으로 바꾸는 실험을 할 수 있다. 다만 브라우저 이벤트, 결제, Meta Pixel, CAPI를 동시에 봐야 하는 작업은 여전히 직접 노트북을 들고 다니는 방식이 빠르므로, 바로 완전 전환하지 말고 병행 테스트가 맞다.
