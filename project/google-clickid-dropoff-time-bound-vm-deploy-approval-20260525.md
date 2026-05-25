# Google click id 유실 지점 API 시간 비교 보정 배포 승인안

작성 시각: 2026-05-25 23:24 KST
기준일: 2026-05-25
문서 성격: VM Cloud backend 배포 승인안

```yaml
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  required_context_docs:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - data/!data_inventory.md
  lane: "Yellow"
  allowed_actions:
    - backend build
    - VM Cloud backend route deploy
    - pm2 restart seo-backend
    - read-only API smoke
  forbidden_actions:
    - Google Ads upload/send
    - GTM publish
    - 운영DB write
    - VM Cloud bridge ledger write
    - 광고 캠페인/예산 변경
  source_window_freshness_confidence:
    source: "VM Cloud SQLite + 운영DB read-only"
    window: "analysis_v2_since_2026-05-25 06:30 KST"
    freshness: "2026-05-25 23:24 KST"
    confidence: "high for route fix scope"
```

## 10초 요약

Google ROAS 보고서의 `분석 알고리즘 v2 기준점 이후` 숫자가 일부 시간대를 빠뜨릴 수 있는 문제를 고친다.

원인은 시간 형식 차이다. 보고서 API는 KST `+09:00` 기준점을 쓰고, VM Cloud SQLite의 실시간 원장은 UTC `Z` 시간을 쓴다. SQLite에서 두 문자열을 그대로 비교하면 2026-05-25 새벽 KST 일부 row가 빠질 수 있다.

## 무엇을 바꾸는가

`backend/src/routes/googleAds.ts`에서 VM Cloud SQLite를 조회할 때 시간 경계를 UTC `Z` 문자열로 변환해 비교한다.

사람 말로 풀면, 같은 시간을 서로 다른 표기법으로 비교하던 것을 같은 표기법으로 맞춘다.

## 왜 필요한가

Google click id가 어디서 사라지는지 판단하려면 `광고 클릭 → 구매하기 → 결제 화면 → 결제완료` 단계별 숫자가 정확해야 한다.

현재처럼 시간 비교가 흔들리면 화면에서 “결제완료 단계에 click id가 0건”이라고 보여도 실제 원자료와 어긋날 수 있다. 그러면 잘못된 병목을 고치게 된다.

## 허용 범위

- backend build
- VM Cloud backend 파일 반영
- `pm2 restart seo-backend`
- `/api/google-ads/click-id-dropoff?site=biocom&window=analysis_v2` read-only smoke
- Google ROAS 보고서 화면 read-only 확인

## 금지 범위

- Google Ads conversion upload/send
- Google Ads 전환 액션 변경
- 운영DB write
- VM Cloud bridge ledger write
- GTM publish
- Imweb header/footer 변경
- 광고 캠페인/예산 변경

## 성공 기준

- backend build 통과
- API 200 응답
- API 응답의 `stageSummary`, `stages`, `paymentStatusBreakdown`이 정상 JSON으로 반환
- `mode`는 no-send/read-only 유지
- upload/send/write 관련 invariant는 계속 0

## 실패 시 대응

- API 500이면 즉시 pm2 log 확인 후 이전 dist로 되돌린다.
- 숫자가 여전히 원자료와 다르면 source 필터, site 필터, KST/UTC 변환 위치를 다시 분리한다.
- 서비스 장애가 있으면 pm2 rollback 후 보고한다.

## 검증 완료

- `npm --prefix backend run typecheck`: 통과
- `npm --prefix backend run build`: 통과
- `python3 scripts/harness-preflight-check.py --strict`: 통과
- `python3 scripts/validate_wiki_links.py project/google-roas-grade-b-analysis-v2-result-20260525.md`: 통과

## 승인 요청

TJ님이 승인하면 Codex는 VM Cloud backend에 이 보정을 배포하고, Google ROAS 보고서의 분석 v2 숫자가 원자료와 맞는지 smoke까지 진행한다.
