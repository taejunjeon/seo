# Google NPay bridge exact 검토표 - 2026-05-25

작성 시각: 2026-05-25 06:27 KST  
기준일: 2026-05-25  
문서 성격: no-write 검토표, Google ROAS 정합성 보강 메모

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
  required_context_docs:
    - data/!data_inventory.md
    - docurule.md
    - AGENTS.md
  lane: Green
  allowed_actions:
    - read-only dry-run review
    - frontend report display update
    - no-write candidate table
    - documentation
  forbidden_actions:
    - VM Cloud SQLite write/apply
    - operational DB write/import
    - Google Ads conversion upload
    - GA4/Meta/TikTok platform send
    - GTM publish
    - production deploy
  source_window_freshness_confidence:
    source:
      - VM Cloud SQLite snapshot: /tmp/seo-vm-crm-20260525T055307Z.sqlite3
      - /tmp/npay-roas-last48-20260525-after-bridge.json
      - operational_postgres.public.tb_iamweb_users read-only via npay-roas-dry-run
    window: 2026-05-23 09:00 KST ~ 2026-05-25 05:56 KST
    freshness: VM Cloud snapshot copied 2026-05-25 05:53 KST
    confidence: high for dry-run matching counts, medium for future write path until controlled write approval
```

## 10초 요약

최근 48시간 NPay 실제 결제완료 7건 중 6건은 NPay 버튼 클릭과 내부 주문 생성 시각이 거의 같아서 내부 bridge 후보로 볼 수 있다.

그중 Google 광고 click id가 같이 있는 후보는 1건이다. 다만 이 후보도 Google Ads에 바로 전송하지 않는다. 이유는 내부 연결 후보와 외부 광고 플랫폼 전송 후보의 기준이 다르기 때문이다.

이번 작업은 검토표만 만든 것이다. VM Cloud 원장 write, 운영DB write, Google Ads 전송은 0건이다.

## 쉬운 정의

### 내부 bridge 후보

우리 내부 보고서에서 “이 NPay 결제는 이 광고 클릭에서 이어졌을 가능성이 높다”고 볼 수 있는 후보다.

예를 들어 NPay 버튼을 13:40:55에 눌렀고 내부 주문이 13:40:56에 생성됐다면, 같은 행동으로 볼 근거가 강하다.

### Google Ads 전송 후보

Google Ads에 “이 주문은 실제 구매입니다”라고 보내도 되는 후보다.

이 후보가 되려면 내부 bridge만으로는 부족하다. Google Ads가 인정하는 click id, 실제 결제완료, 중복 방지, 취소/환불 guard까지 통과해야 한다.

## 현재 요약

| 항목 | 값 | 해석 |
|---|---:|---|
| NPay 실제 결제완료 주문 | 7건 | 최근 48시간 운영 주문 기준 |
| 내부 bridge exact 후보 | 6건 | NPay 클릭과 주문 생성이 거의 동시에 찍힘 |
| 내부 bridge exact + Google click id | 1건 | 내부 분석상 가장 중요한 진단 후보 |
| Google Ads 전송 후보 | 0건 | 직접 전송 기준은 아직 통과하지 않음 |
| 실제 write/apply | 0건 | 검토표만 작성, 원장 변경 없음 |

## no-write 검토표

raw gclid, gbraid, wbraid 값은 이 문서에 적지 않는다. 노출하는 것은 존재 여부와 판단뿐이다.

| 내부 주문번호 | NPay 주문번호 | 결제시각 KST | 상품/금액 | 내부 bridge 근거 | Google click id | 내부 판단 | Google Ads 전송 판단 |
|---|---|---|---|---|---|---|---|
| 202605230353959 | 2026052317893930 | 05.23 19:28 | resetday / 55,600원 | 주문 생성과 클릭 0분 차이 | 없음 | B급 bridge exact 후보 | 전송 불가 |
| 202605234503382 | 2026052320730980 | 05.23 22:05 | 바이오밸런스 / 39,000원 | 주문 생성 bridge 없음, 동점 후보 | 있음 | ambiguous 보류 | 전송 불가 |
| 202605242646467 | 2026052431047480 | 05.24 13:53 | 바이오밸런스 / 39,000원 | 주문 생성 13:40:56, 클릭 13:40:55.904, 0분 차이 | gclid+gbraid 있음 | B급 bridge exact 후보 | 전송 보류 |
| 202605242388870 | 2026052441984490 | 05.24 23:10 | 바이오밸런스 / 39,000원 | 주문 생성과 클릭 0분 차이 | 없음 | A급 bridge exact 후보 | 전송 불가 |
| 202605256770558 | 2026052543211160 | 05.25 00:28 | 바이오밸런스 / 39,000원 | 주문 생성과 클릭 0분 차이 | 없음 | A급 bridge exact 후보 | 전송 불가 |
| 202605258312977 | 2026052543224440 | 05.25 00:29 | 뉴로마스터 / 117,000원 | 주문 생성과 클릭 0.5분 차이 | 없음 | B급 bridge exact 후보 | 전송 불가 |
| 202605250761319 | 2026052543910790 | 05.25 01:48 | 뉴로마스터 / 35,000원 | 주문 생성과 클릭 0분 차이 | 없음 | A급 bridge exact 후보 | 전송 불가 |

## 7일 확장 no-write 후보표 - 분석 알고리즘 v2 기준

추가 작성 시각: 2026-05-25 06:54 KST  
추가 기준점: 2026-05-25 06:30 KST, 분석 알고리즘 v2  
추가 source: `/tmp/seo-vm-crm-20260525T055307Z.sqlite3` + 운영DB read-only + `buildNpayIntentRematchDryRunReport`  
추가 window: 2026-05-18 00:00 KST ~ 2026-05-25 06:45 KST  
산출물: `/tmp/npay-rematch-7d-20260525-v2-vm.json`

이번 7일 확장은 영구 원장에 쓰기 전 검토 범위를 넓힌 것이다. 기존 48시간보다 더 많은 NPay 실제 결제완료 주문을 같은 기준으로 다시 봤다.

| 항목 | 값 | 해석 |
|---|---:|---|
| NPay click intent | 256건 | NPay 버튼/외부 결제 진입으로 잡힌 클릭 의도 |
| NPay 실제 결제완료 주문 | 23건 | 운영DB 기준 취소/환불 제외 |
| 내부 bridge strong match | 20건 | 주문 생성 시각과 NPay 클릭 시각이 강하게 맞음 |
| A급 후보 | 13건 | 내부 원장 write 후보로 가장 강한 묶음, 아직 write 안 함 |
| B급 후보 | 7건 | 내부 원인 진단/수동 검토용 |
| ambiguous | 3건 | 후보가 애매하므로 원장 반영 금지 |
| strong match + Google click id | 1건 | 내부 분석상 중요한 Google 후보 |
| Google Ads 전송 후보 | 0건 | 플랫폼 전송은 여전히 금지 |

### 7일 후보 상세

| 내부 주문번호 | NPay 주문번호 | 결제시각 KST | 상품/금액 | bridge 등급 | Google click id | 추천 액션 | 보류 이유 |
|---|---|---|---|---|---|---|---|
| 202605250761319 | 2026052543910790 | 05-25 01:48 | 뉴로마스터 60정 (1개월분) / 35,000원 | A / score 115 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id |
| 202605258312977 | 2026052543224440 | 05-25 00:29 | 뉴로마스터 60정 (1개월분) / 117,000원 | B / score 85 / exact / 0.5분 | 없음 | review_but_no_google_click_id | missing_google_click_id, not_grade_a_auto_apply |
| 202605256770558 | 2026052543211160 | 05-25 00:28 | 바이오밸런스 90정 (1개월분) / 39,000원 | A / score 115 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id |
| 202605242388870 | 2026052441984490 | 05-24 23:10 | 바이오밸런스 90정 (1개월분) / 39,000원 | A / score 115 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id |
| 202605242646467 | 2026052431047480 | 05-24 13:53 | 바이오밸런스 90정 (1개월분) / 39,000원 | B / score 105 / exact / 0분 | 있음 | manual_review_before_apply | not_grade_a_auto_apply |
| 202605230353959 | 2026052317893930 | 05-23 19:28 | 리셋데이 글루텐분해효소 알파CD 차전자피 K-낙산균 / 55,600원 | B / score 95 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id, not_grade_a_auto_apply |
| 202605228438079 | 2026052292291400 | 05-22 22:50 | 종합 대사기능&음식물 과민증 검사 Set / 496,000원 | A / score 115 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id |
| 202605219905505 | 2026052154742690 | 05-21 13:48 | 팀키토 오리지널 도시락 8종 골라담기 / 56,400원 | A / score 113 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id |
| 202605211582168 | 2026052147896240 | 05-21 10:01 | 썬화이버 프리바이오틱스 식이섬유 210g / 39,000원 | A / score 115 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id |
| 202605210716586 | 2026052144855420 | 05-21 07:36 | 혈당관리엔 당당케어 (120정) / 116,000원 | B / score 95 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id, not_grade_a_auto_apply |
| 202605217334517 | 2026052143745520 | 05-21 04:15 | 메타드림 식물성 멜라토닌 함유 / 36,900원 | A / score 115 / exact / 0.4분 | 없음 | review_but_no_google_click_id | missing_google_click_id |
| 202605206540248 | 2026052041185580 | 05-20 23:14 | 종합 대사기능&음식물 과민증 검사 Set / 496,000원 | A / score 105 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id |
| 202605205536308 | 2026052040874970 | 05-20 23:00 | 리셋데이 글루텐분해효소 알파CD 차전자피 K-낙산균 / 28,800원 | A / score 115 / exact / 0.1분 | 없음 | review_but_no_google_click_id | missing_google_click_id |
| 202605206547345 | 2026052039655910 | 05-20 22:12 | 메타드림 식물성 멜라토닌 함유 / 36,900원 | B / score 105 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id, not_grade_a_auto_apply |
| 202605193603303 | 2026051911393460 | 05-19 22:22 | 바이오밸런스 90정 (1개월분) / 39,000원 | A / score 115 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id |
| 202605196437861 | 2026051984836610 | 05-19 11:52 | 바이오밸런스 90정 (1개월분) / 117,000원 | B / score 95 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id, not_grade_a_auto_apply |
| 202605185126210 | 2026051869086970 | 05-18 20:09 | 메타드림 식물성 멜라토닌 함유 / 36,900원 | A / score 115 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id |
| 202605185373854 | 2026051851868490 | 05-18 10:41 | 뉴로마스터 60정 (1개월분) / 35,000원 | A / score 115 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id |
| 202605186184009 | 2026051851084110 | 05-18 10:19 | 다빈치랩 메가프로바이오틱 ND120 40일분 / 122,000원 | A / score 113 / exact / 0분 | 없음 | review_but_no_google_click_id | missing_google_click_id |
| 202605189782460 | 2026051849371110 | 05-18 09:24 | 풍성밸런스 90정 (1개월분) / 117,000원 | B / score 95 / exact / 0.1분 | 없음 | review_but_no_google_click_id | missing_google_click_id, not_grade_a_auto_apply |

### 7일 확장 판단

NPay bridge 후보는 내부 매출 해석에는 도움이 된다. 23건 중 20건이 strong match라서 “NPay 실제 구매가 내부 주문과 이어진다”는 쪽은 꽤 강하다.

하지만 Google Ads에 보낼 후보는 여전히 0건이다. 대부분 `missing_google_click_id`이고, Google click id가 있는 1건도 B급이라 자동 전송 후보로 올리지 않는다.

따라서 분석 알고리즘 v2에서는 아래 기준을 유지한다.

```text
내부 bridge 후보: 내부 보고서/원인 분석에 사용
Google Ads 전송 후보: 직접 click id + A급 + 중복 방지 통과 전까지 0건
```

## 왜 1건이 있는데도 Google Ads 전송 후보는 0건인가

TJ님 테스트 주문 202605242646467은 Google click id가 있고, NPay 클릭과 주문 생성도 0분 차이다.

하지만 이 주문은 현재 B급이다. B급은 내부 원인 분석에는 쓸 수 있지만 외부 광고 플랫폼 전송에는 쓰지 않는다. GA4 중복 여부도 아직 unknown으로 남아 있다.

따라서 화면과 문서에서는 아래처럼 분리한다.

```text
내부 bridge exact 후보: 6건
그중 Google click id 있는 후보: 1건
Google Ads 전송 후보: 0건
```

## 다음 판단

내부 bridge 후보는 Google ROAS 차이를 설명하는 데 도움이 된다. 특히 “NPay 실제 구매는 있는데 Google click id가 결제완료 row에 직접 안 남는다”는 병목을 보여준다.

하지만 Google Ads에 실제 구매 전환을 보내려면 별도 단계가 필요하다.

1. bridge exact 후보를 영구 원장에 남길지 승인한다.
2. raw click id 저장/보존 정책을 정한다.
3. GA4 중복 여부를 robust하게 닫는다.
4. 전송 후보를 no-send preview로 만든다.
5. Google Ads 전송은 Red Lane 승인 전까지 계속 0건으로 유지한다.

## No-Send / No-Write 확인

| 항목 | 결과 |
|---|---|
| No-send verified | YES |
| No-write verified | YES |
| No-deploy verified | YES |
| No-publish verified | YES |
| No-platform-send verified | YES |
