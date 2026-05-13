# gpt0514-2 결과보고 — 네이버 광고 UTM/NaPm 추적 감사

auto-selected package: `gptconfirm/gpt0514-2`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - docs/agent-harness/growth-data-harness-v0.md
    - docurule.md
    - frontrule.md
  project_harness_read:
    - data/!data_inventory.md
    - project/total.md
    - data/!bigquery_new.md
  lane: Green
  allowed_actions:
    - read-only VM Cloud SQLite query
    - read-only local DB query
    - read-only BigQuery cross-check
    - local backend/frontend patch
    - local typecheck/build/API smoke
    - document/report/package creation
  forbidden_actions:
    - 운영DB write
    - VM Cloud write/schema migration/deploy/restart
    - Google Ads/GA4/Meta/TikTok/Naver send/upload
    - GTM publish
    - Imweb footer/header 변경
    - raw order/payment/click/member/email/phone 출력
  source_window_freshness_confidence:
    source: "운영DB actual spine + VM Cloud channel evidence + 로컬DB Naver Ads cache + BigQuery traffic cross-check"
    window: "2026-05 monthly KST; BigQuery last_7d/14d/30d ending 2026-05-12"
    freshness: "2026-05-14 01:28 KST read-only smoke"
    confidence: "B+ for tracking audit, not final budget attribution"
