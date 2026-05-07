# seo VM 운영 정본

작성일: 2026-04-24
문서 성격: **가변형 정본** (VM 접속·배포·트러블슈팅 단일 출처)
상위: [`../CLAUDE.md`](../CLAUDE.md), [`../capivm/vmdeploy.md`](../capivm/vmdeploy.md) (이전 backend 배포 문서)

## 0. 10초 요약

| 항목 | 값 |
|---|---|
| **GCP 프로젝트** | `SEO-AEO` |
| **VM 인스턴스** | `instance-20260412-035206` |
| **Region / Zone** | `asia-northeast3` / `asia-northeast3-a` |
| **외부 IP** | **`34.64.104.94`** |
| 내부 IP | `10.178.0.2` |
| OS | Debian 13 (kernel 6.12.73) |
| **SSH user (내 계정)** | **`taejun`** · NOPASSWD sudo · google-sudoers 그룹 |
| 실제 운영 user | `biocomkr_sns` (pm2 · 모든 앱 owner) |
| repo 경로 | `/home/biocomkr_sns/seo/repo/` |
| Node 경로 | `/home/biocomkr_sns/seo/node/bin/node` (v22.14.0) |
| pm2 dump | `/home/biocomkr_sns/.pm2/dump.pm2` |

## 1. 접속

```bash
ssh taejun@34.64.104.94
```

- private key: 이 Mac 의 `~/.ssh/id_ed25519`
- public key 는 GCP 콘솔 → VM 인스턴스 메타데이터 → SSH 키 섹션에 등록됨 (2026-04-24 추가)
- Key comment: `taejun@biocom.kr`
- 이후 rsync/scp 도 같은 경로로 가능

### 1.1 현재 우회 접속 기준 (2026-05-06 확인)

운영 VM SSH는 완전히 막힌 상태가 아니다. 직접 운영 계정 로그인은 실패하지만, `taejun` 계정으로 들어간 뒤 `sudo -u biocomkr_sns`로 운영 repo와 PM2 작업이 가능하다.

현재 실패하는 경로:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes biocomkr_sns@34.64.104.94
# Permission denied (publickey)
```

현재 동작하는 우회 경로:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94
```

운영 backend 상태를 한 줄로 확인:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc '\''export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; cd /home/biocomkr_sns/seo/repo/backend && pm2 describe seo-backend --no-color | sed -n "1,35p"'\'''
```

운영 backend restart가 필요할 때:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc '\''export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; cd /home/biocomkr_sns/seo/repo/backend && pm2 restart seo-backend --update-env && pm2 save'\'''
```

`att.ainativeos.net`은 Cloudflare Tunnel HTTP 도메인이다. SSH 도메인이 아니므로 `ssh att.ainativeos.net` 방식으로 접근하지 않는다.

### 1.2 sudo 로 biocomkr_sns 로 작업

```bash
sudo -iu biocomkr_sns bash
# 또는 한줄 실행
sudo -u biocomkr_sns bash -c "cd ~/seo/repo && pm2 list"
```

Node PATH 는 login shell 에서 자동 로딩 안 됨. 명령 실행 시 직접 주입:

```bash
sudo -u biocomkr_sns bash -lc 'export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; node --version'
```

### 1.3 직접 `biocomkr_sns` SSH 복구 방법

직접 운영 계정 로그인을 복구하려면 **공개키만** `/home/biocomkr_sns/.ssh/authorized_keys`에 등록한다. 개인키(`~/.ssh/id_ed25519`)는 서버나 문서에 붙여 넣지 않는다.

1. 로컬에서 공개키를 확인한다.

```bash
cat ~/.ssh/id_ed25519.pub
```

2. `taejun` 경유로 VM에 접속한다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94
```

3. VM 안에서 아래 명령을 실행한다. `ssh-ed25519 AAAA... user@host` 부분은 1번에서 확인한 공개키 한 줄로 바꾼다.

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

4. 로컬에서 직접 로그인 복구 여부를 검증한다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes biocomkr_sns@34.64.104.94 \
  'hostname && whoami && cd /home/biocomkr_sns/seo/repo/backend && export PATH=/home/biocomkr_sns/seo/node/bin:$PATH && pm2 ls --no-color'
```

`taejun` 접속까지 막힌 경우에는 GCP Console 브라우저 SSH를 사용한다.

```text
Google Cloud Console
→ Compute Engine
→ VM instances
→ instance-20260412-035206
→ SSH
```

브라우저 SSH로 들어간 뒤에는 위 3번의 `authorized_keys` 등록 명령만 실행하면 된다. 자세한 복구 런북은 [capivm/vm-ssh-access-recovery-runbook-20260506.md](../capivm/vm-ssh-access-recovery-runbook-20260506.md)에 있다.

## 2. PM2 앱 목록 (2026-04-24 기준)

