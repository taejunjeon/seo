# GCE VM 임시 운영 전환 계획 - 2026-04-11

## 바로 결론

지금은 VM 배포를 바로 실행하기보다 **계획과 컷오버 절차만 확정하고, 먼저 CAPI Purchase 정합성 작업을 마무리하는 순서**가 맞다.

이유는 단순하다. 현재 Meta ROAS 차이의 핵심 후보가 아직 정리 중이다.

- 가상계좌 미입금 주문에서도 Browser Pixel `Purchase`가 발화하는 문제.
- Browser Purchase와 Server CAPI Purchase의 `event_id` dedup 검증.
- CAPI payload의 `order_id`, `content_ids`, `contents`, `event_source_url` 일관성.
- 결제완료 식별자 품질과 pending/confirmed 구분.

이 상태에서 노트북 백엔드와 VM 백엔드가 동시에 돌면 결제상태 sync, CAPI auto-sync, 로그 적재가 중복될 수 있다. 그러면 “Meta가 과대 집계하는 이유”를 더 보기 어려워진다.

따라서 순서는 다음이 맞다.

1. CAPI Purchase 기준을 먼저 마무리한다.
2. VM 전환 계획과 체크리스트를 고정한다.
3. 노트북 origin에서 VM origin으로 한 번에 컷오버한다.
4. 컷오버 후 24시간 동안 중복 전송과 누락을 모니터링한다.

## VM으로 옮기는 목적

목적은 서버 구조 개편이 아니라 **노트북 origin 의존 제거**다.

현재 `att.ainativeos.net`은 Cloudflare 앞단을 타고 있지만, origin은 TJ님 노트북의 `localhost:7020` 백엔드에 의존하는 상태로 보인다. 노트북이 잠자기, 재부팅, 네트워크 끊김, 프로세스 종료 상태가 되면 아래 기능이 같이 흔들린다.

- 결제완료 페이지에서 보내는 `payment-success` 원장 적재.
- checkout-context 식별자 적재.
- Attribution 결제상태 sync.
- Meta CAPI auto-sync.
- CAPI 전송 로그 적재.
- ROAS/광고 대시보드 API.

VM 전환의 목표는 이 기능들을 노트북이 아니라 항상 켜져 있는 GCE VM에서 돌리는 것이다.

## 배포 범위

배포 단위는 **backend 전체**다.

다만 1차 운영 목적은 **Attribution/CAPI 안정화**로 제한한다.

1차 필수 운영 범위:

- `/health`
- `/api/attribution/checkout-context`
- `/api/attribution/payment-success`
- `/api/attribution/*` 중 결제상태 sync, caller coverage, 원장 확인 API
- `/api/meta/capi/*`
- `/api/ads/*`, `/api/meta/*` 중 Meta ROAS와 내부 Attribution ROAS 대조에 필요한 API

같이 배포되지만 1차 운영 범위는 아닌 것:

- CRM 발송 솔루션 API
- 알림톡/채널톡 발송 API
- 상담/가격/쿠폰 분석 API
- 기타 관리자 대시보드 보조 API

이 기능들은 같은 Express 서버에 있으므로 코드상 같이 올라간다. 하지만 CRM 발송류 endpoint는 오발송 리스크가 있으므로, VM 전환 1차 목적에 포함하지 않는다. 필요하면 Cloudflare Access, IP 제한, Basic Auth, VPN 중 하나로 관리자 API를 보호해야 한다.

## 왜 CAPI만 따로 떼지 않는가

CAPI는 단독 기능이 아니다. 현재 CAPI 전송은 아래 흐름과 연결되어 있다.

1. 결제완료 페이지에서 checkout/order/payment 식별자 수집.
2. Attribution 원장에 pending/confirmed 상태 저장.
3. Toss/운영 DB 기준으로 결제상태 확인.
4. confirmed 주문을 Meta CAPI로 전송.
5. CAPI 전송 결과를 JSONL 로그에 저장.
6. ROAS 대시보드에서 내부 Attribution과 Meta 수치를 비교.

따라서 CAPI 코드만 분리하면 원장, 로그, 결제상태, dedup 검증 흐름을 다시 이어야 한다. 지금은 데이터 정합성이 더 중요하므로, 백엔드 전체를 올리고 운영 사용 범위만 제한하는 것이 더 안전하다.

## 인프라 선택

## 1차: GCE VM + Cloudflare 앞단

현재 단계의 추천안이다.

구성:

- Google Compute Engine VM 1대.
- Node.js LTS.
- `pm2` 또는 `systemd`로 `backend/dist/server.js` 상시 실행.
- `backend/data/crm.sqlite3`와 `backend/logs`는 VM persistent disk에 보관.
- `att.ainativeos.net`은 Cloudflare Tunnel 또는 Cloudflare DNS/Proxy로 VM 백엔드에 연결.

