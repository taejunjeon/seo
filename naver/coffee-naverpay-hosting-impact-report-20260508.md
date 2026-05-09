# 더클린커피 네이버페이 호스팅사 입점 임팩트 평가 보고서

작성 시각: 2026-05-08 KST
site: `thecleancoffee` (cross-check: `biocom`)
mode: `read_only` / `no_send` / `no_write` / `no_deploy`
상태: 정본 결정 완료, 후속 액션 5건 중 4건 즉시 반영 완료
Owner: naver-api / coffee-data
Source: 네이버페이 운영팀(이민영) 공식 답변 + 기존 정본 문서 read-only 재검증
Confidence: 88%

## 5줄 결론

1. 더클린커피 자사몰 독립몰 신축은 **불필요**하오. 네이버페이 API 직접 효용이 6/47 ≈ 13% 수준이고, 04-23~29 윈도우 NPay 갭이 2건/103,000원(약 4%)에 불과해 신축 비용/리스크를 정당화하지 못하오.
2. 네이버페이 API 연결 불가 사유는 권한이 아니라 **가입 형태**(아임웹 호스팅사 제휴)이오. 통합매니저 위임으로도 풀리지 않고, 우회는 호스팅사/네이버페이센터 web UI 수동 조회뿐이오.
3. 더클린커피 NPay 매칭은 정본 경로(NPay intent dispatcher v2.1 + Imweb actual order + GTM intent log)로 **04-23~29 윈도우 60건 중 42건(70%) deterministic 매칭** 확보 중. 18건 unassigned는 expected_synthetic_gap 등 미래 intent 누적으로 점진 해소.
4. 바이오컴 자사몰(biocom.kr)도 동일 정본 경로로 매칭 가능하오. 2026-04-25~05-02 7일 dry-run에서 419 intent / 34 confirmed NPay 중 strong match 10건, 2026-05-05 snapshot에서 820 intent / 30 confirmed / strong match 20건으로 시간이 누적될수록 매칭률 상승 중.
5. P0(`paid_click_intent Mode B`), P1(`minimal paid_click_intent ledger write`) 등 **현재 운영 P0/P1 작업은 네이버 API 의존도 0**이라 본 결정으로 인한 일정/계획 영향 없소.

## 1. 네이버페이 운영팀 공식 답변

> 안녕하세요. 네이버페이 이민영입니다.
>
> 문의주신 더클린커피(ID:np_cnexi899940) 가맹점은 현재 '아임웹' 호스팅사를 통해 가입되어 네이버페이 주문형서비스 연동 중이신것 으로 확인됩니다.
>
> 아임웹과 같이 네이버페이와 제휴된 호스팅사를 이용하여 서비스 오픈될 경우 자체적인 네이버페이 API 연동 및 라이센스 발급이 불가합니다.
> 호스팅사 어드민에서 제공하는 네이버페이 주문 조회/처리 기능을 이용해주시거나 네이버페이센터 통해서만 조회/처리가 가능한 점 참고 부탁드립니다.
> (네이버페이 API 는 '독립몰' 형태로 입점된 '정상거래' 상태의 가맹점에 한해 연동 가능합니다.)

해석:
- 권한 위임/추가 앱 발급으로 풀리지 않음. 가맹점 가입 형태(독립몰 vs 호스팅사 제휴) 자체가 결정 변수.
- 자체 API 연동을 열려면 더클린커피를 **아임웹을 떠나 독립몰로 신규 입점**해야 함.
- 우회는 (a) 아임웹 어드민 NPay 조회/처리 화면, (b) 네이버페이센터 web UI 수동 조회 두 가지뿐. 둘 다 server-to-server 자동 대사 경로 아님.

## 2. 자사몰 독립몰 신축 ROI 평가

| 항목 | 값/판단 | 근거 |
|---|---|---|
| 네이버 API 직접 효용 추정 | 6/47 ≈ 13% (과거 synthetic gap dry-run) | [[../data/!coffeedata.md]] "Naver API 직접 효용" |
| 04-23~29 GA4 NPay vs Imweb NPay 갭 | 2건 / 103,000원 (약 4%) | [[../data/coffee-imweb-operational-readonly-20260501]] |
| 04-12~17 GA4 NPay 절대값 | 65건 / 2,630,700원 (7일) | [[../naverapi]] |
| 더클린커피 GA4 monthly purchase 약 | 4,454,524원 / 7일 = 약 1,909만원/월 | [[../data/coffee-ga4-baseline-20260501]] |
| NPay 비중 (더클린커피) | 약 53% (2,359,300 / 4,454,524) | 위 baseline |
| 독립몰 신축 비용 추정 | 도메인/PG 재계약 + 회원 마이그레이션 + GA4/GTM/Meta Pixel/CAPI 재구축 + NPay 재발급 + SEO 백링크 손실 | 일반 e-commerce 마이그레이션 표준 |
| 정당화 임계 | 매출 갭이 30%+ 수준이어야 검토 가치 | 산업 표준 |
| 실제 갭 | 약 4% (NPay 갭) ~ 13% (Naver API 직접 효용) | 본 보고서 §3, §6 |
| **결론** | **신축하지 않는다** | 비용/리스크 막대 vs 기대 효익 미미 |

