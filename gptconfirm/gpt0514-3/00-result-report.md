# gpt0514-3 결과보고 — 네이버 evidence 전체 집계와 URL canary 승인안

auto-selected package: `gptconfirm/gpt0514-3`

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
    - gptconfirm/gpt0514-2/00-result-report.md
  lane: Green
  allowed_actions:
    - read-only VM Cloud SQLite query
    - local backend/frontend patch
    - local browser/API smoke
    - local typecheck/build
    - approval packet 작성
    - scoped commit/push
  forbidden_actions:
    - 운영DB write
    - VM Cloud write/schema migration/deploy/restart
    - Google Ads/GA4/Meta/TikTok/Naver send/upload
    - GTM publish
    - Imweb footer/header 변경
    - raw order/payment/click/member/email/phone 출력
  source_window_freshness_confidence:
    source: "운영DB actual spine + VM Cloud channel evidence + 로컬 /total smoke"
    window: "2026-05 monthly KST"
    freshness: "2026-05-14 02:03 KST"
    confidence: "B+ for aggregate evidence, not budget attribution"
```

## 이번에 가능해진 것

`/total`에서 네이버 유입 후보를 제한 item slice가 아니라 전체 원장 aggregate 기준으로 보여줄 수 있는 안전한 통로를 만들었다. 네이버 광고 표식은 아직 예산 ROAS에 더하지 않고, paid/brandsearch/organic 후보를 “참고용, 예산 판단 제외”로 분리한다.

## 완료한 것

- `gptconfirm/gpt0514-3`를 자동 선택해 새 패키지를 만들었다.
- `/api/attribution/ledger/naver-evidence-aggregate` 로컬 endpoint를 추가했다.
- `/total` monthly evidence contract에 `naver_evidence_aggregate`를 연결하고, 프론트에서 네이버 paid/brandsearch/organic 후보를 따로 보여주도록 했다.
- `utm_invalid` rule에 `powerlink`, `shoppingsearch` 네이버 paid 후보를 보강했다.
- `http://localhost:7010/total` 로컬 브라우저 smoke에서 UTM 후보 표, 참고용 문구, raw id 미노출을 확인했다.
- biocom.kr 직접 입력 유입은 현재 VM Cloud `site_landing_ledger`에서 landing-level `direct`로 구분 중인지 확인했다.

## 실제 숫자

- VM Cloud `attribution_ledger` payment_success 전체 aggregate 기준: 네이버 흔적 216건, NaPm 158건, 브랜드검색 100건, `n_*` 8건, bridge key present 854건.
- 분류 후보: paid_naver 59건, naver_brandsearch 100건, organic_naver_candidate 39건, naver_referrer_or_utm_only 17건.
- 현재 원격에는 새 aggregate endpoint가 아직 없어 local dry-run은 제한 item slice fallback을 쓴다. 이 fallback은 10,000 row slice에서 네이버 후보 500건으로 보이며, checkout/payment가 섞여 있어 216건과 직접 비교하면 안 된다.
- biocom.kr 직접 입력 후보: VM Cloud `site_landing_ledger` 2026년 5월 window에서 `channel_classified=direct` 23건, 엄격한 no referrer/no UTM/no click 후보 7건이다. 다만 월 매출 order-level direct revenue로는 아직 확정 배정하지 않는다.

## 하지 않은 것

- 네이버 후보를 budget ROAS에 포함하지 않았다.
- 네이버 광고 URL을 실제로 바꾸지 않았다.
- 운영DB write, VM Cloud deploy/restart/schema change, 외부 platform send/upload, GTM publish, Imweb 변경은 하지 않았다.
- raw order id, payment key, click id, member_code, email, phone은 출력하지 않았다.

## 검증 결과

- backend `npm run typecheck`: PASS.
- frontend `npm run build`: PASS.
- local aggregate endpoint shape smoke: PASS.
- local `/total` browser smoke: PASS.
- raw identifier text leak smoke: PASS.
- JSON parse: PASS.
- `validate_wiki_links`: PASS.
- `harness-preflight-check --strict`: PASS.
- `git diff --check`: PASS.

