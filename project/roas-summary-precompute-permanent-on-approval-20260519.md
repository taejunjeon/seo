---
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
  required_context_docs:
    - backend/src/bootstrap/startBackgroundJobs.ts
    - backend/src/routes/ads.ts
    - project/leading-indicator-precompute-cache-on-approval-20260519.md
    - project/leading-indicator-precompute-permanent-on-restart-alert-result-20260519.md
  lane:
    approval_document: Green
    controlled_smoke: Yellow
    permanent_on: Red
  allowed_actions:
    - approval document 작성
    - read-only VM Cloud PM2/env/API 상태 확인
    - ChatGPT 5.5 Pro 외부 피드백 요청
    - 승인 후 2시간 controlled smoke window에서 ROAS summary precompute 임시 ON
    - smoke 성공 후 별도 명시 승인으로 상시 ON
  forbidden_actions:
    - TJ님 승인 전 ROAS_SUMMARY_PRECOMPUTE_ENABLED 운영 ON
    - 운영DB write/import
    - VM Cloud SQLite 직접 write
    - 광고 플랫폼 전환 send
    - GTM publish
    - 배포 또는 PM2 restart 실행
    - raw 주문/결제/고객 식별자 출력
  source_window_freshness_confidence:
    source: VM Cloud PM2 env/status + https://att.ainativeos.net/api/ads/roas-summary
    window: biocom, KST 완료일 기준 last_3d/last_7d/last_30d
    freshness: 2026-05-19 17:25 KST read-only 확인
    confidence: B+; API와 env는 직접 확인, 장기 메모리 영향은 smoke 필요
---

작성 시각: 2026-05-19 17:30 KST  
기준일: 2026-05-19  
문서 성격: ROAS summary 상시 사전계산 승인안  
대상 화면/API: `/ads/meta-utm`, `/ads`, `/api/ads/roas-summary`  
대상 site/account: biocom / Meta account `act_...2376`

## 10초 요약

ROAS summary는 화면을 열 때 Meta 광고비와 내부 결제완료 원장을 함께 읽어 계산한다. 그래서 백엔드 재시작 직후 첫 조회가 약 58.7초까지 길어질 수 있다.

추천은 상시 ON을 바로 누르는 것이 아니라, 먼저 2시간 controlled smoke로 켠 뒤 메모리·재시작·API 실패가 없는지 확인하고 상시 ON을 승인하는 방식이다.

TJ님이 승인하면 Codex는 `ROAS_SUMMARY_PRECOMPUTE_ENABLED`를 제한 시간 동안만 켜고, 실패 기준에 걸리면 즉시 OFF로 되돌린다. smoke가 통과하면 두 번째 명시 승인으로 상시 ON을 진행한다.

## 지금 확인된 상태

| 항목 | 확인값 | 의미 |
|---|---|---|
| 현재 ROAS summary 사전계산 | `ROAS_SUMMARY_PRECOMPUTE_ENABLED=0` | 백그라운드 상시 예열은 꺼져 있다. |
| 현재 Meta UTM 진단 사전계산 | `META_UTM_DIAGNOSTICS_PRECOMPUTE_ENABLED=1` / 12분 주기 | `/ads/meta-utm` 진단 데이터는 이미 별도 예열 중이다. |
| 현재 백엔드 상태 | `seo-backend online`, restart 4279, uptime 9분, memory 1.1GB | 직전 배포/재시작 후 정상 기동 상태다. |
| 현재 캐시 조회 속도 | HTTP 200 / 0.347초 | 이미 한 번 계산된 메모리 캐시는 빠르다. |
| 최근 cold generation | `generation_ms=58672` | 재시작 후 첫 live miss는 약 58.7초가 걸린 기록이 있다. |
| 캐시 신선도 | cached_at 2026-05-19 17:18 KST / next_refresh 21:18 KST | 기본 fresh window는 4시간이다. |

