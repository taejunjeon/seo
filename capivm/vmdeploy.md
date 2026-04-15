# 최소 VM 배포 실행 기록 - 2026-04-12

## 결론

최소 배포 범위는 확정했다.

```text
대상: backend Node/Express 유지
목적: att.ainativeos.net origin을 노트북이 아니라 VM으로 옮김
범위: payment-decision, payment-success, checkout-context, Meta CAPI sync, 관련 로그/원장
제외: Next.js 전환, CRM 발송 솔루션 확대, Cloud Run/Workers 재설계, 운영 DB 스키마 변경
```

로컬에서 바로 GCE VM을 생성하거나 배포까지 끝내지는 못했다. 현재 이 Mac에는 `gcloud`와 `pm2`가 없고, `cloudflared`만 설치되어 있다.

```text
gcloud: 없음
pm2: 없음
cloudflared: 2026.3.0
```

따라서 이번 단계에서는 **코드 운영 스위치 추가 + VM 배포 산출물 작성 + 로컬 빌드 검증**까지 진행한다. VM 생성/접속 정보가 준비되면 아래 절차대로 바로 올리면 된다.

## 지금 할 수 있는 것과 필요한 것

### 제가 이미 진행한 것

- backend를 Next.js로 바꾸지 않고 Express 그대로 VM에 올릴 수 있게 배포 산출물을 만들었다.
- VM 전환 중 CAPI/결제상태 sync가 노트북과 VM에서 동시에 돌지 않도록 환경변수 스위치를 추가했다.
- `/health`에서 현재 백그라운드 잡 상태를 확인할 수 있게 했다.
- VM용 `.env` 템플릿, PM2 설정, Ubuntu VM 초기 설치 스크립트, rsync 배포 스크립트를 만들었다.
- 로컬에서 `typecheck`, `build`, 임시 서버 `/health`, `payment-decision` endpoint까지 확인했다.
- 현재 로컬 영속 데이터 규모를 확인했다. `backend/data`는 약 104MB, `backend/logs`는 약 1.6MB라서 VM으로 복사 가능한 크기다.

### 제가 여기서 더 할 수 있는 것

- VM 접속 정보가 생기면 `setup-backend-vm.sh`와 `deploy-backend-rsync.sh` 기준으로 실제 배포 명령을 안내하거나 실행할 수 있다.
- VM에 올라간 뒤 `/health`, `payment-decision`, `capi log` API를 원격에서 검증할 수 있다.
- Cloudflare origin이 VM으로 바뀐 뒤 `https://att.ainativeos.net/health` 기준으로 외부 연결을 확인할 수 있다.
- 컷오버 후 24시간 동안 CAPI 중복/누락을 보는 확인 쿼리와 로그 체크를 정리할 수 있다.

### TJ님이 해야 하는 것

아래는 웹 콘솔 권한이나 계정 소유자 확인이 필요한 작업이라 제가 대신 완료할 수 없다.

- GCP에서 VM을 생성하거나 기존 VM 접속 정보를 제공한다.
- VM SSH 접속 정보, 예를 들면 `VM_USER`, `VM_HOST`, SSH key 사용 방식을 알려준다.
- VM에 넣을 실제 `backend.env` 시크릿 값을 준비한다. 시크릿은 문서나 채팅에 원문으로 남기지 않는 것이 원칙이다.
- Cloudflare에서 `att.ainativeos.net` origin을 VM으로 연결할 권한을 확인한다.
- Cloudflare Tunnel을 쓸지, VM 공인 IP + Cloudflare DNS/Proxy를 쓸지 최종 선택한다.

### 웹 콘솔 주소

GCP VM 생성:

```text
https://console.cloud.google.com/compute/instancesAdd
```

GCP VM 목록:

```text
https://console.cloud.google.com/compute/instances
```

Cloudflare Zero Trust Tunnel:

```text
https://one.dash.cloudflare.com/
```

Cloudflare DNS:

```text
https://dash.cloudflare.com/
```

Google Cloud CLI 설치 안내:

```text
https://cloud.google.com/sdk/docs/install
```

### 현재 로컬에서 확인된 제약