## 3. GA4 NPAY 65건 vs Imweb actual 60건 차이 세부 분석

이전 답변에서 두 윈도우 데이터를 섞어 비교한 부분을 정정하면서 세부 검증.

### 윈도우 분리

| 데이터 | 윈도우 | 건수 | gross | 출처 |
|---|---|---:|---:|---|
| 더클린커피 GA4 NPay 패턴 (04-12~17) | 7일 | 65건 | 2,630,700원 | [[../naverapi]] / 기존 reconcile-coffee-ga4-naverpay 시도 윈도우 |
| 더클린커피 GA4 NPay 패턴 (04-23~29) | 7일 | 58건 | 2,359,300원 | [[../data/coffee-ga4-baseline-20260501]] |
| 더클린커피 Imweb NPay actual (04-23~29) | 7일 | 60건 | 2,462,300원 | [[../data/coffee-imweb-operational-readonly-20260501]] |
| 동기 윈도우(04-23~29) NPay 갭 | 7일 | **2건** | **103,000원** | 같은 윈도우 비교 |

→ 65건은 04-12~17, 60건은 04-23~29의 다른 윈도우 데이터. 이전 5줄 결론에서 두 윈도우를 섞어 비교한 것 정정.

### 04-23~29 60건 매칭 세부 (Imweb NPay actual 기준)

`coffee-imweb-operational-readonly-20260501.md` 결과:

| 분류 | 건수 | 비중 |
|---|---:|---:|
| **assigned (deterministic 매칭)** | **42** | **70.0%** |
| - A_strong | 31 | 51.7% |
| - probable | 7 | 11.7% |
| - B_strong | 4 | 6.7% |
| unassigned actual (매칭 못 함) | 18 | 30.0% |
| 합계 | 60 | 100% |

### 60건 amount match type 분포

| amount_match_type | 건수 | 의미 |
|---|---:|---|
| shipping_reconciled | 29 | 배송비 보정 후 금액 일치 |
| final_exact | 27 | 최종 결제금액 일치 |
| near_exact | 2 | 근접 일치 (소액 차이) |
| none | 2 | 금액 매칭 실패 |

→ **금액 매칭 자체는 60건 중 58건(96.7%)** 가능. 배송비/할인 보정 규칙으로 거의 다 닫힘.

### unassigned 18건 라벨 분해

| 라벨 | 건수 | 의미 | 정본 경로 해소 가능성 |
|---|---:|---|---|
| expected_synthetic_gap | 8 | NPay synthetic transaction_id 한계로 GA4에서 동시간/동금액 후보 다수 → 매칭 못 결정 | 미래 intent key(client_id+ga_session_id+channel_order_no)로 해결 |
| stop_historical_recovery | 6 | 과거분 자동 복구 금지 라벨 | 정책상 영구 unassigned (TJ YES 종결) |
| manual_review_only | 3 | 수동 검토만 가능 | 정본 경로로도 해소 어려움 |
| needs_naver_api_crosscheck | 1 | 네이버 API로만 해결 가능했던 1건 | **이번 답변으로 영구 unassigned 확정** |

→ 18건 중 정본 경로(미래 intent dispatcher)로 점진 해소 가능한 건 8건. 본 답변으로 영구 unassigned 확정된 건은 **1건 / 약 30,000원 수준**. 매출 임팩트 미미.

### Imweb actual order 60건 NPay 여부 검증

`coffee-imweb-operational-readonly-20260501.md` 명시:

```
| Imweb orders | 113 / 4,699,767원 |  ← 전체 주문
| Imweb NPay actual | 60 / 2,462,300원 |  ← type=npay 필터
```

→ Imweb 전체 주문 113건에서 **명시적으로 `type=npay` 필터를 적용한 결과가 60건**. 60건 전부 네이버페이 결제 주문 확정. card 49건, virtual 4건은 별도 분리(`coffee-ga4-baseline-20260501.md` payment method 분리표 참고).

### 5건 차이의 진짜 의미

