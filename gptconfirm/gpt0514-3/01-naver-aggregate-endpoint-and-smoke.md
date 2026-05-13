# 01. 네이버 evidence 전체 aggregate endpoint와 smoke

## 목적

`/api/attribution/ledger` item slice에서 보이는 144건과 VM Cloud SQLite 전체 aggregate 216건이 섞여 보고되면 네이버 유입 판단이 흔들린다. 이번 작업은 화면/문서/드라이런이 모두 “전체 aggregate 기준”과 “제한 item fallback 기준”을 분리해서 말하도록 만드는 것이다.

## 구현

- backend route: `GET /api/attribution/ledger/naver-evidence-aggregate`
- response contract: `naver-evidence-aggregate-v0.1`
- 반환 원칙: aggregate only, raw identifier output false, budget_roas_included false.
- 주요 필드: `naver_any`, `paid_naver`, `naver_brandsearch`, `organic_naver_candidate`, `naver_referrer_or_utm_only`, `touchpoint`, `rows`, `bridge_key_present`, `confidence`.
- `/total` monthly response에는 `evidence.naver_evidence_aggregate`로 연결한다.

## 기준 숫자

source: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `attribution_ledger`
window: 2026-04-30T15:00:00.000Z <= logged_at < 2026-05-31T15:00:00.000Z
site/source: `biocom_imweb`, capture_mode `live`, touchpoint `payment_success`
freshness: 2026-05-14 KST read-only query
confidence: B

- total: 854
- naver_any: 216
- search_referrer: 157
- NaPm: 158
- brandsearch: 100
- n_*: 8
- bridge key present: 854

분류 후보:

- paid_naver: 59
- naver_brandsearch: 100
- organic_naver_candidate: 39
- naver_referrer_or_utm_only: 17

## Smoke 결과

- local browser `http://localhost:7010/total`: PASS.
- UTM 후보 표 visible: PASS.
- “참고용, 예산 판단 제외” 문구 visible: PASS.
- raw identifier leak text: false.
- local endpoint shape `http://localhost:7021/api/attribution/ledger/naver-evidence-aggregate`: PASS shape only.

현재 운영 `att.ainativeos.net`에는 새 endpoint가 아직 없어서 monthly dry-run은 제한 item slice fallback을 쓴다. fallback은 10,000 row item slice 기준 네이버 후보 500건으로 보이며, checkout_started와 payment_success가 섞여 있어 216건과 직접 비교하지 않는다.

## biocom.kr 직접 입력 유입

질문: `biocom.kr` 도메인을 직접 쳐서 들어오는 사람들을 현재 구분하는가?

답: landing-level에서는 일부 구분한다. VM Cloud `site_landing_ledger`가 `channel_classified=direct`와 `self_internal`을 나눈다.

2026년 5월 window read-only 기준:

- VM Cloud `site_landing_ledger` total: 2,930 rows.
- `channel_classified=direct`: 23 rows.
- no referrer + no UTM + no click id strict direct candidate: 7 rows.
- self-domain referrer raw flag: 2,863 rows.
- `channel_classified=self_internal`: 373 rows.

중요한 제한: 이것은 아직 “매출이 direct에서 왔다”는 order-level 정본이 아니다. `/total` 월 매출 예산 판단에서는 운영DB 결제완료 spine과 payment_success bridge가 닫혀야 direct revenue로 올릴 수 있다.

## 결론

144는 제한 item response에서 나온 화면용 slice 숫자이고, 216은 VM Cloud 전체 payment_success aggregate 기준이다. 새 endpoint가 운영 반영되면 `/total`은 216 기준을 직접 받을 수 있다.