- 이 Mac에는 `gcloud`가 없어 제가 여기서 GCE VM을 바로 만들 수 없다.
- 로컬 `cloudflared tunnel list`는 origin certificate가 없어 목록 조회가 안 된다.
- 다만 현재 `cloudflared tunnel run --token ...` 프로세스가 떠 있는 흔적은 있다. 토큰 원문은 보안상 문서에 기록하지 않는다.
- 현재 로컬에는 7020 백엔드 관련 프로세스가 여러 개 떠 있는 상태로 보인다. 실제 컷오버 때는 VM 검증 후 로컬 백엔드와 로컬 tunnel/ngrok 중복 실행을 명시적으로 정리해야 한다.

### 로컬 검증 결과

2026-04-12 기준 통과:

```bash
npm --prefix backend run typecheck
npm --prefix backend run build
git diff --check -- capivm/vmdeploy.md backend/src/env.ts backend/src/bootstrap/startBackgroundJobs.ts backend/src/health/buildHealthPayload.ts backend/.env.example capivm/vmplan.md capivm/backend.env.vm.example capivm/ecosystem.config.cjs capivm/setup-backend-vm.sh capivm/deploy-backend-rsync.sh
```

스크립트 실행 권한:

```text
capivm/setup-backend-vm.sh executable
capivm/deploy-backend-rsync.sh executable
```

## 이번에 반영한 코드 변경

### 1. 백그라운드 잡 on/off 환경변수 추가

파일:

```text
backend/src/env.ts
backend/src/bootstrap/startBackgroundJobs.ts
backend/src/health/buildHealthPayload.ts
backend/.env.example
```

추가한 환경변수:

```text
BACKGROUND_JOBS_ENABLED
CWV_AUTO_SYNC_ENABLED
CAPI_AUTO_SYNC_ENABLED
CAPI_AUTO_SYNC_INTERVAL_MS
CAPI_AUTO_SYNC_LIMIT
ATTRIBUTION_STATUS_SYNC_ENABLED
ATTRIBUTION_STATUS_SYNC_INTERVAL_MS
ATTRIBUTION_STATUS_SYNC_LIMIT
```

이유:

VM 컷오버 때 노트북 백엔드와 VM 백엔드가 동시에 아래 작업을 돌면 데이터가 더러워질 수 있다.

- Attribution payment-status sync
- CAPI auto-sync
- 같은 주문의 CAPI 중복 전송
- CAPI 로그 중복 적재

이제 VM을 처음 띄울 때는 아래처럼 둘 수 있다.

```text
BACKGROUND_JOBS_ENABLED=true
CAPI_AUTO_SYNC_ENABLED=false
ATTRIBUTION_STATUS_SYNC_ENABLED=false
CWV_AUTO_SYNC_ENABLED=false
```

`att.ainativeos.net` origin을 VM으로 전환하고, 노트북 백엔드가 꺼진 것을 확인한 뒤 VM에서만 아래를 `true`로 바꾼다.

```text
CAPI_AUTO_SYNC_ENABLED=true
ATTRIBUTION_STATUS_SYNC_ENABLED=true
```

### 2. `/health`에 백그라운드 잡 상태 노출

이제 `/health` 응답에서 현재 VM이 CAPI auto-sync와 결제상태 sync를 돌고 있는지 볼 수 있다.

확인 포인트:

```text
backgroundJobs.enabled
backgroundJobs.capiAutoSync.enabled
backgroundJobs.attributionStatusSync.enabled
backgroundJobs.capiAutoSync.intervalMs
backgroundJobs.attributionStatusSync.intervalMs
```

컷오버 때 이 값이 가장 중요하다.

## 이번에 추가한 배포 산출물

### 1. `capivm/backend.env.vm.example`

VM용 `.env` 템플릿이다. 시크릿 값은 비워 두었다.

초기 컷오버 안전값:

```text
CAPI_AUTO_SYNC_ENABLED=false
ATTRIBUTION_STATUS_SYNC_ENABLED=false
CWV_AUTO_SYNC_ENABLED=false
```

### 2. `capivm/ecosystem.config.cjs`

PM2 실행 설정이다.

```text
app name: seo-backend
cwd: /opt/seo/repo/backend
script: dist/server.js
instances: 1
exec_mode: fork
```

단일 인스턴스로 고정한 이유는 CAPI sync 중복 실행을 막기 위해서다.

### 3. `capivm/setup-backend-vm.sh`