| ID | name | cwd | script | port |
|---|---|---|---|---|
| 0 | `seo-backend` | `~/seo/repo/backend` | `dist/server.js` | 7020 |
| 1 | `seo-cloudflared` | — | `cloudflared tunnel run --token-file …` | — |
| 2 | **`seo-frontend`** | `~/seo/repo/frontend` | `node_modules/next/dist/bin/next start --port 3001` | **3001** |

### 2.1 pm2 기본 명령

```bash
sudo -u biocomkr_sns bash -lc '
  export PATH=/home/biocomkr_sns/seo/node/bin:$PATH
  pm2 list
  pm2 logs seo-frontend --lines 30
  pm2 restart seo-frontend
'
```

### 2.2 ecosystem 파일

경로: `/home/biocomkr_sns/seo/repo/capivm/ecosystem.config.cjs`
`appRoot = process.env.APP_ROOT || "/opt/seo"` — VM 에서는 **`APP_ROOT=/home/biocomkr_sns/seo`** 환경변수 필수. pm2 restart 시에도 줘야 함:

```bash
APP_ROOT=/home/biocomkr_sns/seo pm2 start capivm/ecosystem.config.cjs --only seo-frontend
```

## 3. Cloudflare Tunnel (중요)

- **token 모드** (`--token-file /home/biocomkr_sns/seo/shared/secrets/cloudflared.token`)
- config.yml 파일 없음 → VM 편집 불가
- **Public Hostname 관리는 Cloudflare Zero Trust Dashboard** 에서만 가능

### 3.1 대시보드 경로

```
https://one.dash.cloudflare.com/
→ Networks → Tunnels → (기존 Tunnel) → Public Hostname 탭
```

현재 등록된 hostname (예상):
- `att.ainativeos.net` → `http://localhost:7020` (backend)
- `coffeevip.ainativeos.net` → `http://localhost:3001` (frontend, 레거시/커피 공유용)
- `biocom.ainativeos.net` → `http://localhost:3001` (frontend, 바이오컴 본사/SEO 권장 URL) ← **추가 필요**

### 3.2 신규 호스트 추가 절차

1. Zero Trust → Networks → Tunnels → 해당 Tunnel 클릭
2. **Public Hostname** 탭 → **Add a public hostname**
3. 입력:
   - Subdomain: `biocom`
   - Domain: `ainativeos.net`
   - Type: `HTTP`
   - URL: `localhost:3001`
4. Save → 수초 이내 반영 (DNS CNAME 자동 생성)
5. 검증: `curl -sI https://biocom.ainativeos.net/seo` → HTTP 200

`coffeevip.ainativeos.net/seo`는 실제 내용이 바이오컴 본사 SEO라 혼동을 만든다. SEO/AEO 공유 링크는 `https://biocom.ainativeos.net/seo`를 기준으로 사용한다.

## 4. 배포 절차 (frontend 기준)

### 4.1 기본 update flow

로컬 맥에서:
```bash
cd /Users/vibetj/coding/seo/frontend
tar czf - --exclude=node_modules --exclude=.next --exclude=.DS_Store . \
  | ssh taejun@34.64.104.94 "rm -rf /tmp/seo-frontend-new && mkdir -p /tmp/seo-frontend-new && tar xzf - -C /tmp/seo-frontend-new"
scp /Users/vibetj/coding/seo/capivm/ecosystem.config.cjs taejun@34.64.104.94:/tmp/
```

VM 에서:
```bash
sudo rm -rf /home/biocomkr_sns/seo/repo/frontend.old
sudo mv /home/biocomkr_sns/seo/repo/frontend /home/biocomkr_sns/seo/repo/frontend.old
sudo cp -r /tmp/seo-frontend-new /home/biocomkr_sns/seo/repo/frontend
sudo chown -R biocomkr_sns:biocomkr_sns /home/biocomkr_sns/seo/repo/frontend
sudo cp /tmp/ecosystem.config.cjs /home/biocomkr_sns/seo/repo/capivm/ecosystem.config.cjs
sudo chown biocomkr_sns:biocomkr_sns /home/biocomkr_sns/seo/repo/capivm/ecosystem.config.cjs

sudo -u biocomkr_sns bash -lc '
  export PATH=/home/biocomkr_sns/seo/node/bin:$PATH
  cd /home/biocomkr_sns/seo/repo/frontend
  [ -f .env.local ] || cp .env.vm.example .env.local
  mkdir -p /home/biocomkr_sns/seo/shared/frontend-logs
  npm ci --no-audit --no-fund
  npm run build
  export APP_ROOT=/home/biocomkr_sns/seo
  cd /home/biocomkr_sns/seo/repo
  pm2 restart seo-frontend || APP_ROOT=/home/biocomkr_sns/seo pm2 start capivm/ecosystem.config.cjs --only seo-frontend
  pm2 save
'
```

