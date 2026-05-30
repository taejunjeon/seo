# Google Ads NPay 버튼 전환값 축소와 실제 구매 후보율 확대 계획 - 2026-05-27

작성 시각: 2026-05-27 11:11 KST
실행 업데이트: 2026-05-27 11:22 KST
Smoke 업데이트: 2026-05-27 16:19 KST
후보율 확대 업데이트: 2026-05-27 17:43 KST
VM Cloud 배포/재조회 업데이트: 2026-05-27 18:16 KST
기준일: 2026-05-27
문서 성격: Google Ads 실제 구매 전용 주 전환 운영을 위한 설계/승인 문서

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
  required_context_docs:
    - docurule.md
    - data/!data_inventory.md
  lane: Yellow/Red split
  allowed_actions:
    - Google Ads API read-only 조회
    - Google Ads API validate-only 변경 검증
    - VM Cloud API read-only 조회
    - 로컬 no-send 후보 생성기 보강
    - 문서/승인안 작성
  forbidden_actions_without_tj_approval:
    - Google Ads 전환 액션 실제 설정 변경
    - Google Ads 실제 전환 업로드
    - VM Cloud write/deploy/dispatcher ON
    - 운영DB write/import
  source_window_freshness_confidence:
    google_ads_api:
      window: today, last_7d
      freshness: 2026-05-27 11:06 KST 조회
      confidence: high
    vm_cloud_api:
      window: today, last_7d, analysis_v2
      freshness: 2026-05-27 11:04~11:06 KST 조회
      confidence: high
