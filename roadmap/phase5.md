# Phase 5 — Meta 광고 데이터 연동

> **최종 업데이트**: 2026-04-08
> **담당**: Codex (백엔드/설계) + Claude Code (프론트/UXUI)

## 왜 필요한가

광고비 없이 iROAS 계산 불가. 이미 Meta 집행 중이다.

### 사용자 베네핏

- **대표(TJ)**: "이번 달 광고비 대비 실제 순이익이 얼마인가?"를 iROAS 한 숫자로 확인. 광고 예산 증감 판단 근거 확보
- **마케터**: 캠페인/광고세트/소재별 성과를 한 화면에서 비교. 어떤 소재가 전환을 잘 이끄는지 데이터 기반으로 판단
- **운영팀**: 광고 유입 → 상담 → 구매까지 퍼널이 연결되어, 광고와 CRM의 시너지를 수치로 확인

---

## ★ P5-S3 CAPI 테스트 발송 가이드 (0404)

### 이게 뭔가

**CAPI(Conversions API)**는 고객이 우리 사이트에서 결제했을 때, 그 사실을 **우리 서버에서 직접** Meta(페이스북)에 알려주는 것이다.

지금까지는 고객 브라우저의 Meta 픽셀(JavaScript)이 "이 사람이 구매했다"를 보내고 있었는데, **iOS 14 이후로 브라우저 추적이 30~50% 누락**된다. 그래서 우리 서버에서도 같은 신호를 보내면 Meta AI가 "이 광고가 실제로 매출을 만들었구나"를 정확히 알 수 있고, **같은 광고비로 더 좋은 고객에게 광고가 노출**된다.

### 왜 하는가 (사용자 베네핏)

| 대상 | 효과 |
|------|------|
| **대표(TJ)** | Meta Ads Manager의 전환 수가 실제 주문과 일치. "광고가 돈을 벌고 있는가?"에 신뢰할 수 있는 숫자 |
| **마케터** | Meta AI의 자동 입찰이 정확해짐 → **같은 예산으로 CPA 하락, 전환 증가** 기대 |
| **AIBIO** | 현재 월 ₩148만 집행에 전환 0건 기록 → CAPI가 들어가면 **실제 전환을 Meta가 인식**하여 최적화 시작 |
| **운영팀** | 상담 후 구매, 알림톡 → 구매 같은 **오프라인/CRM 전환도 Meta에 보낼 수 있어** 광고와 CRM 시너지 정확 측정 |

### 어떻게 검증하는가

**테스트 모드**란 Meta에 "이건 테스트 데이터다"라고 표시해서 보내는 것이다. 실제 광고 성과에 영향을 주지 않으면서, 데이터가 잘 도착하는지 확인할 수 있다.

**절차:**

1. **Meta Events Manager 접속**
   - https://business.facebook.com/events_manager 접속
   - 좌측에서 해당 Pixel 선택 (예: AIBIO `1068377347547682`)
   - 상단 "테스트 이벤트" 탭 클릭

2. **테스트 이벤트 코드 확인**
   - "테스트 이벤트" 탭에서 **테스트 이벤트 코드**가 표시됨 (예: `TEST12345`)
   - 이 코드를 복사

3. **서버에서 테스트 전송**
   ```
   POST http://localhost:7020/api/meta/capi/send
   Content-Type: application/json

   {
     "pixelId": "1068377347547682",
     "eventName": "Purchase",
     "eventTime": 1712200000,
     "sourceUrl": "https://aibio.kr/shop_payment_complete",
     "orderId": "TEST_ORDER_001",
     "value": 50000,
     "currency": "KRW",
     "testEventCode": "TEST12345"
   }
   ```

4. **Events Manager에서 수신 확인**
   - "테스트 이벤트" 탭에서 방금 보낸 이벤트가 나타나는지 확인
   - "Purchase" 이벤트, 금액 ₩50,000이 표시되면 **성공**

5. **자동 전송 테스트**
   ```
   POST http://localhost:7020/api/meta/capi/sync
   Content-Type: application/json

   { "testEventCode": "TEST12345" }
   ```
   - attribution ledger의 미전송 건을 일괄로 테스트 전송
   - 가상계좌 미입금/취소 건은 자동 건너뜀

