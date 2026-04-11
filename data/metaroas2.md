결론부터 말하면, **이번 문서는 이전보다 훨씬 좋아졌고, 지금 단계에서 대표용 판단 문서로 쓸 만한 수준에 거의 왔습니다.**
특히 `Meta ROAS = 플랫폼 귀속 가치`, `Attribution confirmed ROAS = 내부 확정 매출 기준`을 분리한 점, 그리고 **운영 메인값은 7일-14일 confirmed 기준**이라고 못 박은 점은 맞습니다. 이 방향은 유지하는 게 맞습니다.

다만 아직 **“문서의 논리”는 좋아졌는데, “증빙 파일 체인”은 덜 닫혔습니다.**
즉, 문서 안의 2026-04-10 수치와 현재 첨부 raw JSON이 아직 완전히 같은 세트를 이루지 않습니다. 그래서 지금 제 평가는:

* **논리/해석**: 좋음
* **운영 판단용 문장**: 거의 합격
* **감사용 증빙 체인**: 아직 보강 필요

입니다.

## 10초 요약

* **좋은 점**: 지금은 어떤 숫자를 믿고, 어떤 숫자를 참고만 해야 하는지가 분명합니다.
* **남은 문제**: 2026-04-10 업데이트 숫자를 뒷받침하는 **동일 시점 raw JSON/스크린샷/Ads Manager 조건값**이 아직 같이 묶여 있지 않습니다.

---

## 가장 좋았던 점 4가지

### 1) 정의를 드디어 제대로 갈랐습니다

이 문서의 가장 큰 장점은 이겁니다.

* `Meta purchase ROAS`
* `Attribution confirmed ROAS`
* `Attribution confirmed+pending ROAS`
* `best-case ceiling`

이 4개를 서로 다른 개념으로 분리했습니다.
이게 안 되면 대시보드가 숫자만 화려하고 의사결정에는 독이 됩니다. 지금 문서는 그 함정을 많이 피했습니다.

### 2) 운영 메인값을 7일-14일로 제한한 판단이 맞습니다

30일-90일은 rollout / cutover bias가 섞인다고 명시했고, 기본 운영 판단은 7일-14일 confirmed 중심으로 두라고 쓴 건 맞습니다. 이건 현실적입니다. 30일 `0.23x`를 헤드라인으로 쓰면 팀이 쓸데없이 비관적으로 흔들릴 수 있습니다.

### 3) Meta 측정 방식 설명이 실무적으로 충분히 정확합니다

`purchase_roas`, `website_purchase_roas`, `action_values`, `action_report_time=conversion`, `use_unified_attribution_setting=true`까지 정리한 건 좋습니다.
특히 “Meta 분자는 PG 확정 매출이 아니라 Meta가 광고에 귀속한 conversion value”라는 문장은 지금 프로젝트에서 제일 중요한 문장 중 하나입니다.

### 4) 액션 순서가 좋아졌습니다

지금 문서의 체크리스트는 우선순위가 맞습니다.

1. 날짜축/광고비 축 맞추기
2. raw snapshot 저장
3. Ads Manager export/timezone 대조
4. dedup 점검
5. alias matcher는 그다음

이 순서가 맞습니다. alias는 drill-down 문제를 풀고, 현재 headline ROAS 격차의 핵심은 측정 정의와 event 품질입니다.

---

## 아쉬운 점 5가지

### 1) 2026-04-10 수치와 첨부 raw가 아직 같은 세트로 안 묶여 있습니다

문서 본문은 2026-04-10 재측정 기준으로:

* spend `₩27,842,245`
* confirmed revenue `₩25,551,740`
* pending `₩1,358,700`
* Meta purchase value `₩123,904,111`
* confirmed ROAS `0.92x`
* Meta purchase ROAS `4.45x`

라고 적고 있습니다.

그런데 지금 대화에 첨부된 raw JSON은 여전히 2026-04-09 기준 old snapshot이라:

* site-summary spend `₩27,727,240`

* confirmed revenue `₩22,141,040`

* Meta purchase value `₩121,715,603`

* daily spend 합계 `₩23,563,530`

* confirmed revenue `₩22,141,040`

* Meta purchase value `₩100,339,759`

로 보입니다.

즉, 문서는 “맞춰졌다”고 말하는데, 첨부 raw는 아직 “안 맞던 상태”입니다.
이건 논리의 문제가 아니라 **증빙 체인 문제**입니다.

**피드백**:
문서에 적은 최신 숫자와 완전히 같은 시점의 raw JSON 3개를 반드시 같이 묶어야 합니다.

* `ads_site_summary_last7d_20260410.json`
* `ads_roas_daily_biocom_last7d_20260410.json`
* `meta_insights_biocom_last7d_20260410.json`

이 3개가 없으면, 문서의 “95% 완료”는 설득력은 있어도 감사 가능성은 약합니다.

---

### 2) `best-case ceiling` 이름은 아직 오해 소지가 있습니다

문서도 “잠정 ceiling”이라고 표현하는 편이 안전하다고 적었고, 그 판단이 맞습니다.

`best-case ceiling`은 너무 “좋은 경우”처럼 들립니다.
실제로는:

* Meta 기여 매출이 아니라
* 사이트 전체 confirmed 매출 상한선 성격이고
* 아직 Ads Manager export/timezone과 최종 대조 전입니다.

**추천 이름**

