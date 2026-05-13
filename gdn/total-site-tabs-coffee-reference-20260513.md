# /total 바이오컴·더클린커피 탭 구현 메모

작성 시각: 2026-05-13 23:40 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - frontrule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - project/total.md
    - data/project/total-correction-line-contract-20260513.json
  lane: Green
  allowed_actions:
    - frontend local patch
    - backend read-only smoke
    - Playwright local smoke
  forbidden_actions:
    - 운영DB write
    - VM Cloud SQLite schema migration
    - external send/upload
    - GTM publish
  source_window_freshness_confidence:
    source: "local /total API response correction_lines"
    window: "2026-05-13 23:35~23:40 KST"
    site: "biocom response contains thecleancoffee correction line"
    freshness: "current local smoke"
    confidence: 0.88
```

## 결론

`/total` 화면 상단에 `바이오컴 / 더클린커피` 탭을 추가했다. 바이오컴 탭은 기존 월별 채널 분석을 유지하고, 더클린커피 탭은 기존 응답의 더클린커피 correction line을 참고 화면으로 보여준다.

## 왜 frontend-only로 했나

현재 backend `/api/total/monthly-channel-summary`와 두 dry-run script는 `site=biocom`만 지원한다. `site=thecleancoffee`를 직접 호출하면 500이 난다. 대신 biocom 응답 안에는 더클린커피 correction line이 이미 들어오므로, 더클린커피 탭은 이 line만 사용한다.

## 화면 의미

- 바이오컴: 월별 채널 분석, 예산 판단용 내부 confirmed 매출 화면.
- 더클린커피: 최근 30일 NPay actual correction line 참고 화면.
- 더클린커피 탭은 아직 월별 광고/자연검색/직접방문 분해가 아니다.
- 더클린커피 금액은 biocom budget ROAS에 자동 합산하지 않는다.

## 검증

- frontend typecheck: PASS
- backend typecheck: PASS
- local `/api/total/monthly-channel-summary?site=biocom&month=2026-05&mode=dry_run`: PASS
- coffee correction line: 317건 / 15,547,500원 / `included_with_warning`
- Playwright tab click: PASS
- 더클린커피 탭 클릭 시 `site=thecleancoffee` API 호출: 0회

## 남은 일

더클린커피를 바이오컴과 같은 수준의 월별 채널 분석으로 만들려면 backend에 coffee용 monthly spine/evidence source가 필요하다. 그 전까지 이 탭은 참고용 actual line 화면으로 유지한다.
