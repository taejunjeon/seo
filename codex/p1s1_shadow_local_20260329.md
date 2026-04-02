# P1-S1 Local Shadow Run

기준일: 2026-03-29

## 목적

- 운영 DB schema 반영 없이 `P1-S1`을 다시 실행 가능한지 확인
- `운영 read-only source -> local shadow target` 구조가 실제로 동작하는지 검증
- 실험 결과를 비밀값 없이 남기기

## 실행 도구

- 재실행 래퍼: `/Users/vibetj/coding/seo/codex/run_p1s1_shadow_local.sh`
- 원본 runner: `/Users/vibetj/coding/revenue/backend/scripts/run_crm_phase1_shadow.py`
- 원본 테스트: `/Users/vibetj/coding/revenue/backend/test_crm_phase1_shadow.py`

## 실행 1. local-only smoke

설정:

- target shadow DB: local Postgres `dashboard`
- source DB: local Postgres `dashboard`
- experiment key: `temp-shadow-20260329-b`

결과:

- local source snapshot은 `tb_iamweb_users` 2행, 고객 1명뿐이라 seed customer는 `1명`
- assignment `1건`
- variant `control 1`
- purchase `2건`
- refund `1건`
- net revenue `17만원`

의미:

- shadow runner 자체는 지금도 로컬에서 재실행 가능
- local target DB에 assignment/conversion row가 실제로 저장되는 것까지 확인

## 실행 2. read-only source -> local shadow target

설정:

- target shadow DB: local Postgres `dashboard`
- source DB: `seo/backend/.env`의 운영 read-only `DATABASE_URL`
- experiment key: `temp-shadow-20260329-readonly`
- assigned_at: `2026-03-01T00:00:00+00:00`
- limit: `120`

결과:

- seed customer `120명`
- assignment `120건`
- variant 분포
  - `control 59`
  - `holdout 10`
  - `treatment 51`
- matched order `130건`
- candidate purchase event `11건`
- live inserted conversion `11건`
- variant summary
  - `control`: assignment `59`, purchaser `3`, revenue `354,431원`
  - `holdout`: assignment `10`, purchaser `0`, revenue `0원`
  - `treatment`: assignment `51`, purchaser `6`, revenue `983,390원`

## 검증

- local shadow target table 확인
  - `crm_experiments`
  - `crm_assignment_log`
  - `crm_message_log`
  - `crm_conversion_log`
- `crm_assignment_log`에서 `temp-shadow-20260329-readonly = 120건`
- `crm_conversion_log`에서 `temp-shadow-20260329-readonly purchase = 11건`
- `pytest -q test_crm_phase1_shadow.py -q` 통과

## 주의

- `test_crm_phase1_shadow.py`는 shadow 테이블을 drop/recreate 하므로, 실험 결과를 남겨야 하는 run 뒤에는 바로 돌리면 안 된다.
- 현재 source order fetch는 `tb_iamweb_users` 전체 rollup을 읽고 그 뒤 seed를 자른다. 그래서 read-only source 실험은 이번 실행에서 약 `27초`가 걸렸다.
- 즉 운영 반영 전에도 인사이트는 얻을 수 있지만, 반복 실행을 위해서는 `date pushdown` 또는 `seed source table` 최적화가 다음 개선 포인트다.

## 판단

- `P1-S1`은 운영 DB schema가 없어도 `우리 둘이` 계속 검증하고 인사이트를 얻을 수 있다.
- 지금 막힌 것은 실험 엔진 자체가 아니라 `운영 cutover`와 `반복 실행 최적화`다.
- 다만 이번 run은 `메시지 발송 0건` 상태의 shadow validation이다.
- 따라서 `treatment > control` 같은 숫자는 실제 uplift가 아니라, `assignment / order join / conversion sync` 파이프가 정상 동작하는지 보는 plumbing 검증 수치로만 해석해야 한다.