Cloudflare Tunnel은 필수는 아니지만 좋은 선택지다. 공개 IP를 직접 열지 않고 VM 내부의 `localhost:7020`을 Cloudflare로 연결할 수 있다. 반대로 VM 공인 IP + Cloudflare DNS/Proxy + 방화벽 제한으로도 가능하다.

## 2차: Cloud Run + Postgres + Cloud Scheduler

개발팀 인계용 정식 구조다. 지금 바로 가기에는 선행 작업이 필요하다.

Cloud Run을 미루는 핵심 이유는 CPU 자체보다 **상태 저장과 스케줄러 구조**다.

- 현재 `crm.sqlite3`는 로컬 파일이다.
- 현재 CAPI 로그는 JSONL 로컬 파일이다.
- 현재 15분/30분 작업은 서버 내부 `setInterval`이다.
- Cloud Run에서 여러 인스턴스가 뜨면 같은 sync가 중복 실행될 수 있다.

Cloud Run으로 가려면 먼저 다음을 정리해야 한다.

- SQLite 원장을 Postgres 계열로 이전.
- JSONL 로그를 Postgres, Cloud Logging, BigQuery, Cloud Storage 중 하나로 이전.
- `setInterval`을 Cloud Scheduler 호출 방식으로 전환.
- 중복 실행 방지용 DB lock 또는 idempotency key를 적용.

## 3차: Cloudflare Workers

현재는 보류한다.

Workers는 Node.js API와 `fs` 가상 파일 시스템을 일부 지원하지만, 지금 필요한 것은 지속 저장소와 안정적인 백그라운드 동기화다. 현재 구조의 SQLite, JSONL 로그, 장기 보존 원장, CAPI 스케줄러를 그대로 옮기기엔 맞지 않는다.

Workers로 가려면 D1, R2, Queues, Cron Triggers 중심으로 재설계해야 하므로, 현재 CAPI/ROAS 정합성 작업보다 우선순위가 낮다.

## VM 서버 구성 초안

권장 VM:

- OS: Ubuntu LTS.
- Machine type: 소형 VM부터 시작. e2-micro 또는 e2-small.
- Disk: persistent disk 20-30GB 이상. 로그 증가를 고려하면 30GB 권장.
- Region: 한국 사용자/외부 API latency를 고려해 `asia-northeast3` 또는 관리 편의상 기존 GCP 프로젝트 기준.
- 방화벽: SSH와 Cloudflare 연결에 필요한 포트만 허용.
- Node: LTS 버전.
- Process manager: `pm2` 또는 `systemd`.

서버 디렉터리 예시:

```text
/opt/seo
  /repo
  /shared
    /backend-data/crm.sqlite3
    /backend-logs/
    /env/backend.env
    /secrets/
```

가능하면 코드와 영속 데이터를 분리한다.

- 코드는 `/opt/seo/repo`.
- SQLite와 로그는 `/opt/seo/shared`.
- `.env`와 service account JSON은 `/opt/seo/shared/env`, `/opt/seo/shared/secrets`.

현재 코드가 `backend/data/crm.sqlite3`, `backend/logs`를 기본 경로로 사용하므로, 1차에서는 symlink를 쓸 수 있다.

```bash
backend/data -> /opt/seo/shared/backend-data
backend/logs -> /opt/seo/shared/backend-logs
```

장기적으로는 env로 DB/log 경로를 지정할 수 있게 코드화하는 것이 더 좋다.

## 배포 전 준비물

서버/계정:

- 사용할 GCP 프로젝트 ID.
- VM 생성 권한.
- SSH 접속 방식.
- Cloudflare Tunnel을 쓸지, DNS/Proxy를 쓸지 결정.
- `att.ainativeos.net` DNS/Tunnel 변경 권한.

파일/시크릿:

- `backend/.env`의 운영값.
- Google service account JSON 또는 Secret Manager 연결 방식.
- 현재 `backend/data/crm.sqlite3`.
- 현재 `backend/logs/*.jsonl`.
- Cloudflare Tunnel token. 문서에는 원문 기록 금지.

검증 URL:

- `http://localhost:7020/health`
- `https://att.ainativeos.net/health`
- `/api/attribution/caller-coverage`
- `/api/meta/capi/log`
- `/api/ads/site-summary`

## 컷오버 원칙

가장 중요한 원칙은 **노트북 백엔드와 VM 백엔드가 동시에 auto-sync를 돌지 않게 하는 것**이다.

동시에 돌면 위험한 작업:

- Attribution payment-status sync.
- CAPI auto-sync.
- 같은 주문에 대한 CAPI 재전송.
- CAPI 로그 중복 적재.
- pending/confirmed 상태 갱신 순서 꼬임.

컷오버 순서:

1. VM에 코드와 데이터 복사.
2. VM에서 `.env` 설정.
3. VM에서 빌드.
4. VM backend를 임시 포트 또는 내부 `localhost:7020`으로 실행.
5. VM 내부에서 `/health` 확인.
6. VM에서 외부 API 설정 상태 확인.
7. VM auto-sync가 돌기 전에 노트북 백엔드 auto-sync 중지 시점 확정.
8. Cloudflare Tunnel/DNS를 VM으로 전환.
9. 외부에서 `https://att.ainativeos.net/health` 확인.
10. 결제완료 테스트 1건으로 `payment-success` 적재 확인.
11. VM CAPI 로그 확인.
12. 노트북 백엔드 프로세스 종료 또는 auto-sync 비활성화.
13. 첫 24시간 동안 CAPI 로그 중복/누락 모니터링.

실행 전에는 “노트북 종료”가 아니라 “노트북 백엔드 프로세스 종료”를 명확히 확인해야 한다.

확인 명령 예시:

```bash
lsof -i :7020
ps aux | grep 'tsx watch src/server.ts'
ps aux | grep cloudflared
```

## 배포 절차 초안

아직 실행하지 않는다. CAPI Purchase 작업 마무리 후 실행한다.

1. VM 생성.
2. VM 접속.
3. Node.js LTS 설치.
4. Git/npm/pm2 설치.
5. repo clone 또는 rsync.
6. 서버에 `.env` 배치.
7. `crm.sqlite3`, `logs` 복사.
8. symlink 또는 경로 확인.
9. `cd backend && npm ci`.
10. `npm run typecheck`.
11. `npm run build`.
12. `pm2 start dist/server.js --name seo-backend`.
13. `curl http://localhost:7020/health`.
14. Cloudflare 연결.
15. `curl https://att.ainativeos.net/health`.
16. 테스트 주문 1건 적재 확인.
17. 노트북 백엔드 종료.
18. 24시간 모니터링.

## 배포 후 모니터링

첫 24시간은 아래를 본다.

- `payment-success`가 누락 없이 들어오는지.
- pending 주문과 confirmed 주문이 정상 구분되는지.
- 가상계좌 미입금 주문이 Server CAPI Purchase로 전송되지 않는지.
- 같은 주문이 CAPI로 2회 이상 전송되지 않는지.
- Browser Purchase와 Server Purchase의 중복 여부.
- `/api/meta/capi/log`에서 4xx/5xx가 없는지.
- VM 로그와 기존 로컬 로그가 갈라지지 않는지.

모니터링 기준:

- 같은 `orderId + eventName`의 운영 성공 전송이 반복되면 중복 의심.
- 같은 `event_id`가 반복되면 retry-like 중복 가능성.
- 서로 다른 `event_id`로 같은 주문 Purchase가 여러 번 나가면 Meta 중복 집계 위험.
- pending 주문이 Browser Purchase만 있고 Server CAPI Purchase가 없으면 현재 내부 기준은 맞지만, Meta Pixel 기준 과대 가능성은 계속 남는다.

## 지금 당장 하지 않을 것

- Cloud Run 정식 이관.
- Workers 재작성.
- 백엔드 Next.js 통합.
- CRM 발송 자동화 확대.
- 운영 DB 스키마 변경.
- CAPI만 별도 서버로 분리.

이 작업들은 CAPI Purchase 기준과 dedup 검증이 끝난 뒤 판단한다.

## CAPI 작업 이후 VM 전환 전 체크리스트

VM 전환 전에 아래가 최소한 정리되어야 한다.

- 가상계좌 미입금 주문에서 Browser Pixel Purchase를 계속 허용할지, confirmed 시점으로 늦출지 결정.
- Server CAPI는 confirmed 주문만 보낸다는 원칙 확인.
- Test Events에서 Browser Purchase와 Server Purchase의 `event_id` dedup 확인.
- Server CAPI payload에 `order_id`, `event_source_url`, `content_ids`, `contents`, `value`, `currency`가 안정적으로 들어가는지 확인.
- CAPI auto-sync가 같은 주문을 서로 다른 `event_id`로 재전송하지 않는지 확인.
- 노트북 백엔드 종료 절차 확정.
- VM 배포 후 24시간 모니터링 담당자/확인 항목 확정.

## 개발팀 인계 메모

개발팀에는 이렇게 설명하면 된다.

현재 서버 이전은 구조 개편이 아니라 노트북 origin 제거 목적이다. 백엔드는 Express 그대로 VM에 올리고, Cloudflare 앞단은 유지한다. 단, 서버 안에 CRM/알림톡/상담/쿠폰 API도 같이 있으므로 1차 운영 범위는 Attribution/CAPI로 제한한다. Cloud Run은 장기적으로 더 좋지만, 현재 SQLite/JSONL/인프로세스 스케줄러 구조를 먼저 Postgres/Cloud Logging/Cloud Scheduler로 바꿔야 한다. 컷오버 시 노트북과 VM이 동시에 CAPI auto-sync를 돌면 중복 전송 위험이 있으므로 단일 origin 원칙을 지켜야 한다.

## 참고

- 기존 계획: `capivm/plan0411.md`
- 보강 검토: `capivm/plan0411-2.md`
- CAPI/ROAS 단계 문서: `data/roasphase.md`
- Meta 이벤트 품질 보고: `meta/metareport.md`
