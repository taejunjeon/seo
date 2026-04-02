좋아요. 총평부터 말씀드리면, 이 문서는 이미 “분석 메모”보다 “V1 제품/지표 설계서”에 가까워요. 특히 `정확한 순증분 가치/정확한 ROI는 아직 불가`와 `준증분 추정은 가능`을 분리한 점, `revenue`를 재개발 대상이 아니라 기준선으로 보고 `seo`에서 실험 구현하겠다는 점, 그리고 프론트보다 backend 기준선 확정을 우선순위로 둔 점이 아주 좋습니다. 방향은 맞습니다. fileciteturn0file0

제가 봤을 때 가장 중요한 피드백은 6개입니다.

1. **산식 단위를 한 번 더 고정해야 합니다.**
   5-1의 식은 `상담 건수 × 전환율 × 평균매출 차이`인데, 뒤의 V1 정의와 SQL 초안에서는 `avg_revenue_per_customer`가 이미 `matured_customers` 분모 기준의 “고객당 매출”로 정의돼 있어요. 이 정의를 유지하면 `conversion_rate`를 다시 곱하는 순간 이중 반영 위험이 있습니다. 여기만 정리해도 문서 신뢰도가 확 올라가요.
   추천은 둘 중 하나입니다.

* `준증분 매출 = matured_customers × (consult_avg_rev_per_customer - baseline_avg_rev_per_customer)`
* 또는 평균매출을 “구매자당 평균매출”로 재정의하고 그때만 `conversion_rate`를 곱하기
  지금 문서 전체 흐름상 첫 번째가 더 일관적입니다. fileciteturn5file4 fileciteturn5file1 fileciteturn5file10

2. **비교군은 지금보다 한 단계 더 좁혀야 합니다.**
   문서가 이미 `global_non_consultation`을 V1 기본값으로 두고, “관측 차이일 뿐 인과 확정치가 아니다”라고 명시한 건 좋습니다. 다만 상담군 대비 미상담군 차이가 영양제 전환율 `23.2% vs 1.8%`처럼 매우 크게 나오는 만큼, 실제 효과가 큰 것일 수도 있지만 선택편향도 같이 크게 섞여 있을 가능성을 의심해야 해요.
   운영 화면 기본값은 지금처럼 두고, 분석용 민감도 baseline을 최소 2개 더 붙이는 걸 권합니다: `배정됐지만 완료되지 않은 고객`, `동일 분석유형 × 동일 월 × 동일 유입원` 비교군입니다. 이 3개 baseline에서 방향이 같으면 숫자 설득력이 훨씬 세집니다. fileciteturn5file9 fileciteturn5file15 fileciteturn5file17

3. **`상담사 1명 추가 시 월 1,085만원`은 단일 점추정보다 범위값으로 전면 배치하는 게 안전합니다.**
   문서 안에 이미 `보수적 하한 / 기준값 / 중간값 / 상위 참고값`과 가정을 붙여둔 점은 아주 좋습니다. 다만 이 숫자는 2025-12라는 마지막 완전 성숙 월 하나에 많이 기대고 있어서, 채용 의사결정 숫자로는 조금 더 보수적으로 다뤄야 해요.
   추천은 `rolling 3개월 평균 + 신규 상담사 ramp curve + 리드 공급 상한`을 붙이는 겁니다. 즉 “지금 팀 평균 생산성을 신규 인력이 즉시 재현한다”는 해석을 막아야 합니다. 이건 문서의 방향과도 잘 맞아요. fileciteturn5file2 fileciteturn5file5 fileciteturn5file12

4. **전화번호 join은 시작엔 충분하지만, KPI 고정 전엔 QA가 꼭 필요합니다.**
   상담 연락처 기준 IAMWEB 매칭률 41.7%, LTR 매칭률 73.5%는 “분석 시작 가능” 수준으로는 괜찮습니다. 하지만 운영 지표로 고정하려면 아직 불안 요소가 있어요. 가족 공용 번호, 잘못 입력된 번호, 국가코드 처리, 중복 고객 같은 문제가 실제로 들어가면 상담사별 ranking이 흔들릴 수 있습니다.
   여기서는 자동화보다 먼저 `matched 50건 / unmatched 50건` 수기 검수가 훨씬 값집니다. 그리고 `invalid_phone_rate`, `match_rate`, `manual_audit_pass_rate`를 meta/debug에 함께 넣으면 대시보드 신뢰도가 크게 올라갑니다. 상태값 `nan`, `변경`, `시간 변경`이 보이는 만큼 status canonicalization도 join QA와 같은 급으로 보시면 됩니다. fileciteturn4file10 fileciteturn4file3 fileciteturn5file14

5. **귀속 규칙은 V1으로 좋지만, 보조 뷰가 하나 더 있으면 좋습니다.**
   `최초 완료 상담사` 귀속은 V1에서 가장 무난한 선택입니다. 다만 후속 상담이나 재상담이 실제 성과를 좌우하는 구조라면, follow-up 비중이 큰 상담사를 과소평가할 수 있어요.
   그래서 `first-touch`를 기본값으로 두되, 내부 검증용으로는 `last-touch` 또는 `split-credit` 뷰를 같이 계산해보는 걸 권합니다. 최소한 manager ranking이 얼마나 흔들리는지 sensitivity check는 해보는 편이 좋습니다. fileciteturn5file9 fileciteturn5file10 fileciteturn4file8

6. **용어는 더 엄밀하게 맞추면 좋습니다.**
   문서 일부에서는 `ROI`, `이익`이라는 표현이 나오는데, 현재 시나리오 계산은 사실상 `증분매출 - 인건비` 또는 `매출배수`에 더 가깝습니다. 상품 원가, 물류, 환불, 광고비가 빠져 있다면 회계적 의미의 profit이나 ROI라고 부르기 어렵거든요.
   좋은 점은 API가 이미 `incremental_revenue_multiple`이라는 말을 쓰고 있다는 겁니다. 그래서 Phase 1 문서도 `준증분 매출`, `매출배수`, `인건비 차감 후 잔여매출` 정도로 통일하고, `ROI`와 `이익`은 비용 원장 + 공헌이익 기준이 들어온 뒤에만 쓰는 쪽이 더 안전합니다. 그리고 `share_of_total_estimated_incremental_revenue`에서 음수 기여를 0 처리한 것도 운영용 share chart에는 괜찮지만, 평가용 표에서는 순기여 기준을 별도로 보여주는 편이 좋습니다. fileciteturn5file4 fileciteturn5file7 fileciteturn5file6

문장 자체도 조금만 다듬으면 더 강해져요. 제가 결론 문장을 압축하면 이렇게 쓰겠습니다 ✍️
“현재 운영 DB만으로 상담사 성과의 V1 추정은 가능하다. 다만 본 수치는 전체 미상담 비교군 대비 관측 uplift이며, 채용·평가 의사결정에는 rolling 3개월 범위값으로만 사용한다. 다음 우선순위는 UI가 아니라 산식 정합성 고정, 비교군 정교화, 전화번호 join QA, 비용 원장 설계다.” fileciteturn0file0

우선순위만 딱 정리하면 이 순서가 좋아 보여요.
P0: 산식 고정 → 비교군 민감도 3종 → join/상태값 QA
P1: rolling 3개월 기준선 + 신규 상담사 ramp + outlier/신뢰구간
P2: `ltr_customer_cohort.manager` / 비용 원장 / 공식 ROI 전환 fileciteturn5file12