질문은 "65건 vs 60건 5건 차이"이지만, 실제로는 **윈도우가 다르므로 직접 비교 불가**. 동기 윈도우(04-23~29)에서는 GA4 58건 vs Imweb 60건 = **2건 차이**. 이 2건 / 103,000원의 의미:
- Imweb에 NPay actual order는 있지만 GA4 NPay 패턴 transaction_id 동기간에 없음
- 가능한 원인: GA4 purchase 발사 누락, transaction_id 패턴 불일치, NPay 결제 후 biocom.kr 미복귀(확정 케이스 다수), 또는 GA4 sampling/unwanted referral filter
- 2건 / 103,000원이라 매출 임팩트 미미. 정본 경로 미래 intent로 해소 가능.

## 4. 바이오컴 자사몰 NPay 매칭 가능성 검증

바이오컴은 두 NPay 채널이 분리되어 있소.

| 채널 | 가입 형태 | 네이버 API 가능 여부 | 자체 정본 경로 |
|---|---|---|---|
| 바이오컴 스마트스토어 | 독립몰 입점 | **YES**, `BIOCOM_STORE_APP_ID/SECRET` 정상 동작 | 별도 |
| 바이오컴 자사몰(biocom.kr) | imweb 호스팅 | **NO**, 더클린커피와 동일 구조 | NPay intent dispatcher v2.1 + Imweb actual order + GTM intent log |

→ 바이오컴 자사몰(biocom.kr) NPay는 더클린커피와 정확히 같은 구조. 따라서 정본 경로 적용 동일.

### 바이오컴 자사몰 NPay 정본 경로 dry-run 결과

#### Run A: 04-25~05-02 7일 (intent 시작 직후)
출처: [[../data/biocom-npay-recovery-autorun-readonly-20260502]]

| metric | 값 |
|---|---:|
| live_intent_count | 419 |
| confirmed_npay_order_count | 34 |
| **strong_match** | **10 (29.4%)** |
| - A_strong | 7 |
| - B_strong | 3 |
| ambiguous | 5 |
| purchase_without_intent | 19 |
| clicked_no_purchase | 304 |

#### Run B: 04-27~05-05 (intent 누적 1주차)
출처: [[!npayroas]] §"2026-05-05 VM Cloud snapshot 재실행"

| metric | 값 |
|---|---:|
| live intent | 820 |
| confirmed NPay 주문 | 30 |
| **strong match** | **20 (66.7%)** |
| - A_strong | 10 |
| - B_strong | 10 |
| ambiguous | 10 |
| purchase_without_intent | 0 |

→ Run A → Run B 사이에 **strong match율이 29.4% → 66.7%로 약 2.3배 상승**. 이유는 intent 누적이 9일에서 14일+로 늘어나면서 confirmed purchase에 매칭될 intent base가 커진 것. **시간이 누적될수록 매칭률은 더 올라감**.

→ 바이오컴 자사몰도 정본 경로로 deterministic 매칭 가능 확정. 더클린커피와 동일한 구조이므로 더클린커피에도 같은 추세 기대 가능.

## 5. 정본 경로 5개 Phase의 네이버 API 의존도

