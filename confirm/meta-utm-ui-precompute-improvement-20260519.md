작성 시각: 2026-05-19 10:13 KST
기준일: 2026-05-19
문서 성격: Meta UTM 진단 프론트엔드 개선 및 사전계산 로컬 검증 보고

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - frontrule.md
  required_context_docs:
    - AGENTS.md
    - CLAUDE.md
  lane: Yellow
  allowed_actions:
    - 로컬 코드 수정
    - 로컬 API smoke
    - 로컬 프론트엔드 캡처
    - 사전계산 캐시 구현
    - 커밋
  forbidden_actions:
    - TJ님 승인 없는 운영 배포
    - 운영DB write
    - 외부 광고 플랫폼 전송
  source_window_freshness_confidence:
    source: Meta Ads Insights API + VM Cloud attribution ledger + 로컬 런타임 캐시
    window: 2026-05-12~2026-05-18 KST
    site: biocom
    freshness: 로컬 검증 기준 2026-05-19 10:09 KST 캐시
    confidence: B
```

## 10초 요약

Meta UTM 진단 화면은 기능은 맞지만, child component에 CSS가 적용되지 않아 표와 섹션 제목이 깨져 보였다. 초기 프론트엔드 점수는 52/100으로 판단했다.

이번 수정으로 화면 구조는 로컬 기준 84/100까지 올렸다. API 첫 live miss는 여전히 Meta API 호출 자체가 35~42초 걸릴 수 있지만, 백엔드가 12분마다 사전계산하고 성공 결과를 런타임 디스크 캐시에 저장하므로 사용자 조회는 8.6ms 수준의 cache hit로 전환된다.

운영 반영은 아직 하지 않았다. TJ님 확인 후 배포하면 된다.

## 점수

- 개선 전: 52/100
- 개선 후 로컬 검증: 84/100
- 남은 감점: Meta Ads Manager와 완전 동일한 밀도는 아니며, Meta API rate limit 상태에서 첫 성공 캐시가 전혀 없으면 live 오류가 먼저 보일 수 있다.

## 완료한 것

- 프론트엔드 스타일 범위를 `.metaUtmPage` global scope로 보강했다.
- Section A/B 제목, 요약 chip, 테이블, 썸네일, 게재 상태 pill, 숫자 열 폭을 다시 맞췄다.
- 상단 판단 banner를 추가해 Section B 지출 비중과 cache 상태를 바로 보이게 했다.
- `/api/ads/meta-utm-diagnostics` 성공 결과를 메모리 캐시뿐 아니라 `backend/data/runtime-cache/meta-utm-diagnostics-cache.json`에도 저장하도록 했다.
- 백엔드 background job에 Meta UTM precompute worker를 추가했다. 기본 target은 `act_3138805896402376`, preset은 `last_7d`, 주기는 12분이다.

## 검증 결과

- 로컬 backend typecheck: PASS
- 로컬 backend build: PASS
- 로컬 frontend build: PASS
- 로컬 frontend lint: PASS, 기존 썸네일 `<img>` 경고 1건만 있음
- harness preflight strict: PASS
- git diff whitespace check: PASS
- precompute 첫 live 계산: 42.1초, 성공 rows 134
- precompute 직후 cache hit: 4.6ms
- 재시작 직후 disk cache hit: 8.6ms, rows 134

## 화면 캡처

- 실제 행 데이터 포함 개선 화면: `confirm/meta-utm-ui-precompute-improved-rows-20260519.png`
- rate limit 상태 빈 화면 방어 확인용 캡처: `confirm/meta-utm-ui-precompute-improved-20260519.png`

## 하지 않은 것

- 운영 배포는 하지 않았다. TJ님 승인 필요.
- 운영DB write는 하지 않았다.
- Meta/Google/TikTok 같은 외부 광고 플랫폼 전송은 하지 않았다.
- GTM publish는 하지 않았다.

## 다음 할일

### TJ님이 할 일

1. 배포 승인 여부 결정
- 무엇을 확인하나: `/ads/meta-utm` 개선 화면과 사전계산 캐시 적용을 운영에 반영할지 확인한다.
- 왜 필요한가: 운영 frontend/backend/PM2 restart가 포함되는 Yellow Lane 작업이기 때문이다.
- 성공 기준: 운영 페이지에서 Section A/B가 겹치지 않고, API cache source가 `disk_cache_hit`, `lazy_cache_hit`, 또는 사전계산 후 cache hit로 보인다.
- 실패 시 확인점: Meta API rate limit이 계속이면 첫 성공 precompute까지 기다리거나 캐시 파일 생성 여부를 본다.
- Codex가 대신 못 하는 이유: 운영 배포 승인은 TJ님 권한의 의사결정이다.
- 추천 점수/자신감: 88%

### Codex가 할 일

1. 승인 후 운영 배포 및 smoke
- 무엇을 하는가: backend/frontend 빌드 산출물을 VM Cloud에 배포하고 PM2 restart 후 API와 화면을 확인한다.
- 왜 필요한가: 로컬 개선을 실제 `https://biocom.ainativeos.net/ads/meta-utm`에 반영하기 위해서다.
- 어떻게 하는가: 기존 배포 절차로 frontend/backend를 반영하고, `/api/ads/meta-utm-diagnostics` cache source와 응답 시간을 확인한다.
- 성공 기준: frontend 200, API 200, 재시작 후 precompute log 정상, 사용자 조회 cache hit 1초 이내.
- 승인 필요 여부: YES, 운영 배포 포함.
- 추천 점수/자신감: 88%

## 운영 배포 결과 — 2026-05-19 10:52 KST

TJ님 승인 후 운영 배포를 완료했다. 배포 대상은 Meta UTM 진단 화면과 `/api/ads/meta-utm-diagnostics` 사전계산·런타임 캐시 코드다.

### 배포 후 확인

- 운영 backend health: 200, 0.20~0.32초
- 운영 frontend `/ads/meta-utm`: 200, 0.29~0.48초
- 운영 CORS: `Access-Control-Allow-Origin: https://biocom.ainativeos.net` 확인
- PM2 최종 상태: `seo-backend` online restart 4277, `seo-frontend` online restart 56, `seo-cloudflared` online restart 1
- Meta UTM precompute env: ON, 12분 주기
- unrelated leading indicators precompute env: OFF로 정리

### 현재 API 상태

Meta API 계정 호출 제한 때문에 아직 첫 성공 캐시가 없다.

- API status: 200 degraded
- cache source: `live_error_no_cache`
- 원인: Meta Ads API rate limit
- 해석: 광고 데이터가 없다는 뜻이 아니라, Meta가 새 조회를 제한 중이라는 뜻이다.

### 프론트엔드 직관성 점수

- 데이터가 정상 표시되는 상태 기준: 84/100
- 현재처럼 Meta rate limit으로 표가 비어 있는 운영 상태 기준: 78/100

좋아진 점은 화면이 깨지지 않고, 이제 “데이터 없음”이 아니라 “Meta API 제한으로 기다리는 중”이라고 설명한다는 점이다. 감점 이유는 첫 성공 캐시가 없을 때 여전히 지표 카드가 `0`으로 보이므로, 사용자가 숫자를 실제 0으로 오해할 여지가 남아 있기 때문이다.

### 운영 화면 캡처

- `confirm/meta-utm-deployed-intuitiveness-final-20260519.png`