주의할 점: API 응답의 `cache.source=in_memory_precompute`는 “메모리 캐시에서 served”라는 뜻이다. 현재 환경변수는 OFF이므로, 이것만으로 백그라운드 사전계산이 이미 켜졌다고 해석하면 안 된다.

## 화면에서 해결하려는 문제

TJ님이 `/ads/meta-utm` 또는 `/ads`에서 ROAS 요약을 볼 때, 백엔드가 막 재시작된 직후면 첫 사용자가 긴 계산을 기다린다.

상시 사전계산을 켜면 백엔드가 사용자 요청 전에 아래 조합을 미리 계산한다.

- 최근 3일: KST 완료일 기준 2026-05-16~2026-05-18 같은 방식
- 최근 7일: KST 완료일 기준 2026-05-12~2026-05-18 같은 방식
- 최근 30일: KST 완료일 기준 2026-04-19~2026-05-18 같은 방식

즉, 사용자 화면은 무거운 live 계산 대신 이미 준비된 캐시를 읽는다. 목표는 재시작 뒤에도 첫 화면 대기 시간을 1초 안팎으로 낮추는 것이다.

## 추천 승인 구조

### 1단계: 2시간 controlled smoke

이 단계는 운영 환경변수를 임시로 켜지만, 시간·대상·조회 조합을 제한한다. Yellow Lane이다.

**Codex가 실제로 바꾸는 설정**

```bash
ROAS_SUMMARY_PRECOMPUTE_ENABLED=1
ROAS_SUMMARY_PRECOMPUTE_INTERVAL_MS=1800000
ROAS_SUMMARY_PRECOMPUTE_START_DELAY_MS=30000
ROAS_SUMMARY_PRECOMPUTE_TIMEOUT_MS=80000
ROAS_SUMMARY_PRECOMPUTE_TARGETS=act_3138805896402376
ROAS_SUMMARY_PRECOMPUTE_PRESET_GROUPS=last_3d,last_7d,last_30d
```

**바꾸면 생기는 효과**

- 백엔드 재시작 30초 뒤 `last_3d,last_7d,last_30d` 묶음을 먼저 계산한다.
- 이후 30분마다 같은 묶음을 다시 계산한다.
- smoke 2시간 동안 최소 4회 tick을 보고 성공/실패를 판단한다.

**안 바꾸면 남는 문제**

- 백엔드가 재시작될 때마다 첫 사용자가 약 58초짜리 live miss를 다시 맞을 수 있다.
- 화면은 기능적으로 맞지만, “결과 조회가 오래 걸리는” 체감 문제가 반복된다.

### 2단계: 상시 ON

이 단계는 운영 flag를 계속 켜 두는 Red Lane이다. smoke 통과 뒤 TJ님이 한 번 더 명시 승인해야 한다.

**추천 상시 설정**

```bash
ROAS_SUMMARY_PRECOMPUTE_ENABLED=1
ROAS_SUMMARY_PRECOMPUTE_INTERVAL_MS=14400000
ROAS_SUMMARY_PRECOMPUTE_START_DELAY_MS=30000
ROAS_SUMMARY_PRECOMPUTE_TIMEOUT_MS=80000
ROAS_SUMMARY_PRECOMPUTE_TARGETS=act_3138805896402376
ROAS_SUMMARY_PRECOMPUTE_PRESET_GROUPS=last_3d,last_7d,last_30d|last_7d
```

상시 설정에서는 4시간 주기로 낮춘다. `last_7d` 단독 그룹을 추가하는 이유는 `/ads`나 다른 화면이 단일 7일 요약을 호출할 때도 cold miss를 줄이기 위해서다.

`today`와 `yesterday`는 이번 상시안에서 제외한다. 현재 화면 문구와 판단 기준이 “KST 완료일 기준, 오늘 제외”로 정리됐기 때문이다. 당일 ROAS를 별도 화면에서 다시 쓰기 시작하면 그때 `today`만 별도 승인안으로 추가하는 편이 안전하다.

