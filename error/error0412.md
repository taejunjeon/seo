# ERR_CONNECTION_REFUSED 에러 분석

발생일: 2026-04-12

## 1. 증상

프론트엔드(`localhost:7010`)에서 모든 백엔드 API 호출이 실패:
```
:7020/api/crm-phase1/ops  Failed to load resource: net::ERR_CONNECTION_REFUSED
:7020/api/crm-local/experiments?meta=true  Failed to load resource: net::ERR_CONNECTION_REFUSED
:7020/api/crm-local/repurchase-candidates  Failed to load resource: net::ERR_CONNECTION_REFUSED
(... 총 10개 이상 엔드포인트 동일 증상)
```

추가로 브라우저 확장 프로그램 관련 에러:
```
inpage.js:249 Uncaught (in promise) Error: Origin not allowed
```
→ 이것은 MetaMask 등 브라우저 확장 프로그램 에러로, 우리 코드와 무관.

## 2. 원인

**백엔드 서버(`localhost:7020`)가 꺼져 있었다.**

- 프론트엔드(`localhost:7010`)는 정상 동작 중
- 백엔드(`localhost:7020`)에 프로세스 없음 확인 (`lsof -i :7020` 결과 비어 있음)
- 이전 세션에서 테스트용으로 실행한 백엔드가 종료된 후 재시작되지 않았음

백엔드는 `npx tsx src/server.ts`로 수동 실행하는 구조이므로, 터미널 세션이 끊기거나 시스템 재시작 시 자동 복구되지 않는다.

## 3. 해결

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx src/server.ts
```

실행 후 `curl http://localhost:7020/health` → `{"status":"ok"}` 확인.

## 4. 재발 방지

| 방법 | 설명 | 난이도 |
|------|------|--------|
| `pm2` 사용 | `pm2 start "npx tsx src/server.ts" --name seo-backend` → 크래시 시 자동 재시작 | 낮음 |
| `package.json` 스크립트 | `npm run dev`로 프론트+백 동시 실행 (concurrently) | 중간 |
| systemd/launchd | macOS LaunchAgent로 로그인 시 자동 시작 | 중간 |
| Docker Compose | 프론트+백 컨테이너화 | 높음 |

## 5. `inpage.js: Origin not allowed` 에러

이것은 **MetaMask 또는 유사 브라우저 확장 프로그램**에서 발생하는 에러다. `localhost:7010`이 해당 확장의 허용 Origin에 포함되지 않아서 발생한다. 우리 코드와 무관하며 무시해도 된다.