6. **테스트 확인 후 운영 전환**
   - `testEventCode`를 빼고 전송하면 실제 운영 모드
   - 실제 전환 데이터가 Meta 광고 최적화에 반영되기 시작

### 3사이트 Pixel ID

| 사이트 | Pixel ID | .env 변수 |
|--------|----------|----------|
| 바이오컴 | `1283400029487161` | `META_PIXEL_ID_BIOCOM` |
| 더클린커피 | `1186437633687388` | `META_PIXEL_ID_COFFEE` |
| AIBIO | `1068377347547682` | `META_PIXEL_ID_AIBIO` |

### 현재 상태

| 항목 | 상태 |
|------|------|
| CAPI 백엔드 코드 | ✅ 구현 완료 (`metaCapi.ts`) |
| 3사이트 Pixel ID | ✅ `.env`에 등록 완료 |
| SHA-256 해싱 (전화번호/이메일) | ✅ Meta 규격 준수 |
| 가상계좌 DONE 검증 | ✅ Toss API 연동 |
| 중복 전송 방지 | ✅ event_id 기반 |
| 전송 로그 | ✅ `logs/meta-capi-sends.jsonl` |
| **테스트 발송** | ✅ 완료 (0405 13:32). Events Manager "구매 · 서버 · 처리됨" 확인 |
| **운영 전환** | ✅ 완료 (0405 13:35). 125건 실전 전송 |
| **자동화** | ✅ 완료 (0405). 서버 내장 30분 주기 자동 sync. [meta/capi.md](../meta/capi.md) |

---

## 0408 후속 메모

- `biocom.kr` 결제완료 페이지에서 payment_success fetch-fix caller는 실제 적재까지 확인했다. 가상계좌 테스트 주문 `202604081311774`가 `pending`으로 ledger에 들어왔고 `snippetVersion=2026-04-08-fetchfix`, `ga_session_id=1775652461`까지 확인됐다.
- 다만 같은 결제완료 페이지 콘솔에서 `gtm.js?id=GTM-W7VXS4D8 ... includes` 오류가 관찰됐다. attribution 적재 성공과는 별개로, GTM custom script/tag 품질 문제로 보고 따로 정리해야 한다.
- `thecleancoffee.com`는 `snippetVersion=2026-04-08-coffee-fetchfix-v2` 기준 실제 가상계좌 주문 `202604080749309`가 `pending`으로 적재됐고, `ga_session_id / client_id / user_pseudo_id` 3종이 모두 들어왔다.
- `aibio.ai`는 쇼핑몰 purchase가 아니라 `form_submit`을 표준 전환으로 보고, `snippetVersion=2026-04-08-formfetchfix-v5` 기준 10분 이내 재제출도 별도 적재되는 것을 확인했다.

### 남은 광고/계측 후속 작업

1. biocom payment page GTM custom script 오류 원인 확인 및 수정
2. `GA4 (not set)`을 BigQuery raw export + hourly compare + caller coverage로 다시 좁혀 Meta/GA 전환 비교 기준 고정
3. `payment_status=pending/confirmed/canceled` 분리와 `confirmed_revenue` 기준이 광고/CAPI 리포트에 계속 유지되는지 점검

---

## 스프린트별 완성도

| Sprint | 목표                                            | 담당                     | 완료  |
| ------ | --------------------------------------------- | ---------------------- | --- |
| P5-S1  | Meta Ads Insights 읽기 · 백엔드 API 구현 | Claude Code         | **100%**  |
| P5-S2  | 캠페인/광고세트 성과 프론트 UI (`/ads`)                   | Claude Code (프론트/UXUI) | **100%**  |
| P5-S3  | Meta Conversions API 서버사이드 전환 전송              | Codex (백엔드/설계)         | **100%**  |

> **P5-S3 완료 (0405)**: CAPI 테스트 발송 성공 → Events Manager에서 "구매 · 서버 · 처리됨" 수신 확인 → **운영 전환 완료**. 125건 실전 전송. 가상계좌 미입금/취소 자동 필터링 정상 동작. 상세: `meta/capi.md`

---

## 상세 내용

### 기간

2026-04-11 ~ 2026-04-24

### 목표

- 광고비가 실제 실험/매출 분석과 연결되도록 함
- 최소한의 `campaign/adset/ad` 기준 비용 원장 확보
- Meta에 서버사이드 전환 신호를 보내 광고 최적화 품질을 높임