```

## 한 줄 결론

네이버 유입은 “자연검색 144건”으로 단순 처리하면 안 된다. VM Cloud 전체 원장을 다시 보니 `NaPm`, 브랜드검색, `n_*` 표식이 실제로 들어오고 있고, `/total`에는 UTM 판정불가 15개 묶음을 사람이 고칠 수 있는 후보로 보여주도록 로컬 패치를 넣었다.

## 완료한 것

- gptconfirm 폴더를 스캔해서 `gpt0514-2`를 자동 선택했다.
- VM Cloud SQLite `attribution_ledger`와 `site_landing_ledger`를 read-only로 조회해 네이버 표식이 어디까지 남는지 집계했다.
- 로컬DB `naver_ads_daily` 캐시를 읽어 네이버 광고 spend/클릭/플랫폼 주장 전환액을 참고값으로 정리했다.
- BigQuery GA4는 actual 매출 정본이 아니라 traffic cross-check로만 실행했다.
- `/total` 로컬 API에 `utm_invalid_audit`를 추가했고, 프론트에서 UTM 규칙 후보를 보여주도록 했다.

## 실제 숫자

- 운영DB actual spine 기준 바이오컴 2026년 5월: 941건 / 204,006,680원.
- 현재 unknown: 510건 / 123,632,702원.
- UTM은 있으나 규칙 판정 불가: 15개 UTM 묶음, 상위는 `topbanner_mo`, `kakao`, `newmember_coupon`, `youtube` 계열이다.
- VM Cloud `attribution_ledger` payment_success에서 네이버 흔적은 216건, 이 중 `NaPm` 158건, 브랜드검색 100건, `n_*` 8건이다.
- VM Cloud payment_success 재분류 후보는 `paid_naver` 59건, `naver_brandsearch` 100건, `organic_naver_candidate` 39건, `naver_referrer_or_utm_only` 17건이다.
- 로컬DB `naver_ads_daily` 캐시는 2026-05-06~2026-05-12 기준 259 rows, 3,000 clicks, spend 1,698,930원, 플랫폼 주장 전환액 31,501,866원이다. 이 값은 참고용이며 내부 confirmed 매출에 더하지 않는다.

## 하지 않은 것

- 네이버 유입 후보를 예산 ROAS에 바로 올리지 않았다.
- 운영DB write, VM Cloud write/schema migration, deploy/restart, 외부 send/upload, GTM publish는 하지 않았다.
- raw order id, payment key, click id, member_code, email, phone은 출력하지 않았다.

## 검증 결과

- `backend npm run typecheck`: PASS.
- `frontend npm run build`: PASS.
- monthly dry-run JSON parse: PASS.
- local `/api/total/monthly-channel-summary` smoke: PASS, `utm_invalid_audit` 15 rows.
- BigQuery archive+daily union dry-run: PASS, 7/14/30일 coverage PASS.
- `validate_wiki_links`: PASS.
- `harness-preflight-check --strict`: PASS.
- `git diff --check`: PASS.
- raw email/phone/member/order/payment/click id value pattern scan: PASS.

## 현재 영향/서버·커밋 상태

- 로컬 코드만 변경했다. 운영 배포/restart는 하지 않았다.
- `/total` 로컬 화면에서 unknown drilldown 안에 UTM 규칙 후보를 볼 수 있다.
- 커밋/푸시는 하지 않았다. 작업 전부터 있던 다른 dirty 파일은 건드리지 않았다.

## 남은 리스크

- VM Cloud 전체 원장과 `/total` API item slice가 다르다. `/api/attribution/ledger` item 기반 144건은 제한된 응답 기준이고, 전체 SQLite aggregate는 더 많은 네이버 evidence를 보여준다.
- GA4 source_group과 campaign_hint가 서로 엇갈리는 케이스가 있어 GA4만으로 paid/organic을 확정하면 안 된다.
- `n_*` 파라미터는 현재 많이 남지는 않지만, destination URL 표준화 없이는 향후에도 UTM 판정불가가 반복될 수 있다.

## 확인하면 좋은 문서

1. [01-naver-ads-utm-napm-audit.md](01-naver-ads-utm-napm-audit.md) — 네이버 표식이 어느 원장에 몇 건 남는지 숫자로 봐야 한다.
2. [02-naver-paid-organic-classification.md](02-naver-paid-organic-classification.md) — paid/brandsearch/organic을 어떤 기준으로 나눌지 확인해야 한다.
3. [03-next-actions-and-approval.md](03-next-actions-and-approval.md) — 운영 반영 전 무엇을 승인해야 하는지 정리했다.

## 다음 할일

### Codex가 할 일

1. `/total` 운영 반영 승인 전 로컬 화면 smoke를 한 번 더 확인한다. 이유는 UTM 후보 테이블이 unknown drilldown에서 잘 보이는지 봐야 하기 때문이다. 방법은 `http://localhost:7010/total`에서 2026년 5월 바이오컴 조회 후 “어디서 왔는지 모르는 매출 분석” 영역을 확인한다. 성공 기준은 UTM 후보 8개 이하가 사람 말로 보이는 것이다. 승인 필요 여부는 Green 로컬에서는 없음, 운영 배포는 Yellow 승인 필요. 의존성은 현재 로컬 서버 상태다. 추천 점수/자신감 91%.
2. 네이버 destination URL 표준 규칙 초안을 만든다. 이유는 `NaPm`, `n_*`, `utm_source/medium/campaign`이 랜딩에서 결제까지 같은 방식으로 남아야 unknown을 줄일 수 있기 때문이다. 방법은 `03-next-actions-and-approval.md`의 규칙을 네이버 광고 화면 입력값 기준으로 다듬는다. 성공 기준은 TJ님이 광고 URL에 넣을 값이 1개 템플릿으로 정리되는 것이다. 승인 필요 여부는 문서 작성은 없음, 실제 광고 URL 변경은 TJ님 승인 필요. 의존성은 없음. 추천 점수/자신감 88%.

### TJ님이 할 일

1. 네이버 광고 destination URL을 실제로 바꿀지 승인한다. 왜 필요한가: 지금도 `NaPm`은 일부 들어오지만 UTM 이름이 제각각이면 paid_naver/brandsearch 분리가 계속 흔들린다. 어디서 하는가: Naver Ads 광고그룹/소재 랜딩 URL 설정 화면. 바꾸는 값은 `utm_source=naver&utm_medium=cpc&utm_campaign=<campaign_type>_<campaign_id>&utm_content=<adgroup_or_creative>&utm_term=<keyword>` 같은 표준 URL이다. 성공 기준은 새 클릭이 VM Cloud `site_landing_ledger`와 `attribution_ledger`에 같은 규칙으로 남는 것이다. 실패 시 다음 확인점은 redirect에서 query string이 제거되는지 여부다. Codex가 대신 못 하는 이유는 실제 광고 계정 설정 변경은 외부 플랫폼 운영 변경이기 때문이다. 승인 필요 여부: YES, Yellow. 추천 점수/자신감 86%.