```

## 10초 요약

NPay 버튼 클릭/결제진입은 실제 구매가 아니다. 그래서 Google Ads에서 구매처럼 큰 금액으로 보이면 안 된다.

현재 `BI confirmed_purchase_offline`은 실제 결제완료 주문만 Google Ads에 알려주는 주 전환 통로로 작동하기 시작했다. 반면 `NPay 버튼 클릭/결제진입(보조)`는 입찰 학습에는 쓰지 않는 보조 신호지만, `모든 전환 가치`에는 여전히 큰 금액을 만들 수 있다.

2026-05-27 11:22 KST에 TJ님 승인 후 `NPay 버튼 클릭/결제진입(보조)` 전환값을 고정 1,000원으로 변경했다. 실제 구매 주 전환에는 손대지 않았다.

2026-05-27 12:15 KST에 TJ님이 뉴로마스터 NPay 버튼 클릭 smoke를 실행했다. 2026-05-27 16:19 KST Google Ads API 재조회에서 12시대 `NPay 버튼 클릭/결제진입(보조)`가 1건, 1,000원으로 확인됐다.

따라서 다음 조치가 맞다.

1. `NPay 버튼 클릭/결제진입(보조)`의 전환값을 고정 소액으로 낮춘다. 완료.
2. 실제 구매완료 후보는 `직접 gclid 보존 후보`와 `NPay bridge A급 후보`로 나눠 더 넓게 찾는다.
3. NPay bridge 후보는 아직 Google Ads에 보내지 않는다. 영구 bridge 장부, 중복 방지, 환불/취소 guard가 먼저 필요하다.

2026-05-27 17:43 KST 로컬 후보율 확대 보강을 추가했다. 이제 NPay bridge A급 후보를 `직접 click id 있음`, `같은 브라우저/GA 세션의 직전 Google 클릭 원장에서 click id 복구`, `아직 click id 없음`으로 분리한다. 복구 후보는 no-send 발견 후보이며, Google Ads에 바로 보내는 후보가 아니다.

2026-05-27 18:12 KST TJ님 승인 후 VM Cloud backend에 단일 파일 배포했다. live API 재조회 결과, NPay bridge A급 12건은 모두 여전히 Google click id가 없었다. 같은 세션에서 Google click id가 복구된 후보 1건은 있었지만 금액이 맞지 않아 B급으로 남았다.

## 현재 숫자

Source: Google Ads API live, VM Cloud live API
조회 시각: 2026-05-27 11:04~11:06 KST
site: biocom
confidence: high

### Google Ads 오늘 기준

- 광고비: 231,885원
- 주 전환수: 0
- 주 전환가치: 0원
- 모든 전환수: 23
- 모든 전환가치: 3,572,900원

해석: 오늘 현재 Google Ads의 입찰 학습에는 실제 구매 전환이 아직 0건이다. 하지만 보조 전환까지 포함한 `모든 전환가치`는 크게 잡힌다. 이 값은 예산 판단용 실제 매출로 보면 안 된다.

### Google Ads 최근 7일 기준

- `BI confirmed_purchase_offline`: 3건, 305,900원, Primary 전환
- `NPay 버튼 클릭/결제진입(보조)`: 보조 전환이지만 최근 7일 모든 전환가치 38,379,807원
- 삭제된 `TechSol - NPAY구매 50739`: 과거 잔여 지표가 모든 전환에 남아 있음

해석: 실제 구매 주 전환은 시작됐다. 다만 과거/보조 NPay 신호가 리포트 숫자를 크게 흔든다.

### 실제 구매 후보율

VM Cloud candidate expansion 기준:

- 최근 7일 실제 결제완료 주문: 505건
- 실제 결제완료 매출: 122,362,994원
- 현재 바로 전송 가능한 직접 gclid 후보: 4건
- 현재 직접 후보율: 0.8%

로컬 코드 보강 방향:

- 기존: 직접 gclid/gbraid/wbraid 보존 후보만 계산
- 1차 보강: `NPay 실제 결제완료 + 내부 bridge A급 + Google click id` 후보를 별도 no-write 후보로 추가 계산
- 2차 보강: NPay intent row 자체에는 click id가 없어도, 같은 브라우저/GA 세션의 직전 Google 클릭 원장에서 click id 흔적을 복구할 수 있는지 별도 계산

중요: 이 후보는 발견용이다. 아직 Google Ads 전송 후보가 아니다.

## NPay 버튼 전환값 축소 설계

### 목적

NPay 버튼 클릭은 고객이 구매를 시작했다는 신호다. 실제 결제완료가 아니다. 그래서 이 이벤트에 상품 가격이나 결제금액을 그대로 붙이면 Google Ads 화면에서 매출처럼 보이는 문제가 생긴다.

### 추천 설정

대상 전환 액션:

- 이름: `NPay 버튼 클릭/결제진입(보조)`
- Google Ads conversion action id: `7130249515`
- 현재 역할: Secondary 전환, 즉 입찰에는 쓰지 않고 관찰만 하는 보조 신호

추천 변경:

- 값: 항상 기본값 사용
- 기본값: 1,000원

이유:

- 0원으로 만들면 퍼널 신호의 상대 강도를 전혀 못 본다.
- 실제 상품/결제금액을 쓰면 구매 매출처럼 보인다.
- 1,000원은 “구매 의향은 있지만 구매완료는 아님”을 표현하는 보조 점수로 적당하다.

더 보수적인 대안:

- 기본값 1원
- 완전히 진단용으로만 볼 때 적합하다.
- 추천도는 1,000원보다 낮다. 화면에서 신호가 너무 작아져 추세 해석이 어려워질 수 있다.

## API 실행 가능성 및 실행 결과

Google Ads API validate-only로 확인했다.

결과:

- HTTP status: 200
- validate-only: true
- 제안값: `defaultValue=1000`, `alwaysUseDefaultValue=true`
- 실제 변경: 하지 않음

판단:

Codex가 API로 전환값 축소를 실행할 수 있다. 실제 실행은 Google Ads 계정 설정 변경이므로 Red Lane이며, TJ님 승인 후 실행했다.

실행 결과:

- 실행 시각: 2026-05-27 11:22 KST
- 대상: `NPay 버튼 클릭/결제진입(보조)`
- action id: `7130249515`
- 변경 전: 기본값 1원, 항상 기본값 사용 false
- 변경 후: 기본값 1,000원, 항상 기본값 사용 true
- 상태: ENABLED 유지
- 역할: Secondary 전환 유지
- Primary 전환 여부: false 유지
- API 결과: HTTP 200
- 확인: 변경 직후 Google Ads API 재조회에서 `defaultValue=1000`, `alwaysUseDefaultValue=true`

Smoke 결과:

- smoke 시각: 2026-05-27 12:15 KST
- 상품: 뉴로마스터
- API 재조회 시각: 2026-05-27 16:19 KST
- 12시대 row: 1건, 1,000원
- 캠페인: `[PM]건기식 실적최대화`
- Primary 전환수: 0 유지
- 판정: 성공. NPay 버튼 클릭 보조 신호가 1,000원 단위로 들어오는 것을 확인했다.

주의:

- 13시대에는 4건, 120,000원이 별도로 보였다. 이는 설정 변경 전후의 지연 반영 또는 다른 NPay 버튼 이벤트가 섞인 값으로 보인다.
- 그래서 전체 일자 delta만 보면 1,000원 단위로 깔끔하게 떨어지지 않는다.
- smoke 판단은 TJ님 클릭 시간과 맞는 12시대 row를 기준으로 한다.

## 실제 구매 후보율 확대 설계

### 지금 낮은 이유

Google click id는 유입과 결제 전 단계에서는 잡힌다. 하지만 결제완료 주문 row까지 직접 붙는 비율이 낮다.

분석 v2 기준:

- 유입/클릭 단계: Google click id 포착률 높음
- 결제 시작 단계: 일부 유지
- 결제완료 단계: 직접 보존률 약 1%대
- NPay intent: click id는 많이 있으나, 실제 주문번호와 영구 연결된 장부가 아직 약함

### 후보를 넓히는 방법

1. 직접 후보
   - 실제 결제완료 주문 row에 gclid/gbraid/wbraid가 직접 있는 경우
   - Google Ads 전송 후보로 가장 안전하다.

2. NPay bridge A급 후보
   - NPay 외부 결제완료와 내부 click id 기록을 강한 기준으로 연결한 경우
   - 내부 분석 후보로는 강하다.
   - Google Ads 전송 후보가 되려면 영구 bridge 장부, 중복 방지, 환불/취소 guard가 필요하다.

3. B급/시간창 후보
   - 참고용이다.
   - Google Ads 전송 후보로 쓰면 안 된다.

## VM Cloud 배포 후 live 판정 - 2026-05-27 18:16 KST

Source: VM Cloud live API `https://att.ainativeos.net`
window: Google Ads dashboard last_7d = 2026-05-20 ~ 2026-05-26 KST
freshness: `/health` ok, `seo-backend` online, candidate expansion source status fresh
confidence: high