예상 소요: rsync 10초 + npm ci 20~30초 + build 2~3분 + pm2 restart 5초 = **3~4분**

### 4.2 rsync 설치돼 있지 않음 주의

VM 기본 이미지엔 `rsync` 미설치. tar+ssh 파이프 사용 (위 참조). 원하면:

```bash
sudo apt-get update && sudo apt-get install -y rsync
```

### 4.3 backend 배포는 별도 경로

`capivm/deploy-backend-rsync.sh` 와 `capivm/vmdeploy.md` 참조. frontend 배포가 backend 를 건드리지 않음.

## 5. 주요 경로 레퍼런스

```
/home/biocomkr_sns/
├── .pm2/                  # pm2 daemon state
├── .npm/                  # npm cache
├── seo/
│   ├── bin/
│   │   └── cloudflared    # Cloudflare tunnel binary
│   ├── node/              # Node.js 독립 설치 (v22.14.0)
│   │   └── bin/{node,npm,npx,pm2}
│   ├── repo/              # 코드 루트
│   │   ├── backend/       # Express 서버
│   │   ├── frontend/      # Next.js (2026-04-24 신규)
│   │   ├── capivm/        # pm2 ecosystem + 배포 스크립트
│   │   ├── package.json
│   │   └── _capivm        # (단일 파일 · 레거시 표식)
│   └── shared/
│       ├── backend-logs/
│       ├── frontend-logs/
│       └── secrets/
│           └── cloudflared.token
└── (home root)
```

## 6. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `pm2 start` → `Script not found: /opt/seo/...` | `APP_ROOT` env 누락 | `APP_ROOT=/home/biocomkr_sns/seo` 먼저 설정 |
| `node: command not found` | login shell 에 PATH 미주입 | `export PATH=/home/biocomkr_sns/seo/node/bin:$PATH` |
| `cannot open /home/biocomkr_sns` (taejun) | 다른 user 홈 접근 제한 | `sudo -u biocomkr_sns` 경로로 실행 |
| cloudflared config 편집 안 됨 | token 모드 (config.yml 없음) | Zero Trust Dashboard 에서 Public Hostname 관리 |
| VM 에 rsync 없음 | 기본 미설치 | `tar czf - . \| ssh "tar xzf - -C /dst"` 로 대체 or `sudo apt install rsync` |
| `biocomkr_sns@34.64.104.94` → `Permission denied (publickey)` | 운영 계정 `authorized_keys`에 현재 Mac 공개키가 없거나 OS Login/metadata 반영이 사라짐 | 우선 `taejun@34.64.104.94`로 접속 후 `sudo -u biocomkr_sns`로 작업. 직접 복구는 §1.3 공개키 재등록 |
| `ssh att.ainativeos.net` 실패 | `att.ainativeos.net`은 HTTP Cloudflare Tunnel 도메인이지 SSH endpoint가 아님 | SSH는 외부 IP `34.64.104.94`와 `taejun` 경유 사용 |
| 빌드 중 OOM | 메모리 제약 | 스왑 2GB 추가: `sudo fallocate -l 2G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |

## 7. 보안 · 참고

- VM external IP `34.64.104.94` 는 Cloudflare Proxy 뒤에 숨겨져 있음 (정상). 직접 IP로 접근 시 Cloudflare 우회라 권장 안 함.
- `.env`, secret 파일은 `/home/biocomkr_sns/seo/shared/secrets/` 와 각 앱 루트의 `.env*` 에 존재. Git 추적 안 됨.
- taejun 계정 sudo 는 NOPASSWD 라 명령 자동화 편리하나, 실수 방지 필요 (특히 `rm -rf`).

## 8. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-04-12 | VM 생성 · backend + cloudflared 초기 배포 (`capivm/vmdeploy.md`) |
| 2026-04-24 | taejun public key 등록 · frontend(seo-frontend) 배포 추가 · 정본 문서 신설 |
| 2026-05-07 | 직접 `biocomkr_sns` SSH 실패 시 `taejun` 경유 우회 방법과 공개키 재등록 복구 절차 추가 |

## 9. 참고 문서

- [capivm/vmdeploy.md](../capivm/vmdeploy.md) — 최초 backend 배포 기록
- [capivm/vm-ssh-access-recovery-runbook-20260506.md](../capivm/vm-ssh-access-recovery-runbook-20260506.md) — 운영 VM SSH 우회·복구 상세 런북
- [capivm/deploy-frontend.md](../capivm/deploy-frontend.md) — frontend 배포 가이드 (초안)
- [capivm/ecosystem.config.cjs](../capivm/ecosystem.config.cjs) — pm2 3개 앱 정의
- [capivm/deploy-frontend-rsync.sh](../capivm/deploy-frontend-rsync.sh) — rsync 래퍼 (VM rsync 설치 후 사용 가능)
