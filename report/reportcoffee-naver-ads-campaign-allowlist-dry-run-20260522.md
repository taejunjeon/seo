# reportcoffee Naver Ads campaign allowlist dry-run 20260522

작성 시각: 2026-05-22 13:32 KST
기준일: 2026-05-21
문서 성격: 더클린커피 Naver Ads 캠페인 허용 목록 미리보기(no-write dry-run)
담당: Codex
관련 문서: [[reportcoffee]], [[reportcoffee-naver-ads-ip-cache-check-20260522]], [[reportcoffee-slack-preview-20260522]]

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - frontrule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - report/reportcoffee.md
    - report/reportcoffee-naver-ads-ip-cache-check-20260522.md
  lane: Green
  allowed_actions:
    - Naver Ads read-only campaign list
    - Naver Ads read-only stats dry-run
    - local script and report output
  forbidden_actions:
    - Naver Ads state change
    - SQLite write
    - operating_db_write
    - platform conversion send
    - Slack send
    - GTM publish
    - raw secret output
  source_window_freshness_confidence:
    source: "VM Cloud Naver Ads API env + Naver Search Ads campaign/stats read-only API"
    window: "2026-04-22 - 2026-05-21 KST"
    freshness: "2026-05-22 13:28 KST dry-run"
    confidence: "high for campaign/spend read-only, medium for final business allowlist until TJ님 review"
```

## 10초 요약

더클린커피 Naver Ads는 IP/API 문제가 아니다. VM Cloud(보고 서버)에서 캠페인 목록과 30일 일별 광고비를 읽었다.

더클린커피 후보 캠페인은 6개였고, 6개 모두 PAUSED였다. 2026-04-22 - 2026-05-21 기준 후보 캠페인 광고비와 클릭은 모두 0이다.

따라서 Slack(업무용 메신저) 주간/월간 보고에는 `Naver: 0원 확인 후보`로 표시할 수 있다. 다만 더클린커피 DB 캐시 저장(cache write: 화면이 빠르게 읽도록 내부 SQLite 테이블에 저장)은 아직 하지 않는다. 허용 목록 안전장치(allowlist guard: 지정한 더클린커피 캠페인만 통과시키는 조건)가 광고비 수집 스크립트(collector: 네이버 광고 API에서 광고비를 읽어 내부 DB에 저장하는 프로그램)에 들어가기 전에는 계정 전체 캠페인이 더클린커피로 저장될 위험이 남아 있다.

## 이번에 가능해진 것

더클린커피 캠페인 이름이 들어간 Naver Ads 후보만 따로 골라낼 수 있게 됐다.

이전에는 `--site=thecleancoffee`가 API 필터가 아니라 저장 라벨이라 위험했다. 쉽게 말해 이 값은 “네이버에서 더클린커피 캠페인만 가져와라”가 아니라 “가져온 결과를 더클린커피라고 저장해라”에 가깝다. 이제 미리보기 실행(dry-run: DB 저장 없이 결과만 보는 실행) 결과가 `더클린커피/클린커피` 키워드로 후보를 만들고, `바이오컴/biocom/aibio` 키워드로 제외해야 할 캠페인을 분리한다.

## 실제 확인 결과

- 조회 위치: VM Cloud Naver Ads env
- 조회 방식: read-only campaign list + read-only stats
- window: 2026-04-22 - 2026-05-21 KST
- 전체 캠페인: 37개
- 더클린커피 허용 목록 후보: 6개
- 바이오컴/AIBIO 제외 후보: 20개
- 미매칭 후보: 11개
- read failure: 0개
- 계정 전체 광고비: 7,305,482원
- 더클린커피 후보 광고비: 0원
- 더클린커피 후보 클릭: 0회
- 후보 상태: `zero_spend_candidate_all_inactive`

## 후보 캠페인

| 후보 캠페인 | 유형 | 상태 | 30일 클릭 | 30일 광고비 | 판단 |
|---|---|---|---:|---:|---|
| [쇼핑검색] 04_더클린커피 아임웹 | 쇼핑검색 | PAUSED | 0 | 0원 | 허용 목록 후보, 현재 광고비 0 |
| [쇼핑검색] 04_더클린커피 아임웹 커피 | 쇼핑검색 | PAUSED | 0 | 0원 | 허용 목록 후보, 현재 광고비 0 |
| [파워링크] 07-1_더클린커피_아임웹 | 파워링크 | PAUSED | 0 | 0원 | 허용 목록 후보, 현재 광고비 0 |
| [파워링크] 07-3_더클린커피_록하트 | 파워링크 | PAUSED | 0 | 0원 | 허용 목록 후보, 현재 광고비 0 |
| [파워링크] 더클린커피_아임웹/NXL | 파워링크 | PAUSED | 0 | 0원 | 허용 목록 후보, 현재 광고비 0 |
| 브랜드검색03_더클린커피 | 브랜드검색 | PAUSED | 0 | 0원 | 허용 목록 후보, 현재 광고비 0 |

## 판단

더클린커피 Naver 광고비는 현재 확인된 후보 캠페인 기준 0원이다.

다만 이 0원은 `더클린커피 후보 캠페인 6개가 모두 멈춰 있고 최근 30일 지출이 없었다`는 뜻이다. `thecleancoffee` 캐시에 row가 이미 안전하게 저장됐다는 뜻은 아니다.

그래서 다음 두 표현을 구분한다.

- 운영 보고 표현: `Naver: 0원 확인 후보`
- 데이터 엔지니어링 상태: `DB 캐시 저장은 더클린커피 캠페인 6개만 통과시키는 안전장치 연결 전 HOLD`

## 정확히 어디를 고치는가

이 작업은 네이버 광고 계정 자체를 바꾸는 일이 아니다. 광고를 켜거나 끄는 것도 아니다.

고치는 위치는 내부 수집 경로다.

1. **Naver Ads API**
   - 뜻: 네이버 광고 계정에서 캠페인 이름, 상태, 광고비를 읽는 공식 연결 통로다.
   - 이번 작업: 읽기만 한다. 광고 상태 변경은 0이다.

2. **광고비 수집 스크립트**
   - 뜻: `backend/scripts/naver-ads-collect-7d-20260513.ts`처럼 네이버 광고비를 읽어 내부 DB에 저장할 수 있는 프로그램이다.
   - 이번 다음 작업: 여기에 `더클린커피 후보 6개만 통과` 조건을 넣는다.
   - 왜 필요한가: 조건 없이 `site=thecleancoffee`로 저장하면 바이오컴 광고비가 더클린커피 광고비처럼 저장될 수 있기 때문이다.

3. **DB 캐시 테이블**
   - 뜻: `naver_ads_daily`는 화면과 보고 API가 빠르게 읽는 내부 SQLite 테이블이다.
   - 이번 작업: 저장하지 않았다.
   - 다음 저장 조건: 수집 스크립트 안전장치가 붙고, 저장 전 미리보기에서 후보 6개만 남는 것이 확인돼야 한다.

4. **Slack 보고 문구**
   - 뜻: TJ님이 매주/매월 받는 보고 메시지다.
   - 이번 판단: 실제 저장 전까지 `Naver: 0원 확인 후보`와 `DB 캐시 저장 전` 경고를 같이 쓴다.

## 새 스크립트

추가한 스크립트:

```bash
./backend/node_modules/.bin/tsx backend/scripts/reportcoffee-naver-ads-campaign-allowlist-dry-run.ts \
  --site=thecleancoffee \
  --since=2026-04-22 \
  --until=2026-05-21 \
  --delay-ms=100 \
  --json