배포:

- 배포 범위: `/home/biocomkr_sns/seo/repo/backend/src/routes/googleAds.ts` 단일 파일
- remote backup: `.deploy-backups/google-ads-npay-bridge-20260527T181243/googleAds.ts.before`
- VM 검증: `npm run typecheck` 통과, `npm run build` 통과, `pm2 restart seo-backend --update-env` 완료

live candidate expansion:

- 최근 7일 실제 결제완료 주문: 505건
- 실제 결제완료 매출: 122,362,994원
- 직접 gclid 후보: 4건 / 545,900원
- NPay bridge A급 + 직접 Google click id: 0건
- NPay bridge A급 + 같은 세션 Google click id 복구: 0건
- NPay bridge A급이지만 click id 복구 필요: 12건
- Google Ads 전송 후보: 0건 유지

live NPay bridge review:

- NPay live intent: 248건
- 실제 NPay 결제완료 주문: 22건
- 내부 strong bridge 후보: 17건
- 내부 exact bridge 후보: 17건
- A급 bridge: 12건
- B급 bridge: 5건
- 같은 세션에서 Google click id가 복구된 후보: 1건
- 하지만 이 1건은 B급이다. 금액이 맞지 않아 Google Ads 전송 후보로 올리지 않는다.

해석:

NPay bridge A급 12건은 주문 연결 자체는 강하다. 이유는 아래 3개가 동시에 맞기 때문이다.

1. NPay 버튼 클릭 후 결제완료까지 걸린 시간이 매우 짧다. 표본은 대부분 0.2분~1.5분이다.
2. VM Cloud `imweb_orders`의 주문 생성 시각과 NPay intent 후보의 결제 흐름 시각이 exact로 붙는다.
3. 결제 금액이 최종 결제금액, 배송비 포함 금액, 수량 조합, bundle 조합 중 하나로 맞는다.

그러나 Google Ads 전송 후보가 아닌 이유는 `gclid`, `gbraid`, `wbraid` 중 하나가 필요하기 때문이다. A급 12건은 NPay intent row에도 없고, 같은 브라우저/GA 세션의 직전 Google 클릭 원장에서도 찾지 못했다.

특히 A급 중 일부는 `utm_campaign=googleads_shopping_supplements_biobalance`처럼 Google Ads로 보이는 UTM이 있다. 하지만 UTM은 “광고 캠페인 이름 힌트”일 뿐이고, Google Ads offline conversion에 필요한 click id가 아니다. UTM만으로 Google에 전환을 보내면 잘못된 주문을 Google 광고 클릭으로 붙일 위험이 있다.

