# Coffee Data Auditor Checklist

작성 시각: 2026-05-01 15:23 KST  
상태: v0 기준판  
목적: 더클린커피 정합성 작업이 금지선을 지켰는지 종료 전에 검사한다  
관련 문서: [[harness/coffee-data/README|Coffee Data Harness]], [[harness/coffee-data/RULES|Coffee Rules]], [[harness/coffee-data/VERIFY|Coffee Verify]]

## 10초 요약

Auditor는 보수적으로 판단한다.

더클린커피 작업에서 지금 허용되는 것은 read-only 분석, dry-run, 문서/스키마 작성이다. 전송, 운영 DB write, GTM publish, endpoint 배포는 모두 실패 조건이다.

## Auditor 입력

| 입력 | 설명 |
|---|---|
| 사용자 요청 | 허용 범위 확인 |
| 변경 파일 | `git status --short`, `git diff --name-only` |
| 실행 명령 | BigQuery/Imweb/Excel dry-run 명령 |
| 최신 report | `data/coffee-*.md` |
| 문서 기준판 | `data/!coffeedata.md` |
| no-send/no-write 결과 | [[harness/coffee-data/VERIFY|VERIFY]] 결과 |

## Hard Fail Checks

아래 중 하나라도 YES면 `FAIL_BLOCKED`다.

| 체크 | YES면 실패인 이유 | 확인 방법 |
|---|---|---|
| GA4 MP 전송이 있었는가 | 승인 없는 purchase 복구 | 코드/로그/네트워크 확인 |
| Meta CAPI 전송이 있었는가 | 광고 최적화 오염 | `facebook`, `CAPI`, `Purchase` 호출 확인 |
| TikTok Events API 전송이 있었는가 | ROAS 오염 | TikTok API 호출 확인 |
| Google Ads conversion 전송이 있었는가 | 입찰 학습 오염 | conversion upload 확인 |
| 운영 DB write가 있었는가 | 원장 오염 | SQL, 로그, 코드 확인 |
| Excel actual import apply가 있었는가 | 과거 원장 오염 | import mode 확인 |
| GTM publish가 있었는가 | 운영 추적 변경 | GTM version 확인 |
| 운영 endpoint 배포가 있었는가 | 승인 없는 배포 | deploy/PM2/log 확인 |
| site가 불명확한가 | 사이트 혼합 위험 | report/query의 `site=thecleancoffee` 확인 |
| 잘못된 GA4 dataset을 썼는가 | property 오조회 | `analytics_326949178` 확인 |
| stale local mirror를 primary로 썼는가 | 오래된 데이터 오판 | source freshness 확인 |
| store/site filter 없는 운영 DB 결과를 정본으로 썼는가 | 3사이트 혼합 위험 | SQL 조건 확인 |
| Naver Commerce API 권한 없이 NPay actual을 확정했는가 | 판매자 권한 오류 가능 | API scope 확인 |
| ambiguous/B/probable을 send 후보로 만들었는가 | false positive 위험 | report `send_candidate` 확인 |

## Soft Fail Checks

아래는 수정 후 PASS 가능하다.

| 체크 | 문제 | 조치 |
|---|---|---|
| source/window/freshness/confidence 누락 | 숫자를 다시 믿기 어려움 | 문서 상단 보강 |
| 최신 report 숫자와 `!coffeedata` 숫자 불일치 | 의사결정 오염 | 기준 문서 갱신 |
| 다음 할일에 Phase/Sprint 링크 없음 | 실행 순서 불명확 | docurule 기준 보강 |
| `왜/어떻게` 설명이 없음 | TJ님이 판단하기 어려움 | 쉬운 설명 추가 |
| no-send grep 결과가 없음 | 금지선 검증 부족 | [[harness/coffee-data/VERIFY|VERIFY]] 실행 |
| unrelated dirty file이 staged | 커밋 오염 | stage 해제 |

## Coffee 숫자 일치 검사

| metric | 2026-05-01 기준값 | 기준 문서 |
|---|---:|---|
| Imweb orders | 113 | [[data/coffee-imweb-operational-readonly-20260501]] |
| Imweb NPay actual | 60 | [[data/coffee-imweb-operational-readonly-20260501]] |
| GA4 purchases | 108 | [[data/coffee-imweb-operational-readonly-20260501]] |
| GA4 NPay pattern | 58 | [[data/coffee-imweb-operational-readonly-20260501]] |
| one-to-one assigned | 42 | [[data/coffee-imweb-operational-readonly-20260501]] |
| unassigned actual | 18 | [[data/coffee-imweb-operational-readonly-20260501]] |
| unassigned GA4 | 16 | [[data/coffee-imweb-operational-readonly-20260501]] |
| unassigned guard robust_absent | 36/36 | [[data/coffee-npay-unassigned-ga4-guard-20260501]] |

숫자가 바뀌면 둘 중 하나를 한다.

1. `data/!coffeedata.md`를 최신 report 기준으로 갱신한다.
2. 과거 기준을 일부러 쓰면 `stale_by_design`과 이유를 적는다.

## Final Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_harness_v0_docs
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
Candidate guard verified: N/A
Numbers current: YES
Unrelated dirty files excluded: YES
Notes:
- 문서형 하네스 작업이며 실제 전송/DB write/GTM publish 없음.
```