## 성공 기준

controlled smoke는 아래 기준을 모두 만족해야 통과로 본다.

1. `/api/health` 또는 동등한 backend health가 HTTP 200이다.
2. `ROAS summary precompute` 로그가 최소 3회 이상 `ok=1 failed=0`으로 찍힌다.
3. `/api/ads/roas-summary?presets=last_3d,last_7d,last_30d` 조회가 캐시 hit 기준 1초 안팎으로 나온다.
4. `seo-backend` restart count가 smoke 시작 이후 증가하지 않는다.
5. `seo-backend` memory가 1.5GB 아래에서 안정적으로 유지된다.
6. Meta API 오류, 502, timeout이 2회 연속 발생하지 않는다.
7. 화면 숫자는 최근 확인 기준과 같은 source/window 체계를 유지한다.

## 즉시 중단 기준

아래 중 하나라도 발생하면 Codex가 smoke를 종료하고 `ROAS_SUMMARY_PRECOMPUTE_ENABLED=0`으로 되돌린다.

1. `seo-backend`가 새로 restart된다.
2. backend memory가 10분 이상 1.5GB를 넘는다.
3. `/api/ads/roas-summary` 또는 `/ads/meta-utm`에서 502/500이 재발한다.
4. precompute tick이 2회 연속 실패한다.
5. event loop delay 또는 응답 시간이 화면 사용을 방해할 정도로 증가한다.
6. Meta API rate limit 또는 timeout 메시지가 반복된다.

## 롤백 절차

smoke 또는 상시 ON 중 문제가 생기면 아래처럼 OFF로 되돌린다.

```bash
export ROAS_SUMMARY_PRECOMPUTE_ENABLED=0
pm2 restart seo-backend --update-env
pm2 save
```

롤백 후 확인할 것:

1. `pm2 env 0`에서 `ROAS_SUMMARY_PRECOMPUTE_ENABLED=0` 확인
2. `pm2 list`에서 `seo-backend online` 확인
3. `/api/ads/roas-summary` HTTP 200 확인
4. `/ads/meta-utm` 화면에서 3일/7일/30일 카드 노출 확인

## 금지선

이 승인안은 계산 캐시를 미리 만드는 작업만 다룬다.

- 운영DB에는 쓰지 않는다.
- VM Cloud SQLite에는 직접 쓰지 않는다.
- Meta, Google, TikTok, GA4에 전환을 전송하지 않는다.
- GTM을 publish하지 않는다.
- raw 주문/결제/고객 식별자를 출력하지 않는다.
- TJ님 승인 전 PM2 restart, env ON, 배포를 하지 않는다.

## 승인 문구

### 1단계 smoke 승인 문구

아래 문구를 그대로 주면 Codex가 2시간 controlled smoke를 실행할 수 있다.

```text
[승인] ROAS summary precompute 2시간 smoke ON 진행.
대상은 biocom act_...2376, presets는 last_3d,last_7d,last_30d만 허용.
중단 기준 발생 시 즉시 OFF 롤백하고 보고.
상시 ON은 smoke 결과 보고 후 별도 승인.
```

### 2단계 상시 ON 승인 문구

smoke 통과 후 아래 문구를 주면 Codex가 상시 ON을 실행할 수 있다.

```text
[상시 승인] ROAS summary precompute 상시 ON 진행.
4시간 주기, targets는 biocom act_...2376, preset groups는 last_3d,last_7d,last_30d 및 last_7d로 제한.
중단 기준 발생 시 즉시 OFF 롤백하고 보고.
```

## Codex 실행 계획

### Smoke 승인 후