```

로컬 Mac에는 Naver Ads env가 없어서 `configured=false`가 정상이다. 실제 API dry-run은 VM Cloud env로 read-only 실행했다.

## Guardrails

- SQLite write: 0
- Naver Ads state change: 0
- external send: 0
- platform conversion send: 0
- Slack send: 0
- 운영DB write: 0
- raw secret logged: false
- Naver `convAmt`를 내부 매출로 합산: 0

## 다음 액션

1. 광고비 수집 스크립트에 더클린커피 캠페인 6개만 통과시키는 조건을 넣는다.
   - 무엇을 하는가: 네이버 광고비 수집 스크립트가 계정 전체 37개 캠페인을 모두 저장하지 못하게 막는다.
   - 왜 하는가: 바이오컴 광고비가 더클린커피 광고비로 섞이면 매출 대비 광고비 비중이 틀어진다.
   - 어디를 고치는가: 네이버 API가 아니라 로컬/VM backend의 수집 스크립트다.
   - 어떻게 검증하는가: DB 저장 없이 미리보기 실행을 돌려 후보 6개만 남고, 나머지 광고비 7,305,482원이 제외되는지 확인한다.
   - 승인 필요 여부: 코드와 미리보기는 Green Lane이다. 실제 DB 저장은 별도 승인 전 금지다.

2. Slack 발송 전 미리보기에서는 Naver를 `0원 확인 후보`로 유지한다.
   - 무엇을 하는가: 주간/월간 보고 문구에 Naver 광고비를 0원 후보로 보여주되, DB 캐시 저장 전이라는 경고를 붙인다.
   - 왜 하는가: Naver를 무작정 보류로 두면 광고비 비중이 과도하게 불완전해 보이고, 확정처럼 쓰면 저장 검증이 끝난 것처럼 보인다.
   - 어떻게 표시하는가: `Naver: 0원 확인 후보 — 후보 캠페인 6개 모두 PAUSED, DB 캐시 저장 전`으로 쓴다.
   - 성공 기준: TJ님이 메시지만 봐도 “광고비는 0원 후보지만 저장 자동화는 아직 보류”라는 상태를 이해할 수 있다.

3. 실제 `naver_ads_daily(site='thecleancoffee')` 적재는 별도 승인 후 진행한다.
   - 무엇을 하는가: 화면과 보고 API가 읽는 내부 SQLite 테이블에 더클린커피 Naver 광고비 row를 저장한다.
   - 왜 하는가: 매번 네이버 API를 직접 읽지 않고도 주간/월간 보고가 같은 값을 빠르게 읽게 하기 위해서다.
   - 필요한 조건: 수집 스크립트 안전장치, 저장 전 미리보기 PASS, 저장 row count/광고비 preview PASS, 백업/rollback 계획.
   - 승인 필요 여부: DB 저장이므로 별도 승인 필요다.
