# P1-S1 Shadow Run V2

기준일: 2026-03-29

## 10초 결론

이번 턴의 목적은 `P1-S1 shadow run을 더 빠르고 덜 헷갈리게 다시 돌리는 것`이었다.  
결과는 두 가지다. `date pushdown + scan limit`이 들어가면서 local-only shadow run은 `0.1초대`로 매우 가벼워졌고, `message log 최소 포맷`도 실제 import까지 닫혔다.  
다만 운영 read-only source 재측정은 이번 턴에 `source DB connection reset`으로 막혀, 이전 `약 27초` run과의 실측 비교는 아직 다시 못 닫았다.

## 왜 지금 필요한가

기존 shadow run은 동작은 했지만 반복 실행이 무거웠다.

- source order fetch가 `tb_iamweb_users` 전체 rollup 위주였다.
- message log가 `0건`인 validation이 많아 실제 캠페인 그림을 상상하기 어려웠다.
- destructive test 전 DB 확인 절차가 문서로 분리돼 있지 않았다.

즉, 이번 턴은 `실험 엔진을 새로 만드는 것`이 아니라 `다시 돌리기 쉬운 상태로 정리하는 것`이었다.

## 이번 턴에 실제로 바뀐 것

### 1. seed fetch를 더 가볍게 바꿨다

- `assigned_at` 날짜 기준 `date pushdown`
- `scan_limit` 자동 계산
- 빈 결과일 때만 `full scan fallback`

의미:

- 무조건 전체를 읽고 자르는 방식에서 벗어났다.
- 반복 실행 때 최근 구간만 먼저 훑는다.

### 2. message log 최소 포맷을 넣었다

추가 파일:

- `/Users/vibetj/coding/seo/codex/p1s1_message_log_minimal.sample.json`

최소 필수값:

- `customer_key`

runner가 자동으로 채우는 값:

- `variant_key`
- `channel=channeltalk`
- `provider_status=prepared`
- `idempotency_key`

### 3. wrapper를 덜 헷갈리게 정리했다

추가/정리된 환경값:

- `SEED_START_DATE`
- `SCAN_LIMIT`
- `MESSAGE_LOG_FILE`
- `DRY_RUN_ONLY`
- `PRINT_DB_CHECKLIST`

## destructive test 전 DB 확인 절차

1. target shadow DB가 로컬인지 확인한다.
2. 가능하면 docker local Postgres도 한 번 더 확인한다.
3. `ORDER_SOURCE_DATABASE_URL`이 운영 read-only인지 다시 본다.
4. `SHADOW_DATABASE_URL`과 `ORDER_SOURCE_DATABASE_URL`이 같은지, 다른지 의도를 분명히 한다.

실행 예시:

```bash
PRINT_DB_CHECKLIST=1 /Users/vibetj/coding/seo/codex/run_p1s1_shadow_local.sh --dry-run-only
```

## 실행 1. local-only dry-run

조건:

- source DB: local shadow DB
- target DB: local shadow DB
- `dry_run_only=true`

실측:

- seed fetch `0.035초`
- total `0.119초`
- seed customer `1명`
- preview `1건`
- sync preview candidate event `3건`

의미:

- 새 runner가 로컬에서 다시 돌 수 있다는 점은 닫혔다.
- 빠른 smoke 용도로는 충분히 가볍다.

## 실행 2. local-only + message log import

조건:

- source DB: local shadow DB
- target DB: local shadow DB
- message log sample file 사용

실측:

- seed fetch `0.028초`
- total `0.095초`
- message import `1건`
- results 메시지 집계 `prepared 1건`

의미:

- `message log 0건` 상태만 보던 한계를 벗어났다.
- 최소 포맷으로도 runner가 실제 message row를 적재할 수 있다.

## 실행 3. read-only source benchmark

시도:

- `seo/backend/.env`의 `DATABASE_URL`을 source로 읽어 재실행 시도

결과:

- 이번 턴에는 `asyncpg connection reset by peer`로 중단

이게 뜻하는 것:

- 새 runner 로직이 틀렸다는 뜻은 아니다.
- 지금 이 세션에서는 source DB 연결 상태가 닫히지 않아 production-scale 재측정이 막힌 것이다.

## 실행 시간 비교

| 항목 | 이전 기록 | 이번 턴 |
| --- | --- | --- |
| read-only source 전체 fetch | 약 `27초` | 재측정 실패. source DB connection reset |
| local-only seed fetch | 별도 기록 없음 | `0.028 ~ 0.035초` |
| local-only total runtime | 별도 기록 없음 | `0.095 ~ 0.119초` |

중요한 해석:

- 이번 수치는 `실제 uplift`가 아니다.
- `실험 생성 -> 배정 -> message import -> conversion sync` 배선이 다시 닫히는지 보는 plumbing 검증 수치다.

## 실행 절차

### 기본 run

```bash
/Users/vibetj/coding/seo/codex/run_p1s1_shadow_local.sh --dry-run-only
```

### message log sample 포함 run

```bash
MESSAGE_LOG_FILE=/Users/vibetj/coding/seo/codex/p1s1_message_log_minimal.sample.json \
/Users/vibetj/coding/seo/codex/run_p1s1_shadow_local.sh --dry-run-only
```

### read-only source run

```bash
ORDER_SOURCE_DATABASE_URL='운영 read-only URL' \
SHADOW_DATABASE_URL='postgresql+asyncpg://postgres:localdev@localhost:5433/dashboard' \
/Users/vibetj/coding/seo/codex/run_p1s1_shadow_local.sh
```

## 아직 안 닫힌 것

- 운영 read-only source 기준 새 runtime 재측정
- source DB connection reset 원인
- 실제 메시지 발송 provider callback까지 자동화된 그림

## 판단

이번 턴 기준 `P1-S1 shadow run 개선`은 절반이 아니라 꽤 많이 닫혔다.

- 반복 실행 절차는 더 빨라졌다.
- message log 최소 포맷도 실제 import까지 닫혔다.
- 문서와 wrapper도 덜 헷갈리게 정리됐다.

하지만 `운영 read-only source 실측 재검증`은 이번 턴에 못 닫았다.  
이 부분은 코드 미완성이 아니라 `source DB 연결 상태` 문제로 기록하는 것이 맞다.
