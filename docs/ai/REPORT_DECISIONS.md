작성 시각: 2026-05-30 11:46 KST
기준일: 2026-05-30
문서 성격: 매출·광고비 리포트 프로젝트 설계 결정 기록

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
    - report/!report.md
    - report/reportcoffee.md
    - report/reportbiocom.md
  lane: Green for decision documentation
  allowed_actions:
    - local_decision_log_update
    - read_only_context_review
  forbidden_actions:
    - Slack send or schedule
    - operating DB write
    - VM Cloud deploy or restart
    - platform send or upload
    - GTM publish
    - secret or raw customer identifier output
  source_window_freshness_confidence:
    source: project reports + prior no-send and read-only checks
    window: mainly 2026-04-01 - 2026-05-29 KST
    freshness: 2026-05-30 local document state
    confidence: high for decisions, medium for live metrics until rerun
```

## 10초 요약

이번 리포트 프로젝트의 핵심 결정은 “한 source로 모든 매출을 합치지 않는다”는 것이다.

더클린커피는 자사몰, 스마트스토어, 쿠팡의 매출 기준이 서로 다르다. 바이오컴은 광고 ROAS 정합성과 자사몰 상품 수량 분석이 함께 진행된다. 따라서 Slack 보고서는 실제 결제완료 매출과 광고 플랫폼 주장값을 분리하고, 각 채널의 primary source와 warning을 함께 표시한다.

## 결정 1. 최종 보고는 Slack이지만, 실제 발송 전에는 no-send JSON을 정본으로 둔다

- 상태: 적용.
- 결정:
  - Slack 메시지는 마지막 출력 채널이다.
  - 실제 발송 전에는 반드시 JSON과 Markdown preview를 만든다.
- 이유:
  - 매출과 광고비는 source gap이 자주 생긴다.
  - 바로 Slack에 보내면 잘못된 숫자가 운영 판단에 들어갈 수 있다.
- 영향:
  - `report/reportcoffee-sales-summary-no-send-*.json` 같은 no-send 파일이 먼저 만들어져야 한다.
  - Slack send/schedule은 승인 전 금지다.

## 결정 2. 더클린커피부터 완성하고 바이오컴에 복사한다

- 상태: 적용.
- 결정:
  - 더클린커피를 먼저 주간/월간 리포트 v0.1 기준으로 닫는다.
  - 그 구조를 바이오컴에 확장한다.
- 이유:
  - 더클린커피는 자사몰, 스마트스토어, 쿠팡이 나뉘어 있어 리포트 구조를 검증하기 좋다.
  - 바이오컴은 Google Ads/NPay/Meta/Naver 정합성 이슈가 더 크므로 처음부터 합치면 판단이 흐려진다.

## 결정 3. 자사몰 매출은 complete_time 기준으로 본다

- 상태: 더클린커피 적용.
- 결정:
  - 더클린커피 자사몰 no-send 기준은 Imweb paid/order window + complete_time 존재 주문으로 잡는다.
- 이유:
  - 기존 자동 집계가 Excel보다 119,064원 낮았던 원인은 날짜/결제완료 기준 차이였다.
  - 2026-04-25 - 2026-05-01 자사몰은 complete_time 기준으로 5,334,362원이 되어 Excel과 일치했다.
- 주의:
  - complete_time을 NPay actual primary로 오해하면 안 된다.
  - 이 결정은 더클린커피 자사몰 weekly Excel 기준 재현용이다.
  - NPay actual 판단은 결제완료 source와 함께 봐야 한다.

## 결정 4. 스마트스토어는 PlayAuto warning 포함으로 먼저 운영한다

- 상태: 적용.
- 결정:
  - 더클린커피 스마트스토어 매출은 운영DB `tb_playauto_orders shop_name='스마트스토어'`를 primary 후보로 둔다.
  - 네이버 커머스API 권한이 닫히기 전까지 source warning을 붙인다.
- 이유:
  - `tb_naver_orders`와 `tb_sales_naver_vat`는 더클린커피가 아닌 바이오컴 상품 conflict가 확인됐다.
  - PlayAuto는 더클린커피 상품명 기준으로 재현 가능하다.
- 남은 조건:
  - 더클린커피 통합매니저 권한을 네이버로부터 받아야 커머스API direct source를 검증할 수 있다.

## 결정 5. 쿠팡 strict 매출은 revenue-history, 주문 발생 참고는 ordersheets로 나눈다

- 상태: 적용.
- 결정:
  - Slack strict 매출에는 TeamKeto `revenue-history` 매출인식 기준을 우선한다.
  - `ordersheets`는 주문 발생 참고값으로 둔다.
  - `settlement-histories`는 정산 대조값으로 둔다.
- 이유:
  - 쿠팡은 주문 발생일, 매출인식일, 정산일이 다를 수 있다.
  - F&B팀이 보는 판매 분석 화면과 Open API 값이 아직 완전히 일치하지 않는다.
- 남은 조건:
  - 판매 분석 화면 기준을 자동화하려면 Hermes 브라우저 다운로드가 필요할 수 있다.

## 결정 6. 쿠팡 판매 분석 화면 요약은 공식 API 불확실, Hermes 후보로 둔다

- 상태: 후보 결정.
- 결정:
  - 쿠팡 판매 분석 화면의 방문자, 조회, 장바구니, 구매전환율, 매출 요약을 Open API로 직접 받는 endpoint는 현재 확인하지 못했다.
  - F&B팀 기준과 정확히 맞추려면 Hermes가 판매 분석 화면 export를 받는 방식을 primary 후보로 둔다.
- 이유:
  - F&B팀 첨부 화면과 Open API 재현값 사이에 60,700원 / 2건 gap이 남았다.
  - 판매 분석 화면은 주문서/정산 API와 다른 집계 기준을 쓸 가능성이 있다.

## 결정 7. 네이버 성과형 디스플레이 광고비는 Hermes 브라우저 export로 보완한다

- 상태: 적용 가능.
- 결정:
  - 네이버 성과형 디스플레이 광고비, 예를 들어 `[ADVoost] 쇼핑`, 은 Hermes가 광고주센터 화면에서 XLSX를 다운로드한다.
  - 검색광고 API만으로 전체 네이버 광고비를 완성하려고 하지 않는다.
- 이유:
  - 성과형 디스플레이 광고 API는 공식 파트너사에 한해 제공된다.
  - 기존 Search Ad API는 `[ADVoost] 쇼핑` 비용을 가져오지 못했다.
- 증거:
  - Hermes가 더클린커피 2026-05-18 - 2026-05-24 `[ADVoost] 쇼핑` 비용 350,098원을 XLSX에서 확인했다.

## 결정 8. 네이버 브랜드검색 비용은 수동 계약 금액을 기간 배분한다

- 상태: 적용.
- 결정:
  - 더클린커피 브랜드검색 비용은 모바일 880,000원 + PC 660,000원 = 1,540,000원을 수동 계약 source로 둔다.
  - 바이오컴 브랜드검색도 수동 계약 금액을 기간 배분한다.
- 이유:
  - 브랜드검색 비용은 일반 캠페인 daily stats와 다르게 보일 수 있다.
  - API 계정 범위와 브랜드검색 source gap이 확인됐다.
- 주의:
  - 수동 계약 금액은 광고비 source다.
  - 네이버 플랫폼 전환매출은 내부 confirmed 매출과 합산하지 않는다.

## 결정 9. Hermes-Codex 공유는 GitHub private repo로 한다

- 상태: 적용.
- 결정:
  - `taejunjeon/hermes-codex-repo`를 command/result 공유 장부로 쓴다.
  - Telegram은 Hermes 실행 알림, GitHub는 원본/결과 기록, Slack은 최종 보고로 분리한다.
- 이유:
  - Slack/Telegram으로 원본 파일을 주고받으면 검증 기록이 흩어진다.
  - GitHub repo는 command, result, XLSX, screenshot의 변경 이력을 남긴다.
- 운영 판단:
  - 1분 polling runner는 지금 과하다.
  - 우선 TJ님 수동 호출 후 Hermes가 pull/execute/push하는 흐름을 유지한다.

## 결정 10. 바이오컴 자사몰 세트 분배는 수량만 먼저 나눈다

- 상태: 적용.
- 결정:
  - `report/reportbiocom-selfmall-product-quantity-set-split-20260529.html` v0에서는 매출은 원상품에 남기고, 구성품 수량만 별도 계산한다.
- 이유:
  - 매출까지 나누려면 정가, 실판매가, 수동 비율 기준을 정해야 한다.
  - 먼저 수량 분배를 고정하는 것이 운영 혼선을 줄인다.
- 다음 단계:
  - 원수량과 분배수량을 나란히 보여주는 dry-run을 만든다.

## 결정 11. 명확한 세트는 AI 자동 승인, 애매한 세트만 사람 검토한다

- 상태: 적용.
- 결정:
  - 3+1, 2인권, 3인권, 2개, 3개, 4개처럼 숫자와 구성품이 직접 보이는 세트는 자동 승인 후보로 둔다.
  - 분류 자신감 95% 이상은 사람이 굳이 누르지 않아도 된다.
  - 골라담기는 선택형 단품이므로 자동 제외한다.
  - 펫 영양중금속 한마리/두마리처럼 상품 운영 기준이 애매한 항목만 사람 검토로 둔다.
- 근거:
  - 2026년 4월 바이오컴 세트 후보 57개 중 자동 승인 46개, 자동 제외 9개, 사람 검토 2개로 분류됐다.
- 주의:
  - AI 자신감은 운영 반영 전 의사결정 보조값이다.
  - 실제 DB write나 매핑표 운영 반영은 별도 승인 후 진행한다.

## 결정 12. 교차구매는 세트 분배하지 않는다

- 상태: 적용.
- 결정:
  - 같은 주문에 검사권과 영양제가 함께 담겼더라도 같은 상품 줄의 옵션으로 묶인 증거가 없으면 교차구매로 본다.
  - 교차구매는 “같이 산 상품” 분석에 남기고, 세트 수량 분배에는 넣지 않는다.
- 이유:
  - 같은 주문에 함께 담겼다는 이유만으로 세트 구성품으로 쪼개면 상품 수량이 부풀 수 있다.
  - 세트 분배 대상은 같은 상품 줄 안의 옵션 묶음이다.

## 결정 13. 재구매율, LTV, CAC는 가능하지만 출력 규칙을 먼저 둔다

- 상태: 설계 대기.
- 결정:
  - 재구매율과 LTV 계산에는 내부 원본 식별자 사용이 가능하다.
  - 다만 보고서 출력에는 raw customer identifier를 내보내지 않는다.
- 이유:
  - 같은 고객 여부를 계산하려면 내부 식별자가 필요하다.
  - 외부 보고서에는 집계값만 있어도 충분하다.
- 다음 단계:
  - 연결 구현 후 해시화 전환 계획을 붙인다.

## 결정 14. 정적 HTML 보고서를 먼저 만들고, 운영 대시보드는 이후로 둔다

- 상태: 적용.
- 결정:
  - `report/*.html` 정적 보고서를 먼저 만든다.
  - 내부 사용자가 숫자/흐름을 이해한 뒤 필요하면 Next.js/운영 대시보드로 옮긴다.
- 이유:
  - 현재 핵심은 운영 판단을 위한 source 정리다.
  - 정적 HTML은 배포 없이 로컬에서 빠르게 검증할 수 있다.

## 다음 설계 판단 대기

1. 쿠팡 판매 분석 화면 기준을 Hermes primary로 올릴지.
   - 선행 조건: 2026-04-25 - 2026-05-01 판매 분석 export가 자동으로 재현되는지 확인.
2. 더클린커피 네이버 커머스API를 PlayAuto보다 상위 source로 올릴지.
   - 선행 조건: 통합매니저 권한과 더클린커피 앱 key/scope 확인.
3. 바이오컴 펫 영양중금속 한마리/두마리 분배 기준.
   - 선행 조건: 상품 운영 기준 확인.
4. Slack 실제 발송 cadence.
   - 선행 조건: no-send JSON과 Markdown preview가 2회 이상 같은 기준으로 PASS.

## Track 진척률

매출·광고비 리포트 프로젝트 기준:

- Track A 매출 원장 기준: 89% -> 89% (+0%)
- Track B 채널별 매출 수집: 100% -> 100% (+0%)
- Track C 광고비/ROAS 연결: 100% -> 100% (+0%)
- Track D 프론트엔드 의사결정 리포트: 86% -> 86% (+0%)
- Track E Slack/no-send 자동화: 100% -> 100% (+0%)
- Track F QA/Guard/문서화: 100% -> 100% (+0%)