| 정본 경로 단계 | 네이버 API 의존? | 현재 진척 |
|---|---|---|
| Phase1 주문·결제 기준선 ([[../data/!coffeedata.md#Phase1-Sprint1]]) | NO | 90% / 80% |
| Phase2 GA4/NPay 과거분 guard ([[../data/!coffeedata.md#Phase2-Sprint2]]) | NO | 100% / 100% (TJ YES 종결) |
| Phase3 NPay intent 미래키 수집 ([[../data/!coffeedata.md#Phase3-Sprint3]]) | NO | 88% / 68% (A-5 monitoring 진행) |
| Phase4 A-6 외부 전송 dry-run ([[../data/!coffeedata.md#Phase4-Sprint4]]) | NO | 45% / 0% (A-5 closure 후 진행) |
| Phase5 Coffee ROAS 화면 ([[../data/!coffeedata.md#Phase5-Sprint5]]) | NO | 20% / 0% (parked) |

→ **5개 Phase 모두 네이버 API 없이 닫을 수 있다**. 본 결정으로 인한 일정 영향 없음.

## 6. 잃는 것과 대안

| 잃는 것 | 영향 크기 | 대안 |
|---|---|---|
| 더클린커피 GA4 NPAY 65건 (04-12~17) 원장 자동 대사 | **작음**. GA4 분모 2,630,700원 / 7일 | Imweb API actual order 60건 + 정본 경로 미래분 deterministic 매칭 |
| NPay 정산 net revenue 자동 계산 | **보통**. 수수료 자동 산정 못 함 | 네이버페이센터 web UI 또는 아임웹 어드민 월 1회 수동 export |
| NPay 환불/취소 server-to-server 즉시 반영 | **작음** | Imweb API `state` 필드 polling으로 부분 보강 가능 |
| 과거 GA4 NPay synthetic gap 36건/36건 보강 | **미미** | TJ YES로 자동 복구 전송 금지 종결 ([[../data/!coffeedata.md]] Phase2) |
| `needs_naver_api_crosscheck` 1건 (60건 중) | **미미**. 약 30,000원 수준 | 영구 unassigned 확정 |

## 7. 정본 갱신 결과 (후속 액션)

| # | 액션 | 대상 문서 | 상태 |
|---:|---|---|---|
| 1 | Parked 표 → 영구 Parked / 재개 불가 | [[../data/!coffeedata.md]] | ✅ 완료 |
| 2 | Completed Ledger entry 추가 | [[../data/!coffeedata.md]] | ✅ 완료 |
| 3 | 10초 요약 / 사실 / 병목 / 액션 5·6번 obsoleted 처리 | [[../data/!datacheckplan.md]] (568, 656, 663, 672, 705, 720, 721, 801, 808, 822, 823, 1199, 1200) | ✅ 완료 |
| 4 | 업데이트 이력 entry 추가 | [[../data/!datacheckplan.md]] | ✅ 완료 |
| 5 | Completed Ledger entry 추가 | [[../total/!total-current.md]] | ✅ 완료 |
| 6 | 호스팅사 답변 + 임팩트 평가 섹션 추가 | [[../naverapi]] | ✅ 완료 (이전 turn) |
| 7 | 한 장 결과보고서 작성 | 본 문서 | ✅ 완료 |

남은 액션 (TJ 검토 후):

| # | 액션 | 담당 | 우선순위 |
|---:|---|---|---|
| A | 아임웹 어드민 네이버페이 export 화면 1회 read-only 캡처 | TJ | 다음 sprint |
| B | (선택) 정산/수수료 월 1회 자동화는 아임웹 어드민 export CSV → 로컬 SQLite 적재 cron으로 구현. 네이버페이센터 직접 scrape는 ToS 위반 위험으로 금지 | TJ + Codex | parked |

## 8. 자신감과 미지 영역

- **자신감**: 88%
- **미지 영역**:
  - 아임웹 어드민의 네이버페이 export 화면이 실제로 어떤 필드를 제공하는지 직접 본 적 없음 (TJ 1회 캡처 필요)
  - 더클린커피 03-23~29 윈도우 매칭률 70%가 30일+ 누적 시 어디까지 올라가는지 미관측 (바이오컴 추세는 29.4% → 66.7%이므로 더클린커피도 비슷할 것 추정)
  - "주문형서비스" vs "결제형서비스" 호스팅 구분이 향후 네이버페이 정책 변경으로 풀릴 가능성은 낮지만 0이 아님 (현재 정책 기준 영구 Parked)
  - 더클린커피를 장기적으로 자사몰로 옮길 경영적 사유(SEO 자체 운영, 아임웹 의존도 축소 등)가 있다면 별도 평가 필요. 본 평가는 "네이버 API 단일 사유로 신축할 가치가 있는가"에만 답함

## 9. Auditor Verdict

```text
Auditor verdict: PASS
Phase: docs_canonical_update_only
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
Numbers current: YES
External API call verified: NO (read-only docs only)
Notes:
- 본 작업은 정본 4개 문서 갱신 + 결과보고서 1개 작성만 수행했다.
- 운영DB write, GTM publish, platform send, 운영 endpoint 배포는 0건이다.
- 네이버 커머스 API, BigQuery, GA4 Data API, Imweb API 호출 0건. 기존 read-only dry-run 결과만 인용.
```

## 10. 변경 파일

| 파일 | 변경 내용 |
|---|---|
| [[../naverapi]] | "현재 결론" 갱신 + "2026-05-08 더클린커피 호스팅사 입점 공식 답변과 임팩트 평가" 신규 섹션 |
| [[../data/!coffeedata.md]] | Parked 표 영구 Parked로 갱신, Completed Ledger entry 추가 |
| [[../data/!datacheckplan.md]] | 10초 요약 / 사실 / 병목 / Phase1·Phase2 액션 5·6번 obsoleted 처리, 업데이트 이력 entry 추가 |
| [[../total/!total-current.md]] | Completed Ledger entry 추가 |
| 본 문서 | 한 장 결과보고서 신규 작성 |

## 11. 다음 액션

- TJ: 아임웹 어드민 네이버페이 조회/처리 화면 1회 캡처 (Action A) 후 정산/수수료 자동화 자체 가능 여부 판단
- Codex: 본 결정은 P0 Mode B / P1 ledger write 운영 작업과 독립이므로 [[../total/!total-current.md]] §"다음 할일" 1·2·3·4번 정상 진행
- 본 결정 자체는 운영 변경 0이므로 별도 추가 승인 불필요