따라서 현재 결론은 다음과 같다.

- 실제 NPay 구매 연결 알고리즘은 잘 작동한다.
- Google Ads에 보낼 수 있는 click id evidence는 아직 부족하다.
- 후보율 확대의 다음 병목은 NPay bridge 자체가 아니라, Google click id가 NPay intent 또는 같은 세션 원장에 남지 않는 문제다.

## 로컬 구현 내용

파일:

- `/Users/vibetj/coding/seo/backend/src/routes/googleAds.ts`

변경 요약:

- `NPay bridge A급 + Google click id` 후보 수와 금액을 candidate expansion 응답에 추가
- `NPay bridge A급 + 같은 세션/클라이언트에서 복구한 Google click id` 후보 수와 금액을 candidate expansion 응답에 추가
- bridge review row에 click id 증거 출처를 분리
  - `intent_direct`: NPay 버튼 클릭 intent row 자체에 click id가 남음
  - `paid_click_intent_same_client_session`: 같은 브라우저/GA 세션의 직전 Google 클릭 원장에서 찾음
  - `site_landing_same_client_session`: 같은 브라우저/GA 세션의 랜딩 원장에서 찾음
  - `none`: 아직 찾지 못함
- 실제 전송 후보와 discovery 후보를 분리
- `uploadCandidateCount`와 `sendCandidateCount`는 계속 0으로 유지
- 원문 주문번호, 원문 click id는 응답에 노출하지 않음

검증:

- `cd backend && npm run typecheck` 통과
- 로컬 API smoke 통과: `/api/google-ads/confirmed-purchase/candidate-expansion`가 신규 field를 포함해 정상 응답

주의:

- 로컬 API 숫자는 운영 판단값이 아니다. 로컬 DB와 VM Cloud SQLite의 freshness/source가 다르기 때문이다.
- 실제 후보율 판단은 VM Cloud 배포 후 `att.ainativeos.net` live API로 다시 봐야 한다.

운영 반영:

- 아직 VM Cloud에 배포하지 않음
- 아직 Google Ads 전송/설정 변경 없음
- 아직 VM Cloud write 없음

## 실행 승인안

### 승인안 A. NPay 버튼 전환값 축소

TJ님이 승인했고 Codex가 Google Ads API로 아래 변경을 실행했다.

- 대상: `NPay 버튼 클릭/결제진입(보조)`
- 변경: 항상 기본값 사용
- 기본값: 1,000원

성공 기준:

- Google Ads API에서 해당 전환 액션의 value setting이 1,000원 고정으로 조회된다. 완료.
- 이후 NPay 버튼 클릭 smoke에서 보조 전환값이 상품/결제금액이 아니라 1,000원 단위로 잡힌다.
- Primary 전환인 `BI confirmed_purchase_offline`에는 영향이 없다.

실패 시 확인점:

- Google Ads API 권한
- conversion action 소유 계정
- cross-account conversion tracking
- UI 수동 변경 필요 여부

### 승인안 B. 실제 구매 후보율 확대 API 배포

TJ님이 승인하면 Codex가 VM Cloud backend 배포를 진행한다.

성공 기준:

- `/api/google-ads/confirmed-purchase/candidate-expansion` 응답에 `npayBridgeGradeAWithGoogleClickIdRows`가 표시된다.
- 보고서에서 `바로 전송 후보`와 `내부 bridge 발견 후보`가 분리된다.
- Google Ads 실제 전송은 여전히 0건이다.

실패 시 확인점:

- VM Cloud 배포 로그
- 타입체크/빌드 실패
- API route 캐시
- source freshness gap

## 하지 않은 것

- 실제 구매 주 전환인 `BI confirmed_purchase_offline` 변경 없음
- Google Ads 전환 upload 없음
- VM Cloud write 없음
- 운영DB write 없음
- VM Cloud 배포 없음
- raw order id, raw click id 문서 노출 없음

## 다음 판단

지금 가장 빠른 개선은 NPay 버튼 전환값을 낮추는 것이다. 이 작업은 실제 구매 주 전환에는 영향을 주지 않고, Google Ads 리포트에서 “보조 NPay 신호가 매출처럼 보이는 문제”를 줄인다.

실제 구매 후보율 확대는 더 중요하지만 한 단계 더 길다. NPay bridge 후보를 영구 장부로 확정하고, 중복/환불 guard를 붙인 뒤에만 Google Ads 전송 후보로 올려야 한다.
