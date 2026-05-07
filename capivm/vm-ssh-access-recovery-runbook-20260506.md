# 운영 VM SSH 접근 복구 런북

작성 시각: 2026-05-06 23:46 KST
기준일: 2026-05-06
상태: active runbook
Owner: capivm / ops
Supersedes: [[vmdeploy|기존 VM 배포 기록의 SSH 부분]]
Next document: [[../gdn/paid-click-intent-production-receiver-deploy-result-20260506]]
Do not use for: 운영 DB write, env/secret 변경, 방화벽 변경, root/password login 활성화

## 10초 결론

운영 VM SSH는 완전히 막힌 것이 아니다. 직접 계정 `biocomkr_sns@34.64.104.94` 로그인은 `Permission denied (publickey)`로 실패하지만, `taejun@34.64.104.94` 로그인은 성공하고 `sudo -u biocomkr_sns`로 운영 repo와 PM2를 다룰 수 있다.

따라서 지금 운영 작업은 `taejun` 경유로 진행한다. 직접 `biocomkr_sns` 로그인을 다시 열고 싶으면 공개키를 `/home/biocomkr_sns/.ssh/authorized_keys`에 재등록하면 된다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase4 | [[#Phase4-Sprint6]] | paid_click_intent Mode B 운영 접근 | TJ + Codex | 90% / 70% | [[#Phase4-Sprint6\|이동]] |

## 다음 할일

| 순서 | Phase/Sprint | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 상세 | 컨펌 필요 |
|---:|---|---|---|---|---|---|---|---|
| 1 | [[#Phase4-Sprint6]] | 사용 가능 | Codex | 운영 작업은 `taejun` 경유로 진행한다 | 직접 계정 복구를 기다리면 Mode B가 지연된다 | `ssh taejun@34.64.104.94` 후 `sudo -u biocomkr_sns`로 repo/PM2 명령 실행 | [[#Phase4-Sprint6]] | NO |
| 2 | [[#Phase4-Sprint6]] | 선택 | TJ님 | 직접 `biocomkr_sns` SSH를 다시 열지 결정한다 | 장기 운영 편의성은 직접 계정 접속이 더 좋다 | 공개키를 `authorized_keys`에 재등록하고 권한을 700/600으로 맞춘다 | [[#직접 biocomkr_sns 로그인 복구 방법]] | 선택 |

## 현재 확인된 사실

| 항목 | 결과 |
|---|---|
| VM 이름 | `instance-20260412-035206` |
| 외부 IP | `34.64.104.94` |
| SSH용 도메인 | 없음. `att.ainativeos.net`은 Cloudflare Tunnel HTTP 도메인이지 SSH 도메인이 아님 |
| 직접 로그인 | `biocomkr_sns@34.64.104.94` 실패: `Permission denied (publickey)` |
| 우회 로그인 | `taejun@34.64.104.94` 성공 |
| 운영 repo | `/home/biocomkr_sns/seo/repo` |
| backend repo | `/home/biocomkr_sns/seo/repo/backend` |
| env symlink | `/home/biocomkr_sns/seo/repo/backend/.env -> /home/biocomkr_sns/seo/shared/env/backend.env` |
| PM2 backend | `seo-backend` online |
| frontend | `seo-frontend` online |
| cloudflared | `seo-cloudflared` online |
| 로컬 gcloud | 설치 안 됨. `which gcloud` 실패 |

## 바로 쓰는 운영 접속 명령

아래는 현재 동작하는 경로다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94
```

운영 작업 전에는 항상 아래 3가지를 먼저 확인한다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes taejun@34.64.104.94 \
  'hostname && whoami && sudo -n -u biocomkr_sns bash -lc "whoami && test -d /home/biocomkr_sns/seo/repo/backend && echo repo_ok"'
```

성공 기준:

```text
taejun login 가능
sudo -n -u biocomkr_sns 가능
repo_ok 출력
```

실패 시 해석:

| 실패 위치 | 의미 | 다음 조치 |
|---|---|---|
| `taejun` SSH 실패 | VM 접근 자체가 막힘 | GCP Console SSH 또는 IAM/방화벽 확인 |
| `sudo -n` 실패 | 비밀번호 없는 sudo 권한 문제 | TJ님이 VM에서 sudoers 확인 |
| `repo_ok` 없음 | repo 경로 변경 또는 권한 문제 | `/home/biocomkr_sns/seo` 구조 재확인 |

운영 backend repo와 PM2 상태를 보려면 아래처럼 실행한다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc '\''export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; cd /home/biocomkr_sns/seo/repo/backend && pm2 describe seo-backend --no-color | sed -n "1,35p"'\'''
```

운영 backend restart가 필요할 때는 아래 경로를 쓴다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc '\''export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; cd /home/biocomkr_sns/seo/repo/backend && pm2 restart seo-backend --update-env && pm2 save'\'''
```

## 배포 전 안전 체크

운영 VM에서 코드를 바꾸거나 PM2를 재시작하기 전에는 아래를 먼저 기록한다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc '\''export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; cd /home/biocomkr_sns/seo/repo && git rev-parse --short HEAD && git status --short && pm2 ls --no-color'\'''
```

해석:

- `git status --short`에 예상하지 못한 변경이 있으면 배포를 멈춘다.
- PM2에 `seo-backend`, `seo-frontend`, `seo-cloudflared`가 보이는지 확인한다.
- env/secret 변경은 이 런북 범위 밖이다.

## 배포 후 smoke 체크

backend 재시작 후 최소 아래를 확인한다.

```bash
curl -sS https://att.ainativeos.net/health | head -c 500
```

paid_click_intent no-write receiver가 살아 있는지 확인한다.

```bash
curl -sS -H 'Origin: https://biocom.kr' \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: curl/8.7.1 smoke-runner' \
  --data '{"site":"biocom","platform_hint":"google_ads","gclid":"TEST_GCLID_RUNBOOK_20260507","landing_url":"https://biocom.kr/?gclid=TEST_GCLID_RUNBOOK_20260507&utm_source=google&utm_medium=cpc","referrer":"https://www.google.com/","client_id":"runbook.1","ga_session_id":"runbook_session","captured_at":"2026-05-07T00:42:00+09:00"}' \
  https://att.ainativeos.net/api/attribution/paid-click-intent/no-send
```

성공 기준:

```text
ok=true
would_store=false
would_send=false
no_platform_send_verified=true
test_click_id=true
live_candidate_after_approval=false
```

## rollback 기준

아래 중 하나라도 발생하면 신규 변경을 되돌릴 후보로 둔다.

| 기준 | 대응 |
|---|---|
| `/health` 실패 | PM2 로그 확인 후 이전 backend 백업 복구 |
| receiver 5xx 지속 | route disable 또는 이전 backend archive 복구 |
| 결제/NPay 흐름 이상 | GTM tag pause와 backend route 영향 분리 |
| 외부 플랫폼 전송 의심 | 즉시 중단. GA4/Meta/Google Ads 전송 경로 감사 |
| raw payload logging 발견 | receiver logging 차단 후 로그 보관 범위 점검 |

Mode B 당시 backend 백업 위치:

```text
/home/biocomkr_sns/seo/shared/deploy-backups/20260506_paid_click_intent_no_send/backend-attribution-prev.tgz
```

이 백업은 `paid_click_intent/no-send` route 배포 직전 attribution route 백업이다. 전체 repo rollback이 아니라 해당 route 복구용으로 봐야 한다.

## 직접 biocomkr_sns 로그인 복구 방법

직접 로그인을 복구하려면 **공개키만** 등록한다. 개인키(`id_ed25519`)는 절대 서버나 문서에 붙여 넣지 않는다.

### 방법 A. 현재 동작하는 `taejun` 경유로 복구

1. 로컬에서 공개키를 확인한다.

```bash
cat ~/.ssh/id_ed25519.pub
```

2. 출력된 한 줄을 복사한다. 보통 아래처럼 시작한다.

```text
ssh-ed25519 AAAA... user@host
```

3. `taejun`으로 VM에 접속한다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94
```

4. VM 안에서 아래 명령을 실행한다. `ssh-ed25519 AAAA...` 부분에는 2번에서 복사한 공개키 한 줄을 그대로 넣는다.

```bash
sudo bash -lc '
set -euo pipefail
install -d -m 700 -o biocomkr_sns -g biocomkr_sns /home/biocomkr_sns/.ssh
touch /home/biocomkr_sns/.ssh/authorized_keys
chown biocomkr_sns:biocomkr_sns /home/biocomkr_sns/.ssh/authorized_keys
chmod 600 /home/biocomkr_sns/.ssh/authorized_keys
grep -qxF "ssh-ed25519 AAAA... user@host" /home/biocomkr_sns/.ssh/authorized_keys \
  || printf "%s\n" "ssh-ed25519 AAAA... user@host" >> /home/biocomkr_sns/.ssh/authorized_keys
'
```

5. 로컬에서 직접 로그인 검증을 한다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes biocomkr_sns@34.64.104.94 \
  'hostname && whoami && cd /home/biocomkr_sns/seo/repo/backend && export PATH=/home/biocomkr_sns/seo/node/bin:$PATH && pm2 ls --no-color'
```

### 방법 B. GCP Console SSH-in-browser로 복구

`taejun` SSH가 나중에 막히면 GCP Console의 브라우저 SSH로 VM에 들어간 뒤 방법 A의 4번 명령만 실행한다.

GCP Console에서 확인할 위치:

```text
Compute Engine -> VM instances -> instance-20260412-035206 -> SSH
```

### 방법 C. GCP metadata SSH key로 복구

OS Login 또는 instance metadata를 쓰는 프로젝트라면 GCP Console에서 SSH key를 metadata에 넣을 수 있다.

형식은 보통 아래와 같다.

```text
biocomkr_sns:ssh-ed25519 AAAA... user@host
```

이 방법은 프로젝트 IAM/OS Login 설정에 영향을 받으므로, 현재는 방법 A를 우선한다.

### 방법 D. `gcloud`로 복구

로컬에는 현재 `gcloud`가 설치되어 있지 않다. 설치 후 GCP 권한이 있다면 아래 방식으로 접근할 수 있다.

```bash
gcloud compute ssh biocomkr_sns@instance-20260412-035206 \
  --zone asia-northeast3-a \
  --project <GCP_PROJECT_ID>
```

이 방법은 GCP 프로젝트 ID와 IAM 권한이 필요하다.

## 검증 명령

직접 계정이 복구됐는지 확인:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes biocomkr_sns@34.64.104.94 \
  'hostname && whoami'
```

우회 경로가 계속 되는지 확인:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes taejun@34.64.104.94 \
  'hostname && whoami && sudo -n -u biocomkr_sns bash -lc "whoami && pwd"'
```

backend 상태 확인:

```bash
curl -sS https://att.ainativeos.net/health | head -c 500
```

paid_click_intent receiver 확인:

```bash
curl -sS -H 'Origin: https://biocom.kr' \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: curl/8.7.1 smoke-runner' \
  --data '{"site":"biocom","platform_hint":"google_ads","gclid":"TEST_GCLID_20260506","landing_url":"https://biocom.kr/product/123?gclid=TEST_GCLID_20260506","referrer":"https://www.google.com/","client_id":"555.666","ga_session_id":"777","captured_at":"2026-05-06T23:46:00+09:00"}' \
  https://att.ainativeos.net/api/attribution/paid-click-intent/no-send
```

성공 기준:

```text
ok=true
would_store=false
would_send=false
no_platform_send_verified=true
test_click_id=true
live_candidate_after_approval=false
```

## 하지 말아야 할 것

- 개인키를 서버나 문서에 붙여 넣지 않는다.
- password login을 켜지 않는다.
- root SSH login을 켜지 않는다.
- 방화벽을 넓게 열지 않는다.
- 이 SSH 복구 작업과 함께 env/secret, DB schema, 운영 원장을 바꾸지 않는다.
- `att.ainativeos.net`으로 SSH하지 않는다. 이 도메인은 HTTP tunnel이다.

## 이번 Codex 처리 결과

Codex는 직접 `biocomkr_sns` 로그인 복구 대신, 현재 동작하는 `taejun` 경유 경로를 사용했다.

결과:

- VM 접속 성공.
- `/home/biocomkr_sns/seo/repo/backend` 접근 성공.
- `seo-backend` PM2 상태 확인 성공.
- Mode B 범위 안에서 no-write receiver route 배포 성공.
- production TEST/negative smoke 통과.

직접 `biocomkr_sns` 로그인을 꼭 복구해야 하는지는 선택 사항이다. 장기 운영 편의성 때문에 복구를 권장하지만, 현재 긴급한 운영 작업은 `taejun` 경유로 가능하다.

#### Phase4-Sprint6

**이름**: paid_click_intent Mode B 운영 접근

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 Google click id 보존 검증 작업이 SSH key 문제로 멈추지 않게 하는 것이다.

완료한 것:

- 직접 `biocomkr_sns` 로그인 실패 확인.
- `taejun` 계정 경유 운영 repo 접근 확인.
- `sudo -u biocomkr_sns`로 backend PM2 확인.
- 실제 backend receiver 배포와 smoke 수행.

남은 것:

- 직접 `biocomkr_sns` 로그인을 복구할지 TJ님 선택.
- receiver-enabled GTM publish는 완료됐다. 남은 것은 24h/72h 모니터링과 직접 `biocomkr_sns` SSH 복구 여부 판단이다.
