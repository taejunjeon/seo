# CAPI 클라우드 전환 안전성 검토

기준일: 2026-04-12

## 1. 결론

**CAPI를 VM으로 옮긴 상태에서 로컬 백엔드를 CRM 개발용으로 동시 가동하는 것은 안전하다.** 단, 로컬 `.env`에 CAPI/Attribution sync를 반드시 끄는 설정이 필요했고, 이번에 추가했다.

## 2. 현재 아키텍처

```
┌─────────────────────────┐     ┌──────────────────────────┐
│  GCP VM (34.64.104.94)  │     │   로컬 노트북 (7020)     │
│                         │     │                          │
│  CAPI auto-sync: ON     │     │  CAPI auto-sync: OFF ✓   │
│  Attribution sync: ON   │     │  Attribution sync: OFF ✓  │
│  PM2 + Cloudflare Tunnel│     │  CRM 개발/테스트용        │
│                         │     │                          │
│  att.ainativeos.net ←───┼─────│  localhost:7020           │
│  crm.sqlite3 (운영)     │     │  crm.sqlite3 (로컬)      │
│  meta-capi-sends.jsonl  │     │  별도 JSONL              │
└─────────────────────────┘     └──────────────────────────┘
```

## 3. 위험 분석

### 3-1. CAPI 중복 전송 위험 — 해결됨

| 항목 | 위험 | 현재 상태 |
|------|------|----------|
| 로컬 CAPI sync | VM과 동일 이벤트를 Meta에 이중 전송 | **OFF** (`CAPI_AUTO_SYNC_ENABLED=false`) |
| 로컬 Attribution status sync | VM과 별도로 Toss API 호출 → 데이터 불일치 | **OFF** (`ATTRIBUTION_STATUS_SYNC_ENABLED=false`) |
| 로컬 CWV sync | PageSpeed API 중복 호출 (비용 발생 가능) | ON (별도 우려 낮음) |

### 3-2. Codex 플러그인 피드백 요약

> **Codex 판정: 로컬 `.env`에 명시적 OFF 필수**
>
> `CAPI_AUTO_SYNC_ENABLED` 미설정 시 Zod transform이 `true`로 처리한다. 즉 변수가 없으면 sync가 돈다.
> 로컬과 VM은 별도 파일시스템이라 `meta-capi-sync.lock` 상호 참조 불가 → 중복 전송 가능.
> CRM 기능(그룹, 실험, 알리고 발송)은 CAPI와 테이블이 분리되어 로컬 실행 안전.

### 3-3. 이번에 수행한 조치

로컬 `backend/.env`에 추가:
```
CAPI_AUTO_SYNC_ENABLED=false
ATTRIBUTION_STATUS_SYNC_ENABLED=false
```

재시작 후 `/health` 검증:
```
backgroundJobs.enabled: true
capiAutoSync.enabled: false        ← 확인
attributionStatusSync.enabled: false   ← 확인
cwvAutoSync.enabled: true
```

## 4. 데이터 분리 상태

| 테이블/파일 | VM | 로컬 | 충돌 |
|------------|-----|------|------|
| `attribution_ledger` | 운영 데이터 (실시간) | 배포 시점 스냅샷 (정체) | 없음 (별도 파일) |
| `crm_experiments` / `crm_assignment_log` | 없음 (CRM 미사용) | 로컬 개발 데이터 | 없음 |
| `crm_customer_groups` | 없음 | 로컬 개발 데이터 | 없음 |
| `imweb_members` / `imweb_orders` | 배포 시점 스냅샷 | 로컬 sync 데이터 | 없음 |
| `meta-capi-sends.jsonl` | 운영 로그 (실시간) | 배포 시점까지의 로그 | 없음 (sync OFF) |

## 5. 안전하게 동시 가동 가능한 기능

| 기능 | 로컬 | VM | 비고 |
|------|------|-----|------|
| CRM 재구매 관리 | O | - | 로컬 crm.sqlite3 |
| A/B 실험 생성/관리 | O | - | 로컬 crm.sqlite3 |
| 고객 그룹 관리 | O | - | 로컬 crm.sqlite3 |
| 알리고 알림톡/SMS 발송 | O | - | Aligo API 직접 호출 |
| Meta 광고 성과 조회 | O | O | 읽기 전용 |
| CAPI auto-sync | - | O | **VM 전용** |
| Attribution status sync | - | O | **VM 전용** |
| payment-decision API | - | O | att.ainativeos.net 경유 |

## 6. 주의사항

1. **로컬 백엔드 재시작 시** `/health`에서 `capiAutoSync.enabled: false` 확인 필수
2. **로컬 `.env`에서 CAPI 관련 변수를 절대 삭제하지 말 것** — 미설정 = true (Zod transform 동작)
3. **VM의 `attribution_ledger`가 운영 진실** — 로컬 원장은 점점 뒤처지므로 운영 판단에 사용하면 안 됨
4. **로컬에서 수동으로 `POST /api/meta/capi/send`나 `POST /api/meta/capi/sync`를 호출하면 안 됨** — VM과 중복 가능
5. **향후 CRM 솔루션을 운영에 올릴 때는 VM crm.sqlite3와 로컬 crm.sqlite3를 합치는 마이그레이션 필요**