Ubuntu VM에서 1회 실행할 기본 설치 스크립트다.

설치/생성:

```text
Node.js 22
pm2
git
rsync
build-essential
/opt/seo/repo
/opt/seo/shared/backend-data
/opt/seo/shared/backend-logs
/opt/seo/shared/env
/opt/seo/shared/secrets
```

### 4. `capivm/deploy-backend-rsync.sh`

로컬 repo를 VM `/opt/seo/repo`로 복사하는 스크립트다.

사용 예:

```bash
VM_USER=<vm-user> VM_HOST=<vm-host> capivm/deploy-backend-rsync.sh
```

복사에서 제외하는 것:

```text
.git
node_modules
frontend/.next
backend/dist
backend/.env
backend/data
backend/logs
```

운영 데이터와 시크릿을 덮어쓰지 않기 위한 제외 목록이다.

## VM 배포 절차

### 1. VM 준비

GCE VM 권장:

```text
OS: Ubuntu LTS
Machine: e2-small 이상 권장
Disk: 30GB persistent disk
Port: Cloudflare Tunnel 사용 시 외부 7020 공개 불필요
```

VM 접속 후:

```bash
sudo bash /tmp/setup-backend-vm.sh
```

### 2. 코드 배치

권장 경로:

```text
/opt/seo/repo
```

방법은 둘 중 하나다.

```bash
git clone <repo-url> /opt/seo/repo
```

또는 로컬에서:

```bash
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude 'frontend/.next' \
  --exclude 'backend/dist' \
  --exclude 'backend/.env' \
  --exclude 'backend/data' \
  --exclude 'backend/logs' \
  /Users/vibetj/coding/seo/ <vm-user>@<vm-host>:/opt/seo/repo/
```

### 3. 영속 데이터 연결

VM에서:

```bash
cd /opt/seo/repo/backend

cp /opt/seo/shared/env/backend.env .env

rm -rf data logs
ln -s /opt/seo/shared/backend-data data
ln -s /opt/seo/shared/backend-logs logs
```

초기에는 현재 로컬 데이터를 복사한다.

```bash
rsync -az backend/data/ <vm-user>@<vm-host>:/opt/seo/shared/backend-data/
rsync -az backend/logs/ <vm-user>@<vm-host>:/opt/seo/shared/backend-logs/
```

주의:

VM 운영 시작 후에는 `backend/data`와 `backend/logs`를 배포로 덮어쓰면 안 된다.

### 4. 빌드

VM에서:

```bash
cd /opt/seo/repo/backend
npm ci
npm run typecheck
npm run build
```

### 5. PM2 시작

VM에서:

```bash
pm2 start /opt/seo/repo/capivm/ecosystem.config.cjs
pm2 save
pm2 startup
```

내부 health:

```bash
curl -sS http://localhost:7020/health
```

초기 기대값:

```text
backgroundJobs.capiAutoSync.enabled=false
backgroundJobs.attributionStatusSync.enabled=false
```

### 6. Cloudflare 연결

권장: Cloudflare Tunnel로 `att.ainativeos.net`을 VM `localhost:7020`에 연결.

원칙:

```text
origin 전환 전: VM health OK, auto-sync OFF
origin 전환 후: att.ainativeos.net health OK
노트북 백엔드 종료 후: VM auto-sync ON
```

외부 확인:

```bash
curl -sS https://att.ainativeos.net/health
```

### 7. 노트북 백엔드 종료 확인

로컬에서:

```bash
lsof -i :7020
ps aux | grep 'tsx watch src/server.ts'
ps aux | grep 'node dist/server.js'
```

노트북에서 백엔드가 계속 살아 있으면 안 된다.

### 8. VM auto-sync 활성화

VM `.env`에서:

```text
CAPI_AUTO_SYNC_ENABLED=true
ATTRIBUTION_STATUS_SYNC_ENABLED=true
```

재시작:

```bash
pm2 restart seo-backend --update-env
curl -sS http://localhost:7020/health
```

## 컷오버 후 검증

### 필수 API

```bash
curl -sS https://att.ainativeos.net/health
curl -sS 'https://att.ainativeos.net/api/attribution/payment-decision?order_no=TEST&order_code=TEST'
curl -sS 'https://att.ainativeos.net/api/meta/capi/log?limit=20'
```

