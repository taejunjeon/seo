# 서버 반복 중단 원인 분석 및 해결책

작성일: 2026-03-28

## 1. 문제 현상

- 프론트(7010), 백엔드(7020) 서버가 대화 중 반복적으로 접속 불가 상태가 됨
- LISTEN은 되어있지만 응답이 안 되거나, 프로세스 자체가 종료됨
- TJ님이 브라우저에서 접속 시도할 때마다 `ERR_CONNECTION_REFUSED` 또는 `ERR_EMPTY_RESPONSE` 발생

## 2. 원인 분석 — 3가지 원인이 복합적으로 작용

### 원인 A. `head -N` 파이프로 인한 프로세스 조기 종료

```bash
# Claude Code가 사용한 방식
npm run dev 2>&1 | head -20
```

`head -20`은 20줄 출력 후 파이프를 닫는다. 이때 `npm run dev` 프로세스에 `SIGPIPE`가 전달되면서 프로세스가 종료된다.
이것이 백엔드가 반복적으로 죽는 **가장 큰 원인**이었다.

**발생 빈도**: `run_in_background`로 실행할 때마다 (이번 대화에서 약 5~6회)

### 원인 B. Playwright 스크린샷 시도로 인한 프론트엔드 과부하

Next.js dev 서버는 SSE(Server-Sent Events)로 HMR(Hot Module Reload) 연결을 유지한다.
Playwright는 `page.goto()`에서 `load` 이벤트를 기다리는데, SSE 연결이 끊기지 않으므로 **영원히 load 완료가 안 된다.**

이 상태에서 Playwright가 60초 동안 연결을 물고 있으면서:
- Next.js 워커 프로세스 CPU가 133%까지 치솟음
- 브라우저(Chrome)의 정상 요청까지 응답 불가 상태가 됨
- Playwright 프로세스가 정리 안 되고 백그라운드에 좀비로 남음

**발생 빈도**: 스크린샷 시도 3~4회

### 원인 C. `cd` 경로 오류

```bash
npm run dev  # seo/ 루트에서 실행 → "Missing script: dev" 에러
```

Claude Code가 `cd /Users/vibetj/coding/seo/frontend`를 빠뜨리고 루트에서 실행해서 프론트가 시작 자체를 못 한 경우도 1회 있었다.

## 3. 각 원인별 해결책

### 해결 A. `head` 파이프 대신 `nohup` 사용

```bash
# ❌ 이전 방식 — head가 파이프 닫으면 SIGPIPE로 프로세스 종료
cd backend && npm run dev 2>&1 | head -20

# ✅ 안전한 방식 — nohup + 로그 파일
cd /Users/vibetj/coding/seo/backend && nohup npm run dev > /tmp/seo-backend.log 2>&1 &
cd /Users/vibetj/coding/seo/frontend && nohup npm run dev > /tmp/seo-frontend.log 2>&1 &
```

로그 확인은 별도로:
```bash
tail -20 /tmp/seo-backend.log
tail -20 /tmp/seo-frontend.log
```

### 해결 B. Playwright로 Next.js dev 서버 스크린샷 금지

Next.js dev 서버의 SSE 특성상 Playwright/Puppeteer의 `page.goto()`가 load 이벤트를 영원히 기다린다.

**대안 1 — 빌드 후 `next start`로 프로덕션 서버에서 캡처**
```bash
cd frontend && npm run build && npx next start --port 7011 &
# 프로덕션 서버는 SSE가 없어 Playwright 정상 동작
```

**대안 2 — 브라우저에서 직접 캡처**
Chrome 개발자 도구 → Cmd+Shift+P → "Capture full size screenshot"

**대안 3 — macOS screencapture (데스크톱 세션 필요)**
```bash
screencapture -x /Users/vibetj/coding/seo/callprice_screenshot.png
```

### 해결 C. 절대 경로로 실행

```bash
# 항상 절대 경로 사용
cd /Users/vibetj/coding/seo/backend && npm run dev
cd /Users/vibetj/coding/seo/frontend && npm run dev
```

## 4. 권장 서버 시작 스크립트

아래 내용으로 `seo/start-dev.sh`를 만들어두면 편하다:

```bash
#!/bin/bash
# SEO 프로젝트 dev 서버 시작

DIR="$(cd "$(dirname "$0")" && pwd)"

# 기존 프로세스 정리
lsof -ti :7010 | xargs kill -9 2>/dev/null
lsof -ti :7020 | xargs kill -9 2>/dev/null
sleep 1

# 백엔드
cd "$DIR/backend" && nohup npm run dev > /tmp/seo-backend.log 2>&1 &
echo "Backend starting... (PID: $!)"

# 프론트엔드
cd "$DIR/frontend" && nohup npm run dev > /tmp/seo-frontend.log 2>&1 &
echo "Frontend starting... (PID: $!)"

# 확인
sleep 8
echo ""
echo "=== Server Status ==="
curl -s -o /dev/null -w "Backend  7020: %{http_code}\n" http://localhost:7020/health
curl -s -o /dev/null -w "Frontend 7010: %{http_code}\n" --max-time 10 http://localhost:7010/
```

## 5. 요약

| 원인 | 빈도 | 심각도 | 해결 |
|------|------|--------|------|
| `head -N` 파이프 → SIGPIPE 종료 | 매번 | 높음 | `nohup` + 로그 파일 |
| Playwright → Next.js SSE 충돌 | 스크린샷 시도 시 | 높음 | dev 서버에서 캡처 금지 |
| `cd` 경로 누락 | 1회 | 낮음 | 절대 경로 사용 |

**핵심: Claude Code가 `| head -N`과 Playwright 스크린샷을 사용하면서 서버를 죽인 것이 근본 원인이다. 이 두 가지를 쓰지 않으면 서버가 안정적으로 유지된다.**