### 권장 순서

1. Meta Marketing API/Ads Insights 읽기 연동
2. `utm_*`, `fbclid`, 랜딩 키 파라미터 정규화
3. 내부 캠페인 키와 Meta 캠페인 키 매핑

---

### P5-S1: Meta Ads Insights 읽기 · meta_campaign_daily 적재

**담당**: Codex (백엔드/설계)

- Meta spend sync 배치 구현
- `meta_campaign_daily` 적재
- Revenue 주문/실험 원장과 광고 캠페인 매핑 로직 구현
- 누락/권한 실패 시 fallback 로그 작성
- 캠페인/광고세트/소재 계층 구조 정의
- 필터/비교 규칙과 KPI 카드 정의
- 랜딩 소재 비교 화면 acceptance criteria 정의

---

### P5-S2: 캠페인/광고세트 성과 프론트 UI

**담당**: Claude Code (프론트/UXUI)

- 캠페인/광고세트 기준 성과 UI
- 랜딩 페이지/광고 소재별 비교 대시보드
- 마케터용 필터 UX 정리

---

### P5-S3: Meta Conversions API 서버사이드 전환 전송

**담당**: Codex (백엔드/설계) + Claude Code (구현)

---

#### 왜 하는가 — 사용자 베네핏

**문제**: 현재 Meta 광고는 **브라우저 픽셀(클라이언트사이드)**로만 전환을 추적한다. 하지만:

1. **iOS 14+ ATT 정책**으로 브라우저 픽셀의 전환 추적이 평균 30~50% 누락된다. 사파리, Firefox도 쿠키 차단이 강화되고 있다.
2. **광고 최적화 품질 저하**: Meta AI가 "이 광고가 전환을 만들었다"는 신호를 못 받으면, 입찰 최적화가 안 되고 CPA가 올라간다.
3. **전환 데이터 불일치**: Meta Ads Manager에서 보이는 전환 수와 실제 주문 수가 안 맞아서, ROAS를 신뢰할 수 없다.

**해결**: 서버사이드 Conversions API(CAPI)로 **우리 서버에서 직접** Meta에 전환 이벤트를 보내면:

| | 브라우저 픽셀만 | 픽셀 + CAPI |
|---|-------------|-----------|
| iOS 전환 추적 | ~50% 누락 | **95%+ 복구** |
| 광고 최적화 | 불완전한 신호 | **정확한 전환 신호** |
| CPA | 높음 (잘못된 타겟팅) | **낮아짐** (정확한 타겟팅) |
| ROAS 신뢰도 | 낮음 | **높음** |
| 오프라인 전환 | 불가 | **가능** (전화 주문, 상담 후 구매) |

**페르소나별 베네핏:**

- **대표(TJ)**: 광고 대시보드의 전환 수가 실제 주문과 일치. "광고가 진짜 돈을 벌고 있는가?"에 신뢰할 수 있는 답.
- **마케터**: Meta AI가 정확한 전환 신호를 받으므로 **자동 입찰 최적화 품질이 올라감**. 같은 예산으로 더 많은 전환. CPA 하락 기대.
- **운영팀**: 상담 후 구매, 알림톡 → 구매 같은 **오프라인/CRM 전환도 Meta에 보낼 수 있어** 광고와 CRM의 시너지를 정확히 측정.
- **AIBIO**: 현재 30일간 ₩151만 집행에 전환 0건 기록 — CAPI가 들어오면 **실제 전환을 Meta가 인식**하여 입찰 최적화 시작.

---

#### 구현 계획

**1단계: 핵심 전환 이벤트 정의**

| 이벤트 | Meta 표준 이벤트 | 트리거 | 데이터 소스 |
|--------|----------------|--------|-----------|
| `Lead` | `Lead` | 입력폼 제출 (AIBIO), 상담 예약 | GTM dataLayer + 서버 |
| `Purchase` | `Purchase` | 결제 완료 (카드 즉시) | attribution ledger (captureMode=live) |
| `InitiateCheckout` | `InitiateCheckout` | 결제 시작 | 향후 checkout-context 연동 시 |