* `provisional ceiling`
* `site confirmed ceiling`
* `잠정 상한선`

이 중 하나가 낫습니다.

---

### 3) `campaign drill-down 20%`는 꽤 위험 신호인데 문서에서 상대적으로 부드럽게 지나갑니다

문서에 따르면:

* `last_7d` 기준 `90건 / ₩25,551,740`가 전부 `(unmapped)`입니다.

이건 그냥 “조금 덜 예쁘다” 수준이 아니라,
**캠페인별 Attribution ROAS는 아직 사실상 의사결정 금지** 상태라는 뜻입니다.

지금 문서도 이 점을 알고는 있는데, 대표가 읽을 때는 이 문장을 더 강하게 써야 합니다.

추천 문장:

> “사이트 전체 Attribution ROAS는 사용 가능하나, 캠페인별 Attribution ROAS는 아직 운영 판단값으로 사용 금지.”

---

### 4) Pixel/CAPI dedup 이슈는 더 위로 올려야 합니다

문서에 따르면 CAPI log 200개 샘플에서:

* `2xx 성공 200개`
* `unique event_id 102개`
  라고 적혀 있습니다.

이건 매우 중요합니다.
물론 “과거 테스트 / 재시도 / 실제 중복 전송”이 섞였을 수 있으니 바로 결론 내리면 안 되지만, **지금 Meta purchase 과대 가능성의 매우 유력한 후보**입니다.

그런데 현재 문서 구조상 이 이슈는 중간쯤 숨어 있습니다.
제 생각에는 이건 아래 3개와 같은 급입니다.

* spend/date 축
* GTM payment page 오류
* Pixel/CAPI dedup

즉 **Top 3 blocker**로 올리는 게 맞습니다.

---

### 5) 현재 문서는 “좋은 해석 문서”이지 “최종 의사결정 메모”는 아닙니다

이건 나쁜 뜻이 아닙니다. 오히려 문서가 좋아져서 생긴 문제입니다.

지금 문서는

* 정의 설명
* 공식 의미
* 운영 적용
* 왜곡 가능성
* 체크리스트
  까지 잘 들어가 있습니다.

그런데 CEO 입장에서는 마지막에 **딱 3줄**이 더 필요합니다.

예를 들면:

* **지금 메인으로 볼 숫자**: 최근 7일 Attribution confirmed 0.92x
* **지금 무시해야 할 숫자**: 30일 0.23x headline
* **지금 가장 위험한 리스크**: Meta dedup / GTM 오류 / `(unmapped)` 100%

이 3줄이 없으면, 문서가 좋아도 회의 때 다시 길어집니다.

---

## 제 최종 판단

지금 문서 기준 판단은 아래처럼 정리하면 됩니다.

### 팩트

* Meta purchase ROAS는 Meta가 광고에 귀속한 conversion value 기준이다. 확정 결제 매출과 같은 개념이 아니다.
* 현재 운영 메인값은 Attribution confirmed ROAS다.
* 최근 7일 재측정 기준 내부 문서는 `0.92x vs 4.45x`라고 본다.
* 다만 현재 첨부된 raw snapshot은 아직 old 값 `0.80x vs 4.39x`, daily `0.94x vs 4.26x`다.

### 추론

* **Meta 쪽이 더 과장됐을 가능성이 높다**
* **Attribution 30일 값은 실제보다 과도하게 낮아진 보수치다**
* **최근 7일 confirmed 기준이 지금 메인 의사결정값으로 가장 적절하다**

이 추론은 합리적입니다.
다만 “확정”이라고 말하려면, **2026-04-10 raw snapshot 세트**와 **Ads Manager export 조건값**이 꼭 붙어야 합니다.

---

## 지금 가장 필요한 자료 4개

이제는 자료 요청을 아주 좁게 할 수 있습니다.

### 1. 2026-04-10 기준 raw JSON 3개

반드시 같은 시각, 같은 필터, 같은 계정 기준으로:

* `ads_site_summary_last7d_20260410.json`
* `ads_roas_daily_biocom_last7d_20260410.json`
* `meta_insights_biocom_last7d_20260410.json`

### 2. Ads Manager 화면 캡처 1장

아래가 보여야 합니다.

* attribution setting
* report time
* timezone
* columns
* 같은 7일 범위

### 3. Pixel/CAPI event log 샘플

최근 50 - 100건이면 충분합니다.

* event_name
* order_id
* event_id
* source_url
* created_at
* dedup 여부

### 4. `meta_campaign_alias_audit.biocom.json`

이건 drill-down 단계로 넘어갈 때 필요합니다.

---

## 바로 실행할 피드백

문서 수정 우선순위를 딱 4개만 고르면:

1. **2026-04-10 raw snapshot 세트 첨부**
2. **Pixel/CAPI dedup를 Top blocker로 승격**
3. **`best-case ceiling` → `잠정 상한선`으로 이름 변경**
4. **맨 위에 3줄 결론 추가**

   * 메인값
   * 무시할 값
   * 남은 가장 큰 리스크

---

## 아주 짧은 최종 평가

**좋은 문서입니다.**
지금부터는 논리보다 **증빙 체인**을 닫는 단계입니다.
즉, 다음 단계는 새로운 해석이 아니라 **최신 raw 3개 + Ads Manager 캡처 + dedup 로그**를 붙여서 문서를 “주장”에서 “입증”으로 바꾸는 일입니다.

필요 자료는 위 4개면 충분합니다.