### 실주문 스모크

1. 자사몰 카드 결제 1건
2. 자사몰 가상계좌 미입금 1건

기대값:

```text
카드: Browser Pixel Purchase 있음, event_id=Purchase.{order_code}
가상계좌: Browser Pixel Purchase 없음, VirtualAccountIssued 있음
```

### 24시간 모니터링

확인할 것:

- `/api/meta/capi/log`에서 4xx/5xx 없음
- 같은 `orderId + eventName` 운영 성공 중복 없음
- pending 주문이 Server CAPI `Purchase`로 나가지 않음
- VM `backend/logs`가 정상 증가
- 노트북 `backend/logs`는 더 이상 증가하지 않음

## 실행 조건 처리 결과

아래 실행 조건은 2026-04-12 배포에서 처리됐다.

```text
GCP 프로젝트/VM/zone 확인 완료
SSH 접속 계정 확인 완료
Cloudflare Tunnel token-file 적용 완료
VM backend.env 업로드 완료
로컬 backend/data, backend/logs 초기 복사 완료
```

시크릿과 Tunnel token 값은 문서에 기록하지 않는다.

## 현재 판단

Next.js로 바꾸지 않고 Express 백엔드 그대로 VM에 올리는 선택이 맞다.

이번 단계에서 가장 중요한 것은 기능 추가가 아니라 **단일 active origin 보장**이다. VM과 노트북이 동시에 CAPI sync를 돌지 않도록, 이번에 추가한 환경변수 스위치를 반드시 컷오버 절차에 포함해야 한다.

## 2026-04-12 VM 실제 진행 상태

### VM 정보

```text
GCP project: SEO-AEO
VM name: instance-20260412-035206
Instance ID: 8533489155621431560
Zone: asia-northeast3-a
External IP: 34.64.104.94
Internal IP: 10.178.0.2
Login user: biocomkr_sns
OS 확인값: Debian GNU/Linux 13
```

콘솔에서 Ubuntu 24.04 LTS Minimal을 골랐지만, VM 내부 `/etc/os-release` 기준으로는 Debian 13으로 확인됐다. 현재 작업에는 큰 문제는 없지만, 문서상 OS는 실제 확인값을 기준으로 본다.

### 최종 상태

- 로컬 SSH 공개키를 VM 사용자 `biocomkr_sns`의 `~/.ssh/authorized_keys`에 등록했다.
- 로컬 SSH 접속에 성공했다.
- `sudo`는 비밀번호가 필요해 `/opt/seo` 대신 사용자 홈의 `~/seo` 기준으로 배포 구조를 전환했다.
- 사용자 영역에 Node.js `v22.14.0`, npm `10.9.2`를 설치했다.
- 코드 업로드 완료: `~/seo/repo`.
- 운영 `.env` 업로드 완료: `~/seo/shared/env/backend.env`.
- SQLite는 WAL 파일을 직접 복사하지 않고 로컬 `sqlite3 .backup`으로 스냅샷을 만든 뒤 VM에 업로드했다.
- VM 내부 `npm ci` 완료.
- VM 내부 `typecheck/build`는 메모리 부족으로 중단하고, 로컬에서 검증된 `backend/dist`를 업로드하는 방식으로 전환했다.
- PM2 설치 및 `seo-backend` 실행 완료.
- Cloudflare Tunnel token-file 방식으로 `seo-cloudflared` 실행 완료.
- Cloudflare 원격 설정에서 `att.ainativeos.net -> http://localhost:7020` 연결 확인 완료.
- 사용자 crontab `@reboot pm2 resurrect` 등록 완료.
- 로컬 노트북의 `backend:7020`, `cloudflared`, `ngrok` 프로세스는 종료했다.
- 현재 `att.ainativeos.net`의 active origin은 VM이다.

현재 VM 운영 오버라이드:

```text
BACKGROUND_JOBS_ENABLED=true
CWV_AUTO_SYNC_ENABLED=false
CAPI_AUTO_SYNC_ENABLED=true
ATTRIBUTION_STATUS_SYNC_ENABLED=true
CHANNELTALK_MARKETING_ENABLED=false
```

VM runtime data/log 경로:

```text
~/seo/shared/backend-data
~/seo/shared/backend-logs
```

backend symlink 구성:

```text
~/seo/repo/backend/.env -> ~/seo/shared/env/backend.env
~/seo/repo/backend/data -> ~/seo/shared/backend-data
~/seo/repo/backend/logs -> ~/seo/shared/backend-logs
```

PM2 상태:

```text
seo-backend: online, restart 0
seo-cloudflared: online, restart 0
```

### 검증 결과

외부 health:

```text
https://att.ainativeos.net/health
status=ok
backgroundJobs.capiAutoSync.enabled=true
backgroundJobs.attributionStatusSync.enabled=true
backgroundJobs.cwvAutoSync.enabled=false
```

외부 핵심 API:

```text
GET /api/attribution/payment-decision
GET /api/meta/capi/log
```

검증 예시:

```text
order_no=202604126682764
order_code=o20260412cdb6664e94ccb
decision.status=pending
decision.browserAction=block_purchase_virtual_account
matchedBy=toss_direct_order_id
```

CAPI log 확인:

```text
total=869
success=869
failure=0
latest send_path=auto_sync
```

로컬 확인:

```text
lsof -i :7020 -> 없음
로컬 cloudflared/ngrok/backend 프로세스 -> 없음
```

따라서 노트북과 VM이 동시에 CAPI sync를 돌 가능성은 현재 기준으로 차단되어 있다.

### 운영 명령

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes biocomkr_sns@34.64.104.94
source ~/seo/env.sh
pm2 status
pm2 logs seo-backend --lines 100 --nostream
pm2 logs seo-cloudflared --lines 100 --nostream
curl -sS http://localhost:7020/health
```

외부 확인:

```bash
curl -sS https://att.ainativeos.net/health
curl -sS 'https://att.ainativeos.net/api/meta/capi/log?limit=5'
```

### 롤백

VM tunnel만 멈추면 `att.ainativeos.net`은 더 이상 VM으로 들어오지 않는다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes biocomkr_sns@34.64.104.94
source ~/seo/env.sh
pm2 stop seo-cloudflared
```

그 뒤 로컬 백엔드와 로컬 tunnel을 의도적으로 다시 올려야 한다. 단, 로컬/VM이 동시에 active origin이 되면 CAPI 중복 위험이 생기므로 동시에 켜면 안 된다.

### 남은 주의점

- VM은 2GB급이라 원격 `npm run typecheck`/`npm run build`가 메모리 부족으로 실패할 수 있다. 당분간 로컬에서 검증한 `backend/dist`를 업로드하는 방식이 안전하다.
- `sudo` 권한 없이 구성했기 때문에 PM2 systemd startup 대신 사용자 crontab `@reboot pm2 resurrect` 방식이다.
- GCP Browser SSH 또는 OS Login 설정에 따라 `~/.ssh/authorized_keys`가 다시 사라질 수 있다. 로컬 SSH가 `Permission denied (publickey)`가 되면 브라우저 SSH에서 공개키를 재등록해야 한다.

---

## 2026-04-15 — 커피 Toss 키 전환 실행 기록 (자회사 알로스타에프앤비)

### 배경

2026-02-23 커피 사업부가 본사(바이오컴)에서 자회사 알로스타에프앤비로 이전되며 Toss merchant 가 `iw_thecleaz5j` → `iw_theclevibf` 로 전환됨. `meta/capimeta.md` 상단 "커피 Toss 신 키 적용 + 검증 완료" 참조.

### VM `.env` 편집 절차 (실행 완료)

VM 실제 env 파일: `/home/biocomkr_sns/seo/shared/env/backend.env` (symlink from `~/seo/repo/backend/.env`).

1. 백업

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes biocomkr_sns@34.64.104.94 \
  'cp ~/seo/shared/env/backend.env ~/seo/shared/env/backend.env.bak_20260415_newtosskey'