**가상계좌 처리 (중요):**
- 가상계좌 주문 접수 시 `shop_payment_complete` 도달 → ledger에 적재됨
- 하지만 Toss 상태는 `WAITING_FOR_DEPOSIT` (입금 대기)
- **CAPI에서 Purchase 이벤트를 보낼 때, 가상계좌는 입금 확인 후에만 전송해야 함**
- 방법: Toss Webhook으로 입금 완료 알림 수신, 또는 주기적으로 Toss API 조회하여 `DONE` 상태만 전송

**2단계: CAPI 서버 구현**

```
POST https://graph.facebook.com/v22.0/{PIXEL_ID}/events
  ?access_token={TOKEN}

Body:
{
  "data": [{
    "event_name": "Purchase",
    "event_time": 1712025600,
    "action_source": "website",
    "event_source_url": "https://biocom.kr/shop_payment_complete",
    "user_data": {
      "em": [sha256(email)],
      "ph": [sha256(phone)],
      "client_ip_address": "...",
      "client_user_agent": "...",
      "fbc": "fb.1.1612345678.AbCdEf",  // fbclid cookie
      "fbp": "fb.1.1612345678.1234567890"  // _fbp cookie
    },
    "custom_data": {
      "currency": "KRW",
      "value": 245000,
      "order_id": "202604028548539",
      "content_type": "product"
    }
  }]
}
```

**3단계: 중복 방지**

| 방법 | 설명 |
|------|------|
| `event_id` | `{orderId}_{event_name}_{timestamp}` 형식. Meta가 동일 event_id를 자동 dedupe |
| fbclid/fbp | attribution ledger의 `gclid`/`fbclid` 필드에서 추출 |
| 발송 로그 | 어떤 주문의 Purchase를 보냈는지 JSONL 기록 → 재발송 방지 |

**4단계: 환불/취소 처리**

- Toss API에서 `CANCELED` 상태 확인 시 → CAPI에 negative value 전환 전송하지 않음 (Meta는 환불 이벤트를 지원하지 않음)
- 대신 내부 ROAS 계산에서 환불 금액을 차감하여 **순 ROAS**로 표시

---

#### 필요한 추가 정보

| 항목 | 현재 상태 | 필요 액션 |
|------|---------|----------|
| Facebook Pixel ID | ✅ 3사이트 확보 완료 | 바이오컴 `1283400029487161`, 커피 `1186437633687388`, AIBIO `1068377347547682` |
| fbclid 수집 | ✅ attribution ledger에 저장 | 자동 전달 가능 |
| 이메일/전화번호 해싱 | ⬜ 미구현 | SHA-256 해싱 함수 필요 |
| System User Token | ⬜ 미확보 | Meta Business Settings에서 생성 (현재 User Token으로 대체 가능) |

---

#### 가상계좌 주문 이슈 (0404 확인)

**발견**: 가상계좌 주문이 입금 전에도 `shop_payment_complete`에 도달하여 attribution ledger에 적재된다.

| orderId | 결제 수단 | Toss 상태 | ledger | 문제 |
|---------|----------|----------|--------|------|
| 202604024100063 | 가상계좌 | `WAITING_FOR_DEPOSIT` | ✅ 적재됨 | **입금 전인데 적재됨** |
| 202604026505916 | 가상계좌 | `CANCELED` | ✅ 적재됨 | **취소됐는데 적재됨** |
| 202604022864795 | 카드 | `DONE` | ✅ 적재됨 | 정상 |

**원인**: 아임웹은 가상계좌 주문 접수 시점에도 `shop_payment_complete` URL로 리다이렉트한다. 우리 푸터 코드는 URL 패턴만으로 감지하므로, 입금 여부와 무관하게 적재.

**영향:**
- 매출 집계가 과대 계상될 수 있음 (입금 안 한 가상계좌 주문 포함)
- ROAS 계산이 부정확해질 수 있음
- CAPI로 Purchase 전송 시, 실제 입금 안 된 주문을 전환으로 보내면 Meta 광고 최적화가 왜곡

**해결 방안:**

| 방법 | 설명 | 복잡도 |
|------|------|--------|
| A. Toss API 사후 검증 | 주기적으로 ledger의 paymentKey를 Toss API로 조회, `DONE`만 확정 마킹 | 중 |
| B. CAPI 전송 시점을 Toss DONE으로 제한 | CAPI에서 Purchase를 보내기 전 Toss 상태 확인 | 낮음 |
| C. ledger에 payment_status 필드 추가 | 적재 시 `pending`, Toss 확인 후 `confirmed`/`canceled`로 업데이트 | 중 |