## 현재 영향/서버·커밋 상태

- 로컬 코드와 문서만 변경했다.
- 운영 `att.ainativeos.net`에는 아직 새 aggregate endpoint가 없다.
- 운영 반영은 별도 Yellow 승인 후 backend/frontend deploy/restart가 필요하다.
- 임시 local backend `:7021` smoke 서버는 검증 후 종료했다.
- scoped commit/push 완료: `6bf2f79 total: add naver evidence aggregate drilldown`.

## 남은 리스크

- 144 vs 216 혼선은 원인까지 정리됐지만, 운영 화면에서 완전히 사라지려면 새 endpoint를 VM Cloud backend에 배포해야 한다.
- `direct`는 landing-level로는 보이나, 주문 결제완료 spine과 닫힌 order-level channel로 확정하려면 payment bridge 규칙이 더 필요하다.
- 네이버 URL canary는 실제 광고 플랫폼 설정 변경이라 TJ님 승인 전에는 실행하지 않는다.

## 확인하면 좋은 문서

1. [01-naver-aggregate-endpoint-and-smoke.md](01-naver-aggregate-endpoint-and-smoke.md) — 144 vs 216 혼선의 원인과 새 contract를 확인해야 한다.
2. [02-naver-url-standardization-canary.md](02-naver-url-standardization-canary.md) — 실제 네이버 광고 URL을 어디까지 바꿀지 승인 전 기준을 봐야 한다.
3. [03-next-actions-and-approval.md](03-next-actions-and-approval.md) — 운영 반영과 canary 실행 순서를 확인해야 한다.

## 다음 할일

### Codex가 할 일

1. 새 aggregate endpoint 운영 반영 승인안을 실행 가능한 명령으로 정리한다. 이유는 `/total`이 제한 item slice fallback이 아니라 VM Cloud 전체 aggregate를 쓰게 해야 하기 때문이다. 방법은 backend `routes/attribution.ts`, `routes/total.ts`, monthly dry-run script, frontend `/total` 파일을 배포 대상으로 묶고 pre/post snapshot과 rollback을 적는다. 성공 기준은 운영 `/total`이 payment_success 네이버 216건 기준을 보여주는 것이다. 승인 필요 여부는 Yellow. 의존성은 TJ님 운영 deploy 승인이다. 추천 점수/자신감 88%.
2. biocom.kr direct revenue를 order-level로 닫는 설계를 이어간다. 이유는 현재 direct는 유입 landing-level evidence라 매출 채널로 바로 쓰면 과대 배정될 수 있기 때문이다. 방법은 VM Cloud `site_landing_ledger` direct row와 `attribution_ledger payment_success` first touch bridge를 aggregate only로 대조한다. 성공 기준은 direct typed 후보가 주문/매출 단위로 분리되고 self_internal과 섞이지 않는 것이다. 승인 필요 여부는 Green read-only. 의존성 없음. 추천 점수/자신감 81%.

### TJ님이 할 일

1. 네이버 URL canary를 1개 캠페인 또는 1개 광고그룹에만 적용할지 승인한다. 실제로 누를 화면은 Naver Ads 광고그룹/소재 랜딩 URL 설정 화면이다. 바꾸는 설정은 destination URL query string의 UTM 규칙이다. 바꾸면 새 클릭이 paid_naver/brandsearch 후보로 안정적으로 분리되고, 안 바꾸면 UTM 판정불가와 item slice 혼선이 남는다. Codex가 대신 못 하는 이유는 실제 광고 계정 설정 변경은 외부 운영 변경이기 때문이다. 성공 기준은 24~72시간 후 VM Cloud `site_landing_ledger`와 `attribution_ledger`에 같은 UTM/NaPm evidence가 남는 것이다. 실패 시 redirect가 query string을 제거하는지 확인한다. 승인 필요 여부는 YES, Yellow. 추천 점수/자신감 86%.