1. PM2/env/API 상태를 다시 read-only snapshot으로 남긴다.
2. `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1`과 smoke env를 적용한다.
3. `seo-backend`를 `--update-env`로 재시작한다.
4. 2시간 동안 30분 주기 tick, restart count, memory, API latency를 확인한다.
5. 통과하면 결과 문서를 남기고 상시 승인 여부를 TJ님에게 요청한다.
6. 실패하면 즉시 OFF로 되돌리고 실패 원인을 `기술 실패`, `source_freshness_gap`, `브라우저/CORS`, `데이터 부족`, `접근 권한` 중 하나로 분류한다.

### 상시 승인 후

1. 4시간 주기 env로 변경한다.
2. `seo-backend`를 `--update-env`로 재시작한다.
3. 첫 tick 성공, 캐시 hit, 화면 카드 노출을 확인한다.
4. 24시간 뒤 restart count와 memory를 다시 확인한다.

## Source / Window / Freshness / Confidence

| 항목 | 값 |
|---|---|
| source | VM Cloud PM2 env/status, `/api/ads/roas-summary`, backend source code |
| window | biocom, KST 완료일 기준 last_3d/last_7d/last_30d |
| freshness | 2026-05-19 17:25 KST read-only 확인 |
| confidence | B+; 현재 API/env/code는 직접 확인, 상시 메모리 안정성은 smoke로 확인 필요 |
| data source | Meta Ads Insights API + VM Cloud attribution ledger confirmed 주문 |
| current cache speed | HTTP 200 / 0.347초 |
| cold generation reference | 58.672초 |

## 현재 숫자 기준

2026-05-19 17:25 KST에 read-only로 확인한 값이다. 예산 판단에는 Meta 주장값보다 내부 confirmed ROAS를 우선 본다.

| 기간 | KST 완료일 window | 광고비 | Meta 구매전환값 | Meta ROAS | 내부 confirmed 매출 | 내부 confirmed ROAS | confirmed 주문 |
|---|---|---:|---:|---:|---:|---:|---:|
| 최근 3일 | 2026-05-16~2026-05-18 | ₩10,613,180 | ₩0 | 0.00x | ₩27,308,977 | 2.57x | 74 |
| 최근 7일 | 2026-05-12~2026-05-18 | ₩26,822,355 | ₩22,955,832 | 0.86x | ₩54,938,235 | 2.05x | 160 |
| 최근 30일 | 2026-04-19~2026-05-18 | ₩121,816,881 | ₩347,319,459 | 2.85x | ₩218,291,047 | 1.79x | 695 |

## ChatGPT 5.5 Pro 피드백 상태

요청대로 Chrome에서 ChatGPT를 열어 `5.5 Pro` 모드인지 먼저 확인하려 했다. 현재 Chrome 세션은 `https://chatgpt.com/auth/login` 로그인/회원가입 화면에 머물렀고, 모델 선택 영역까지 접근하지 못했다.

결론: `5.5 Pro` 또는 `Thinking이 아닌 Pro 모드`를 검증하지 못했으므로, 이 문서 본문은 ChatGPT로 전송하지 않았다.

| 항목 | 결과 |
|---|---|
| Chrome ChatGPT 접근 | 로그인/회원가입 화면까지 접근 |
| 5.5 Pro 모델 확인 | 실패 |
| Thinking 모드 아님 확인 | 실패 |
| 승인안 본문 외부 전송 | NO |
| blocker category | `blocked_access` + `verification_gap` |

TJ님이 로그인된 ChatGPT Pro 탭을 Chrome에 열어 둔 뒤 다시 요청하면, Codex는 먼저 모델 표시가 `5.5 Pro` 또는 TJ님이 말한 Pro 모드인지 확인하고 그때만 본문을 붙여 피드백을 받는다.

## Auditor verdict

PASS_WITH_NOTES.

문서 작성, read-only 확인, 승인안 정리는 Green Lane이다. 다만 실제 `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1` 적용은 운영 env flag 변경과 PM2 restart가 필요하므로 Yellow Lane smoke 승인 없이는 실행하지 않는다. 상시 ON은 Red Lane이므로 smoke 결과 이후 TJ님 명시 승인 전에는 실행하지 않는다.
