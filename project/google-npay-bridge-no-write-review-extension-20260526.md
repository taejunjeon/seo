# Google NPay bridge no-write 검토표 확장 - 2026-05-26

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
  lane: Green
  allowed_actions:
    - VM Cloud public API read-only
    - local report write
    - frontend report wording update
  forbidden_actions:
    - VM Cloud SQLite write
    - operational DB write
    - Google Ads conversion upload
    - Google Ads conversion action change
    - GTM publish
  source_window_freshness_confidence:
    source: https://att.ainativeos.net/api/google-ads/dashboard-summary?date_preset=last_7d
    window: Google Ads LAST_7_DAYS + NPay bridge live review window
    freshness: 2026-05-26 00:09 KST 조회
    confidence: high for aggregate counts, medium-high for row-level bridge grade before permanent snapshot
```

## 한 줄 결론

NPay 실제 결제완료 주문은 내부 매출로 봐야 하지만, Google Ads에 실제 구매로 보낼 후보는 아직 0건이다.

## 왜 이 표를 확장했나

Google Ads의 기존 `구매완료`는 이름만 보면 실제 구매처럼 보인다. 하지만 live API 기준 최근 7일 `구매완료` 전환값의 거의 전부가 `primary_known_npay`로 분류된다. 즉 Google Ads가 세는 구매 신호가 NPay 실제 결제완료만 세는 통로라고 보기 어렵다.

그래서 NPay 흐름을 세 칸으로 나눠 본다.

1. NPay 버튼 클릭/count: Google Ads가 현재 크게 세는 쪽으로 의심되는 신호.
2. NPay 실제 결제완료: 내부 매출에는 포함해야 하는 실제 주문.
3. Google Ads 전송 후보: 실제 결제완료이면서 Google click id와 중복 방지 근거가 갖춰진 주문.

## live no-write 요약

| 항목 | 값 | 해석 |
| --- | ---: | --- |
| NPay click intent | 254 | NPay 쪽으로 넘어가려 한 내부 로그 |
| NPay 실제 결제완료 | 20 | 내부 매출로 포함해야 하는 실제 주문 |
| 내부 bridge exact 후보 | 16 | 내부 보고서에서 같은 여정으로 볼 수 있는 후보 |
| A급 내부 후보 | 12 | 시간/금액/상품 근거가 비교적 강한 후보 |
| B급 수동 검토 | 4 | 구매는 맞을 수 있으나 자동 write에는 근거가 부족한 후보 |
| Google click id 포함 bridge | 1 | Google 클릭 증거가 있는 내부 검토 후보 |
| Google Ads 전송 후보 | 0 | 실제 Google Ads upload 후보 아님 |
| VM Cloud write | 0 | 영구 원장 반영 없음 |
| 운영DB write | 0 | 운영DB 변경 없음 |

## write 전 검토 기준

| 질문 | 통과하면 | 통과하지 못하면 |
| --- | --- | --- |
| 실제 결제완료인가 | 내부 매출 후보로 본다 | 버튼 클릭/결제 시작은 구매로 보지 않는다 |
| 주문과 클릭 시간이 붙는가 | 내부 bridge 후보로 본다 | B급 또는 ambiguous로 둔다 |
| 금액이 설명되는가 | A급 내부 후보로 볼 수 있다 | 자동 write하지 않는다 |
| Google click id가 있는가 | Google Ads 전송 검토를 시작할 수 있다 | 내부 분석 후보일 뿐 전송 후보가 아니다 |
| 영구 evidence snapshot이 있는가 | 이후 운영 판단 후보가 된다 | no-write 표에만 남긴다 |

## no-write row 검토표

주문번호와 외부 결제번호는 문서에는 일부 마스킹했다. 실제 row 확인은 VM Cloud read-only API 응답에서 한다.

| masked order | masked NPay order | 금액 | 상품 | 등급 | click id | campaign id | 보류 이유 |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 20260524…646467 | 20260524…1047480 | 39,000 | 바이오밸런스 90정 | B | 있음(gclid+gbraid) | 22018178848 | 시간 간격이 길어 자동 A 아님 |
| 20260525…801620 | 20260525…0453990 | 496,000 | 종합 대사기능&음식물 과민증 검사 Set | A | 없음 | 없음 | Google click id 없음 |
| 20260525…761319 | 20260525…3910790 | 35,000 | 뉴로마스터 60정 | A | 없음 | 없음 | Google click id 없음 |
| 20260525…770558 | 20260525…3211160 | 39,000 | 바이오밸런스 90정 | A | 없음 | 없음 | Google click id 없음 |
| 20260524…388870 | 20260524…1984490 | 39,000 | 바이오밸런스 90정 | A | 없음 | 없음 | Google click id 없음 |
| 20260522…438079 | 20260522…2291400 | 496,000 | 종합 대사기능&음식물 과민증 검사 Set | A | 없음 | 없음 | Google click id 없음 |
| 20260521…905505 | 20260521…4742690 | 56,400 | 팀키토 오리지널 도시락 | A | 없음 | 없음 | Google click id 없음 |
| 20260521…582168 | 20260521…7896240 | 39,000 | 썬화이버 프리바이오틱스 | A | 없음 | 없음 | Google click id 없음 |
| 20260521…334517 | 20260521…3745520 | 36,900 | 메타드림 식물성 멜라토닌 | A | 없음 | 없음 | Google click id 없음 |
| 20260520…540248 | 20260520…1185580 | 496,000 | 종합 대사기능&음식물 과민증 검사 Set | A | 없음 | 없음 | Google click id 없음 |
| 20260520…536308 | 20260520…0874970 | 28,800 | 리셋데이 | A | 없음 | 없음 | Google click id 없음 |
| 20260519…603303 | 20260519…1393460 | 39,000 | 바이오밸런스 90정 | A | 없음 | 없음 | Google click id 없음 |

## 판단

- 내부 bridge 후보는 확장됐다.
- A급 내부 후보는 실제 매출 분석에 도움이 된다.
- Google Ads에 전송할 수 있는 후보는 아직 0건이다.
- 기존 Google Ads `구매완료` Primary를 실제 결제완료로 읽으면 안 된다.
- 바로잡는 순서는 `no-send 후보 생성기 안정화 → 실제 결제완료 전용 전환 통로 설계 → 승인 후 Google Ads 전환 설정 조정`이다.

## 다음 할일

1. 프론트 보고서에서 `Google Ads 주장 구매`, `NPay 실제 결제완료`, `Google Ads 전송 후보`를 분리 표시한다.
2. B급 4건은 시간 간격/금액/상품 조합으로 더 좁히되, 자동 write하지 않는다.
3. 실제 결제완료 전용 no-send 후보 생성기는 Google Ads upload 후보 0건 유지 상태로 계속 실행한다.