```

2. 구 `_API` suffix 3종 주석 + shop id 신 merchant 로 교체 (sed in-place)

```bash
ssh ... 'sed -i "
s|^TOSS_SHOP_ID_COFFEE=iw_thecleaz5j|TOSS_SHOP_ID_COFFEE=iw_theclevibf  # 2026-04-15 자회사 신 merchant|
s|^TOSS_LIVE_SECRET_KEY_COFFEE_API=live_sk_P9BRQ.*|# 2026-04-15 deprecated — 구 본사 merchant\n#&|
s|^TOSS_LIVE_CLIENT_KEY_COFFEE_API=live_ck_DpexMgkW.*|# 2026-04-15 deprecated\n#&|
s|^TOSS_LIVE_SECURITY_KEY_COFFEE_API=a7c513ab.*|# 2026-04-15 deprecated\n#&|
" ~/seo/shared/env/backend.env'
```

3. 신 자회사 키 블록 추가 (파일 끝)

```text
# 2026-04-15 추가 — 토스페이먼츠 자회사 알로스타에프앤비(더클린커피/팀키토) 신 merchant iw_theclevibf
# env.ts fallback chain 이 TOSS_LIVE_SECRET_KEY_COFFEE 를 1순위로 읽으므로 아래 표준 이름으로 세팅
TOSS_LIVE_SECRET_KEY_COFFEE=live_sk_XZYkKL...
TOSS_LIVE_CLIENT_KEY_COFFEE=live_ck_eqRGgYO1...
TOSS_LIVE_SECURITY_KEY_COFFEE=<security_key>
# 코드 배포 후(env.ts v2 반영) 에는 아래 원본 변수명도 같이 사용됨
TOSS_SHOP_ID_NEWCOFFEE=iw_theclevibf
TOSS_NEW_COFFEE_API_SECRET_KEY=live_sk_XZYkKL...
TOSS_NEW_COFFEE_API_LIVE_CLIENT_KEY=live_ck_eqRGgYO1...
TOSS_NEW_COFFEE_API_SECURITY_KEY_LIVE=<security_key>
```

4. PM2 재시작 (반드시 `--update-env` 플래그 사용 — 안 쓰면 새 env 로드 안 됨)

```bash
ssh ... 'export PATH=$PATH:/home/biocomkr_sns/seo/node/bin && pm2 restart seo-backend --update-env'
```

5. 검증

```bash
curl -s https://att.ainativeos.net/health | jq '.apis.toss.stores.coffee'
# → { shopId:true, liveKey:true, testKey:true, ready:true }

for o in 202604140316422 202604144671071 202604148401098; do
  curl -s "https://att.ainativeos.net/api/attribution/payment-decision?store=coffee&orderId=$o&debug=1" \
    | jq '.decision.status, .directToss.matchedRows'
done
# → confirmed/1, pending/1, confirmed/1 ✔
```

### 롤백 절차

```bash
ssh ... 'cp ~/seo/shared/env/backend.env.bak_20260415_newtosskey ~/seo/shared/env/backend.env'
ssh ... 'export PATH=$PATH:/home/biocomkr_sns/seo/node/bin && pm2 restart seo-backend --update-env'
```

### 관련 코드 변경 (로컬 커밋 대기)

본 env 전환을 위해 로컬에서 수정된 파일:
- `backend/src/env.ts`: `TOSS_LIVE_SECRET_KEY_COFFEE` / `TOSS_LIVE_CLIENT_KEY_COFFEE` / `TOSS_SHOP_ID_COFFEE` / `TOSS_TEST_*_COFFEE` fallback chain 에 신 자회사 env 이름 1순위 삽입
- `backend/src/routes/attribution.ts` `fetchTossDecisionRows`: `/v1/payments/orders/{raw}` 404 시 `-P1` suffix retry 추가 (biocom/coffee 공통 pre-existing bug 해결)
- `backend/.env` 구 `TOSS_LIVE_*_COFFEE_API` 3 라인 주석 처리 (삭제 금지 표시)

VM 은 컴파일된 `dist/` 로 돌아가므로 위 코드 변경 중 env.ts 는 **이미 VM 에 반영된 fallback 동작**으로 자동 커버됨(이전 코드가 `TOSS_LIVE_SECRET_KEY_COFFEE ?? TOSS_LIVE_SECRET_KEY_COFFEE_API` 체인으로 이미 읽음). `-P1` 패치는 VM 에 아직 없으나, ledger paymentKey fallback 경로가 같은 결과를 만들어 주어 당장 문제 없음. 다음 정식 배포 시 같이 업로드 예정.
- `CWV_AUTO_SYNC_ENABLED=false`는 의도된 상태다. 이번 VM은 CAPI/Attribution 정합성 안정화가 목적이며, CWV 자동 수집은 별도 단계에서 켠다.
