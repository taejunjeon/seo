# Frontend VM 배포 가이드 · `/coffeevip` 공유용

작성일: 2026-04-24
대상: `att.ainativeos.net` 기반 GCE VM (기존 backend 가동 중)
목적: `/coffeevip` 페이지(+ 나머지 frontend)를 VM 으로 올려 URL 공유 가능하게

---

## 0. 전제 (이미 돼있는 것)

- VM 에 `seo-backend` pm2 프로세스가 `7020` 포트로 돌고 있음 (`att.ainativeos.net` → VM:7020)
- Cloudflare Tunnel 사용 중 (VM 의 `cloudflared` 데몬)
- `/opt/seo/repo/` 에 코드가 rsync 돼있음
- `/coffeevip` 는 backend API 호출 없는 **완전 정적 페이지**라 frontend 만 배포해도 정상 작동

## 1. 이번 배포에서 추가되는 것

| 자산 | 용도 |
|---|---|
| `capivm/deploy-frontend-rsync.sh` | 로컬 → VM 소스 전송 (.next · node_modules 제외) |
| `frontend/.env.vm.example` | VM 용 Next.js 환경변수 샘플 |
| `capivm/ecosystem.config.cjs` (수정) | `seo-frontend` 앱 추가 (pm2) |

---

## 2. 배포 순서 (최초 1회 · 약 20~30분)

### Step 1. 로컬에서 소스 rsync (1~2분)

```bash
cd /Users/vibetj/coding/seo
VM_USER=<vm-user> VM_HOST=<vm-host> capivm/deploy-frontend-rsync.sh
```

`<vm-user>` / `<vm-host>` 는 기존 backend 배포에서 쓰던 값 그대로.

### Step 2. VM SSH 접속 후 빌드 (5~10분)

```bash
ssh <vm-user>@<vm-host>
cd /opt/seo/repo/frontend

# 최초 1회만
cp .env.vm.example .env.local
mkdir -p /opt/seo/shared/frontend-logs

# 의존성 + 빌드
npm ci
npm run build
```

### Step 3. pm2 에 seo-frontend 등록 + 시작 (1분)

```bash
cd /opt/seo/repo
pm2 start capivm/ecosystem.config.cjs --only seo-frontend
# (전체 reload 원하면: pm2 reload capivm/ecosystem.config.cjs)
pm2 save
pm2 status
```

확인: `seo-frontend` online · port 3001 바인딩.

### Step 4. VM 내부 health check (1분)

```bash
curl -s http://localhost:3001/coffeevip | head -20
# HTML 응답에 "바이오컴 × 더클린커피 VIP 전략" 보이면 OK
```

### Step 5. Cloudflare Tunnel 에 coffeevip 호스트 추가 (5~10분)

VM 의 `~/.cloudflared/config.yml` (또는 `/etc/cloudflared/config.yml`) 편집 — `ingress:` 에 아래 블록을 **기존 att.ainativeos.net 위**에 추가:

```yaml
ingress:
  # 신규 · frontend 공유용
  - hostname: coffeevip.ainativeos.net
    service: http://localhost:3001
  # 기존 · backend 유지
  - hostname: att.ainativeos.net
    service: http://localhost:7020
  # fallback
  - service: http_status:404
```

저장 후 데몬 재시작:

```bash
sudo systemctl restart cloudflared
# 또는 cloudflared 수동 실행 중이면: pm2 restart cloudflared
```

### Step 6. Cloudflare DNS 에 CNAME 추가 (사용자 브라우저 작업 · 3분)

Cloudflare 대시보드 → 해당 존 `ainativeos.net` → DNS → **Add record**:

- Type: `CNAME`
- Name: `coffeevip`
- Target: `<기존 att.ainativeos.net 이 가리키는 Tunnel UUID>.cfargotunnel.com`
- Proxy: **Proxied (주황 구름)**
- TTL: Auto

(기존 `att` 레코드가 이미 Tunnel 로 연결돼 있으면 해당 Target 을 그대로 복사해서 `coffeevip` 이름으로 같은 값 사용)

### Step 7. 외부 접속 확인 (1분)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://coffeevip.ainativeos.net/coffeevip
# 200 이면 성공
```

브라우저로 `https://coffeevip.ainativeos.net/coffeevip` 열어 실제 UI 확인.

## 3. 공유 링크 (최종)

```
https://biocom.ainativeos.net/seo
```

다른 페이지 (`/`, `/ads`, `/crm`, `/coffee`, `/callprice` 등)도 같이 공개됨.
단 `NEXT_PUBLIC_API_BASE_URL=http://localhost:7020` 이면 외부 브라우저에서 호출되는 API 가 맞지 않아 해당 페이지들은 일부 섹션이 깨진 채 표시됨.
바이오컴 본사/SEO 공유는 `biocom.ainativeos.net`를 기준으로 한다. `coffeevip.ainativeos.net/seo`는 내용과 URL 신호가 맞지 않으므로 임시 확인용으로만 사용한다.

### 3.1 보안 보강 (선택)

공개 URL 이라 URL 만 알면 누구나 접근. 비공개로 하려면:

- **Cloudflare Access** 로 이메일·One-Time PIN 인증 추가 (무료 tier 로 가능)
- 또는 Next.js middleware 에 `Basic-Auth` 한 줄 추가
- 또는 아예 `robots.txt` + `noindex` meta 로 검색엔진 색인만 차단

필요하면 요청 주시오.

---

## 4. 업데이트 배포 (코드 변경 시)

```bash
# 로컬
VM_USER=<vm-user> VM_HOST=<vm-host> capivm/deploy-frontend-rsync.sh

# VM
ssh <vm-user>@<vm-host>
cd /opt/seo/repo/frontend
npm ci    # package.json 변경 없으면 스킵
npm run build
pm2 restart seo-frontend
```

1~3분 내 반영.

---

## 5. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `pm2 start` 실패 · `next` not found | `npm ci` 누락 · node_modules 재설치 |
| 503 / 502 | cloudflared 가 port 3001 못 찾음 · `curl http://localhost:3001` 로 로컬 확인 |
| CNAME 이 proxy 안 됨 | Cloudflare DNS 에서 Proxied (주황 구름) 활성화 |
| 빌드 시 OOM | VM 메모리 1GB 미만이면 스왑 필요: `sudo fallocate -l 2G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| `/coffeevip` 만 404 | `.next/` 빌드 결과물 부재 · `npm run build` 재실행 |

---

## 6. 롤백

```bash
ssh <vm-user>@<vm-host>
pm2 stop seo-frontend
pm2 delete seo-frontend
# cloudflared config.yml 에서 coffeevip.ainativeos.net 블록 삭제 후 restart
# Cloudflare DNS 에서 coffeevip CNAME 제거
```

backend 는 전혀 건드리지 않으므로 `seo-backend` 는 그대로 가동 유지.

---

## 7. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-04-24 | 신규 작성 · frontend 배포 자산 3종 추가 (rsync 스크립트 · env 샘플 · pm2 앱 정의) |
