작성 시각: 2026-05-30 11:32 KST
기준일: 2026-05-30
문서 성격: Google Ads / NPay ROAS 정합성 설계 결정 기록

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/npay-recovery/README.md
  lane: Green for decision documentation
  allowed_actions:
    - decision log update
    - local documentation update
  forbidden_actions:
    - Google Ads conversion send
    - VM Cloud deploy or write
    - GTM publish
    - production DB write
    - secret exposure
  source_window_freshness_confidence:
    source: prior approved work, local repo state, Google Ads/VM Cloud read-only checks
    window: 2026-05-21 through 2026-05-30 KST
    freshness: latest live counters should be rechecked before operational action
    confidence: high for decisions, medium for live values
```

## 10초 요약

이번 작업의 가장 큰 결정은 `NPay 버튼 클릭을 구매로 보지 않고, 실제 결제완료 주문만 Google Ads 구매 신호로 쓴다`는 것이다.

Google Ads에 실제 구매를 알려주는 통로는 `BI confirmed_purchase_offline`로 정했다. 다만 NPay 외부 결제창을 지나면 버튼 클릭 row와 최종 주문 row의 연결이 약해지는 문제가 남아 있어, 이 bridge 품질이 다음 핵심 과제다.

## 결정 1. 기존 Google Ads 구매완료는 실제 구매가 아니라 NPay 진입 보조 신호로 본다

- 날짜: 2026-05-26 전후
- 상태: 적용됨
- 결정:
  - 기존 `구매완료` 액션은 Primary에서 Secondary로 낮추고 이름도 NPay 버튼 클릭/결제진입 의미로 분리했다.
  - 이유는 제품 페이지에서 NPay 버튼만 눌러도 Google Ads conversion request가 발생했기 때문이다.
- 사람 말 해석:
  - 고객이 실제로 돈을 낸 것이 아니라, 네이버페이 결제창으로 들어간 것만으로 구매처럼 잡히고 있었다.
  - 이 값을 입찰 학습에 계속 쓰면 Google Ads가 실제 구매가 아니라 버튼 클릭을 늘리는 방향으로 학습할 수 있다.
- 영향:
  - 예산 판단은 이 보조 전환이 아니라 실제 결제완료 전환 기준으로 해야 한다.

## 결정 2. 실제 구매 전용 Google Ads 전환은 `BI confirmed_purchase_offline`을 쓴다

- 날짜: 2026-05-26~2026-05-29
- 상태: 적용됨
- 전환 정보:
  - name: `BI confirmed_purchase_offline`
  - id: `7609289411`
  - type: `UPLOAD_CLICKS`
  - 목적: 실제 결제완료 주문만 Google Ads에 알려주는 통로
- 결정:
  - 이 액션을 Primary 전환, 즉 Google Ads가 입찰 학습에 쓰는 핵심 구매 신호로 사용한다.
- 이유:
  - 기존 웹 태그는 NPay 버튼 클릭 단계에서 발화되어 실제 구매와 섞였다.
  - VM Cloud/내부 원장에서 실제 결제완료 주문을 확인한 뒤 Google click id와 붙여 전송하는 것이 더 정확하다.
- 남은 조건:
  - 전송 후보가 꾸준히 쌓여야 한다.
  - 오래된 클릭, 테스트 click id, 중복, 취소/환불, 금액 불일치 row를 후보에서 제외해야 한다.

## 결정 3. 약한 추론만으로 Google Ads에 보내지 않는다

- 날짜: 2026-05-23 이후 반복 확인
- 상태: 유지
- 결정:
  - same-session, same-client, time-window만으로는 Google Ads 전송 후보로 올리지 않는다.
  - Google Ads 전송 후보는 confirmed order와 gclid/gbraid/wbraid 직접 evidence가 있어야 한다.
- 이유:
  - Google Ads 전송은 광고 플랫폼의 구매 학습값을 바꾸는 작업이다.
  - 약한 추론을 보내면 false positive가 생기고 ROAS가 더 왜곡된다.
- 예외:
  - 내부 분석용 후보 등급으로는 B/C/D를 둘 수 있다.
  - 하지만 upload/send는 A급 직접 증거만 사용한다.

## 결정 4. NPay bridge는 GTM v1.1로 보강한다

- 날짜: 2026-05-28
- 상태: Production publish 완료
- 결정:
  - NPay 버튼 클릭 시점과 네이버 bridge/checkout URL을 더 안정적으로 저장하기 위해 GTM `BI NPay Bridge v1.1` 태그를 게시했다.
- 이유:
  - NPay 결제는 외부 도메인에서 진행되어 바이오컴 사이트 태그가 결제 완료 과정을 직접 볼 수 없다.
  - 따라서 버튼 클릭 직전/직후에 최대한 많은 연결 단서를 남겨야 한다.
- 저장/분류 목표:
  - button clicked
  - bridge opened
  - login gate possible
  - checkout opened possible
  - entered not completed
  - completed when joined to real order
- 주의:
  - 원문 URL에는 민감한 결제 흐름 단서가 들어갈 수 있다.
  - 보고서와 대화에는 raw URL/order/payment/click id를 그대로 노출하지 않는다.

## 결정 5. TEST/SMOKE/GTM click id는 실제 click id로 취급하지 않는다

- 날짜: 2026-05-29
- 상태: 로컬 패치/배포 검토 흐름 진행
- 결정:
  - `TEST`, `SMOKE`, `GTM`, preview 목적 click id는 저장 단계와 후보 생성 단계에서 제외한다.
- 이유:
  - 테스트 click id가 실제 Google Ads 후보로 들어가면 전송 실패와 원장 오염이 생긴다.
  - 실제 광고 click id까지 막으면 안 되므로 sanitizer는 명확한 synthetic pattern만 제외해야 한다.
- 검증 기준:
  - 실제 gclid/gbraid/wbraid 형식은 통과.
  - `TEST_GTM_*`, `SMOKE_*`, preview synthetic 값은 차단.

## 결정 6. Google Ads 자동 전송은 제한형으로 운영한다

- 날짜: 2026-05-29
- 상태: cron 존재, limit 5 설계
- 결정:
  - 10분마다 최근 24시간 후보를 보고, 최대 5건까지 제한 전송한다.
  - 중복 장부에 이미 있으면 보내지 않는다.
- 이유:
  - 한 번에 많은 row를 보내면 잘못된 후보가 대량으로 들어갈 수 있다.
  - 초기에는 제한적으로 보내고 반영/진단을 보며 품질을 확인하는 것이 안전하다.
- 현재 상태:
  - cron은 존재한다.
  - 최근 로그상 후보가 없으면 `no_ready_google_ads_upload_candidates`로 보내지 않는다.
- 다음 결정 포인트:
  - 후보 품질이 안정되면 max 10 상향을 검토할 수 있다.
  - 단, sent-but-not-reflected 9건 원인 분류가 먼저다.

## 결정 7. HTTP 200을 성공으로 보지 않는다

- 날짜: 2026-05-29
- 상태: 유지
- 결정:
  - Google Ads API upload 응답 HTTP 200은 요청이 도착했다는 뜻으로만 본다.
  - 실제 성공은 offline diagnostic과 Google Ads 리포트 반영으로 판단한다.
- 이유:
  - partial failure가 있어도 HTTP 200이 나올 수 있다.
  - 실제 리포트에는 클릭 기간 초과, too recent click, 중복/필터 등으로 누락될 수 있다.
- 실례:
  - 293,206원 row는 요청은 처리됐지만 Google Ads 진단상 click-through window 초과로 전환 기록이 안 됐다.

## 결정 8. 클릭 나이 검사를 후보 생성기에 넣는다

- 날짜: 2026-05-29
- 상태: 설계/보강 진행
- 기준:
  - `BI confirmed_purchase_offline`의 click-through lookback window는 30일이다.
  - Google 문서상 gclid 자체 보관은 90일 맥락이 있지만, 이 전환 액션은 30일 기준으로 봐야 한다.
  - 클릭 후 6시간이 안 된 row는 too recent 가능성이 있어 재시도 대기 후보로 본다.
- 결정:
  - 후보 생성기는 전환 시각과 광고 클릭 시각 차이를 검사해야 한다.
  - 너무 오래된 클릭은 전송 후보가 아니라 제외/보류로 분류한다.
- 이유:
  - 오래된 클릭 row를 보내면 API 요청은 성공처럼 보여도 Google Ads 리포트에 붙지 않는다.

## 결정 9. VM Cloud와 운영DB를 섞어 부르지 않는다

- 날짜: 지속
- 상태: 유지
- 결정:
  - VM Cloud는 TJ님이 관리하는 Cloudflare/SQLite 기반 보조 원장이다.
  - 운영DB는 개발팀이 관리하는 PostgreSQL dashboard DB다.
  - Google Ads/NPay bridge 작업의 주 source는 VM Cloud SQLite지만, 주문 정본과 sync freshness를 항상 표시한다.
- 이유:
  - source를 섞으면 `데이터 없음`, `sync 지연`, `원장 차이`, `권한 문제`를 구분할 수 없다.

## 결정 10. 로컬 보고서는 요약과 상세를 분리한다

- 날짜: 2026-05-29~2026-05-30
- 상태: 부분 적용
- 결정:
  - `/ads/google-roas-report`는 의사결정 요약 중심.
  - `/ads/google-roas-report/details`는 row-level/진단 상세 중심.
- 이유:
  - 기존 보고서 한 화면에 너무 많은 정보가 들어가 핵심 병목이 흐려졌다.
  - TJ님이 강조한 핵심은 NPay 클릭이 많은데 결제완료 연결이 약한 이유다.
- 남은 작업:
  - NPay bridge 전용 상세 화면 또는 섹션을 더 분리할 수 있다.

## 결정 11. 다음 핵심 목표는 NPay 외부 결제창 이후 연결률 개선이다

- 날짜: 2026-05-30
- 상태: 최우선 목표로 재설정
- 결정:
  - 다음 목표 문장은 아래로 고정한다.
  - "진짜 병목은 네이버 외부 결제창을 지난 뒤 실제 결제완료 주문을 원래 버튼 클릭 row와 안정적으로 다시 붙이지 못하는 것을 해결하는 것입니다."
- 이유:
  - Google Ads 반영/보고서 카드는 중요하지만 부차적이다.
  - 구매 전송 후보를 늘리려면 실제 구매가 어느 광고/버튼 클릭에서 왔는지를 복원해야 한다.
- Key Results:
  - NPay 결제완료 주문 중 자동 확정 연결률을 올린다.
  - ambiguous/unmatched 사유를 자동 분류한다.
  - Google click id가 있는 결제완료 후보를 안전하게 Google Ads 전송 장부로 넘긴다.
  - 전송 장부에서 `sent but not reflected` 사유를 자동 분류한다.

## 결정 12. NPay bridge v1.2는 원문 저장이 아니라 hash 연결 단서로 간다

- 날짜: 2026-05-30
- 상태: VM Cloud backend 배포와 smoke 완료, GTM Production publish 전
- 결정:
  - NPay bridge v1.2는 버튼 클릭 row와 실제 결제완료 주문을 다시 붙이기 위한 연결 단서를 추가한다.
  - 다만 원문 주문번호, 원문 NPay bridge token, 원문 click id를 저장하지 않고 서버에서 HMAC/hash 또는 presence flag로만 남긴다.
- 이유:
  - 지금 병목은 버튼 클릭 수집이 아니라, 네이버 외부 결제창을 지난 뒤 완료 주문을 원래 버튼 클릭 row와 안정적으로 붙이지 못하는 것이다.
  - 원문을 많이 저장하면 연결은 쉬워질 수 있지만, 보안/운영 리스크가 커진다.
  - 따라서 v1.2는 `일단 원문 저장 후 나중에 암호화`가 아니라, 처음부터 hash 연결로 간다.
- 적용된 backend 단서:
  - `npay_checkout_bridge_id_hash`
  - `imweb_order_code_hash`
  - `channel_order_no_hash`
  - `local_session_id_hash`
  - `cart_fingerprint_hash`
  - 장바구니/금액/stage 시각 단서
- smoke 결과:
  - VM Cloud SQLite에 v1.2 컬럼 8개가 생성됐다.
  - preview/test row 2건이 저장됐다.
  - hash 필드는 64자리로 저장됐다.
  - TEST click id는 `gclid`, `gbraid`, `wbraid` 정상 컬럼에 저장되지 않았다.
  - raw payload에는 TEST click id와 raw bridge/order prefix가 남지 않았다.
- 남은 결정:
  - GTM Preview에서 실제 브라우저 버튼 클릭 1건으로 v1.2 태그가 backend에 새 필드를 보내는지 확인해야 한다.
  - Preview 통과 전 GTM Production publish는 하지 않는다.

## 다음 설계 판단 대기

1. 자동 전송 limit을 5에서 10으로 올릴지
   - 선행 조건: sent-but-not-reflected 9건 원인 분류.
2. NPay bridge raw URL 저장 범위를 어디까지 허용할지
   - 선행 조건: 정책/보안 검토와 보고서 마스킹.
3. 실제 결제 테스트를 다시 할지
   - 선행 조건: read-only로 최신 48시간 병목 분류를 먼저 완료.
4. Google Ads 리포트 미반영 row를 어떤 기준으로 재시도/제외할지
   - 선행 조건: offline diagnostic summary와 click-age dry-run.