**권장**: B + C 조합. CAPI는 `DONE` 확인 후에만 전송, ledger에는 상태 필드 추가하여 대시보드에서 확정/미확정 구분.

---

### Codex 리뷰 사항

P5-S3 구현 전 확인 필요:

1. **Facebook Pixel ID 3사이트 확인**: 바이오컴, 더클린커피의 Pixel ID가 아임웹 관리자 또는 GTM에 있는지
2. **System User Token vs User Token**: 현재 User Token(60일)으로 CAPI 전송이 가능하지만, 운영 안정성을 위해 System User Token 발급 권장
3. **가상계좌 비중 파악**: 전체 주문 중 가상계좌 비율이 얼마인지에 따라 과대 계상 영향도가 달라짐
4. **이벤트 매칭 품질 (EMQ)**: Meta는 user_data의 매칭 키(email, phone, fbc, fbp)가 많을수록 매칭 품질 점수가 높아짐. 현재 attribution ledger에 이메일은 없고 전화번호는 아임웹 회원 DB에 있음 → 조인 필요
5. **테스트 모드**: CAPI에는 `test_event_code` 파라미터가 있어 테스트 이벤트를 보낼 수 있음. 프로덕션 전에 반드시 테스트 모드로 검증

### 왜 이 시점인가

- 지금 Meta 광고가 이미 돌고 있으므로 광고비 원장이 늦어지면 iROAS 해석이 왜곡된다
- AIBIO는 ₩151만 집행에 전환 0건 — CAPI가 들어오면 Meta AI 최적화가 시작됨
- 그러나 `customer_key`와 실험 스키마가 먼저 없으면 광고 데이터는 단순 리포트에 그친다

---

## 외부 연동 판단

판단: **연동 추천, 단 2단계로 나눠서 진행**

1단계: Marketing API/Ads Insights로 광고비/노출/클릭 수집
2단계: Conversions API로 서버사이드 전환 전송

즉시 붙이는 이유:
- 현재 광고 집행 중이라 비용 데이터 없이 CRM 실험 해석이 반쪽짜리가 된다

바로 붙이면 안 되는 이유:
- 내부 원장과 식별키가 없으면 Meta API는 단순 매체 리포트로 끝난다

---

## P5-S1 구현 완료 (0404)

### 구현된 API 엔드포인트

| 엔드포인트 | 용도 | 테스트 |
|-----------|------|--------|
| `GET /api/meta/status` | 토큰 설정 상태 | ✅ |
| `GET /api/meta/accounts` | 광고 계정 목록 (7개) | ✅ |
| `GET /api/meta/campaigns?account_id=...` | 캠페인 목록 | ✅ |
| `GET /api/meta/insights?account_id=...&date_preset=last_30d` | 캠페인별 성과 (노출/클릭/비용/CPC/CPM/전환) | ✅ |
| `GET /api/meta/insights/daily?account_id=...` | 일별 추이 | ✅ 7일분 확인 |
| `GET /api/meta/overview` | 3사이트 합산 요약 | ✅ |

### 실측 데이터 (AIBIO 30일)

| 지표 | 값 |
|------|-----|
| 노출 | 480,492회 |
| 클릭 | 18,015회 |
| 비용 | ₩1,513,916 |
| CPC | ₩84 |
| 랜딩 뷰 | 15,974회 |

### 파일 위치

- `backend/src/routes/meta.ts` (신규)
- `backend/src/env.ts` — `META_ADMANAGER_API_KEY`, `META_APP_SECRET_CODE` 추가
- `backend/src/server.ts` — Meta 라우트 등록 + health에 meta 상태 추가

---

## 완료 기준

- [x] ~~날짜별 광고비/노출/클릭이 API로 조회 가능~~ ✅ P5-S1 완료
- [ ] 실험 결과 화면에서 최소 campaign 레벨 비용이 보임 (P5-S2)
- [x] ~~서버에서 Meta로 핵심 전환 이벤트 전송 (P5-S3)~~ ✅ CAPI 운영 전환 완료 (0405). 테스트 + 실전 125건 전송 성공
- [ ] 내부 원장과 Meta 전환 이벤트 naming이 일치 (P5-S3)
