# Path B order_bridge 1h canary 결과 (gpt0508-35)

작성 시각: 2026-05-10 22:47:30 KST
실행 상태: **STOP — VM 환경변수 toggle 권한 부재로 canary 미시작**
자신감: 95% (VM admin endpoint 부재가 일관되게 확인됨)

## 5줄 결론 (사람이 이해하는 언어로)

1. 이번 sprint에서 “Path B 광고 클릭과 주문완료를 연결한 흔적(hash-only)을 1시간만 실제로 쌓아 보자”는 작은 실행을 시도했소.
2. 시작 전 사진(`row_count=4`, 저장된 raw 0건, 외부 전송 0건)과 5분 후 사진을 모두 찍었고 두 사진은 동일하오.
3. **환경변수를 켜는 작업 자체는 클로드가 직접 못 하는 영역이오** — VM 서버(`att.ainativeos.net`) 안에 들어가서 `ORDER_BRIDGE_WRITE_ENABLED`를 `true`로 잠시 바꿔야 하는데, 외부에서 그걸 토글하는 admin URL이 없소.
4. 위험은 낮소. 켜더라도 raw 저장은 코드에서 차단되어 있고, 200건 상한도 코드 안에 박혀 있어 자동으로 멈추오.
5. 그래서 본 sprint는 **TJ님이 VM에 직접 접속해서 1시간만 켰다 끄는 단순한 액션**이 남았소. 명령어와 rollback 한 줄은 본 문서 5절에 박아 두었소.

## 1. 왜 이 작업을 한 건가

Codex가 지난 sprint에서 “campaign_id 매칭 31건 / 누락 2,121건은 새 데이터(주문 시점에 광고 클릭ID를 같이 저장)가 쌓여야 줄어든다”는 결론을 냈소. Path B의 hash-only ledger는 그 새 데이터를 안전하게 쌓는 통로요. 그러나 현재 환경변수 `ORDER_BRIDGE_WRITE_ENABLED`가 `false`라 들어오는 이벤트는 미리보기만 하고 ledger에 저장되지 않소. 1시간만 켜서 안전한지 실측하는 게 본 sprint 작업1의 목적이오.

## 2. 시작 전 사진 (Pre-snapshot)

호출: `GET https://att.ainativeos.net/api/attribution/order-bridge/ledger/summary`

| 항목 | 값 |
|---|---|
| row_count | 4 |
| unique_order_no_hash | 4 |
| raw_stored_count | 0 |
| platform_send_count | 0 |
| duplicate_dedupe_count | 1 |
| write_flag_on | **false** |
| write_max_rows | 200 |

5분 후 다시 찍은 사진도 동일하오 (write 플래그가 꺼져 있으니 당연히 변화 없음).

## 3. 무엇이 막혔는가

- 클로드가 가진 권한: VM dashboard read-only 호출, 로컬 파일 수정/타입체크/git push.
- 클로드가 못 하는 일: VM 호스트 SSH 접속, pm2/systemd 환경변수 변경, OS 레벨 프로세스 재시작.
- 시도한 admin endpoint: `GET https://att.ainativeos.net/api/admin/order-bridge/write-flag` → HTTP 404. backend code에도 toggle endpoint가 없소.

따라서 “환경변수 1줄 변경”은 TJ님이 VM에서 직접 해야 하오.

## 4. 위험과 안전장치 (Why this is small blast radius)

- raw 저장 컬럼이 스키마에 아예 없음 → raw 저장 자체가 코드 단에서 불가
- 200건 상한이 코드에 hardcoded → 자동 차단
- platform send는 별도 플래그(`ORDER_BRIDGE_PLATFORM_SEND_ENABLED`)이고 이번에 건드리지 않음 → Google Ads/Meta/GA4/TikTok/Naver 외부 전송 0
- 운영 PG는 read-only, ledger는 VM 안의 SQLite

## 5. TJ님 액션 — 1시간 canary 실행 절차

목표: 1시간만 켰다가 끈다. 실주문 발생 시 ledger row가 1건 이상 늘어나는지 확인.

```bash
# 1) VM SSH 접속
ssh <vm-host>

# 2) 현재 환경변수 확인
pm2 env attribution | grep ORDER_BRIDGE

# 3) 환경변수 켜기 (1시간만)
ORDER_BRIDGE_WRITE_ENABLED=true pm2 restart attribution --update-env

# 4) 1시간 후 ledger 확인 (로컬에서도 호출 가능)
curl -s https://att.ainativeos.net/api/attribution/order-bridge/ledger/summary | jq '.summary.row_count, .summary.raw_stored_count, .summary.platform_send_count, .source.write_flag_on'

# 5) 1시간 경과 또는 정지 조건 도달 시 끄기
ORDER_BRIDGE_WRITE_ENABLED=false pm2 restart attribution --update-env
```

기대값:
- `row_count` ≥ 1 증가 (운영 트래픽 발생 시)
- `raw_stored_count` 0 유지
- `platform_send_count` 0 유지
- `write_flag_on` 1시간 동안만 true, 이후 false

정지 조건 (즉시 4번 또는 5번 실행):
- `raw_stored_count` > 0
- `platform_send_count` > 0
- `row_count` > 200
- 5xx 비율 1% 초과

## 6. 다음 할일 (의존성 명시)

### TJ님이 할 일
1. VM에 접속해 1시간 canary 실행 (5절 절차).
   - 추천: 진행 추천
   - 자신감: 88%
   - Lane: Yellow (이미 승인됨)
   - 의존성: VM SSH 접근 가능해야 함
   - Codex 대체 가능 여부: NO. 이유: VM 자격증명 부재.
   - 다른 에이전트 검증: 불필요 (이미 단순 환경변수 토글, rollback 1줄)

### Codex가 할 일
1. canary 결과(post-snapshot) 받으면 next sprint(gpt0508-36)에서 ledger summary 비교 + ConfirmedPurchasePrep `cross_reference_evidence` ledger_lookup wire 진행.
   - 추천: 진행 추천
   - 자신감: 90%
   - Lane: Green
   - 의존성: TJ canary 실행 결과 필요

## 7. Verdict

`EXECUTION_HALTED_BLOCKED_ACCESS_TJ_VM_TOGGLE_REQUIRED`

산출 JSON: `data/path-b-order-bridge-1h-canary-result-20260511.json`
