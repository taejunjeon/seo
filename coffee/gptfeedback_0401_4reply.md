# P1-S1A 데이터 정리 및 검증 품질 향상 — 실행 결과

작성일: 2026-04-02

## 10초 요약

referrer URL 자동 파싱, source 보존, 필터링 API 구현 완료.
다음 live row부터 paymentKey·amount·orderCode가 구조화 저장되고, `source=thecleancoffee_imweb`으로 필터 조회가 가능하다.

---

## 1. 구현 완료 내역

### 1-1. referrer URL 파싱 (attribution.ts)

`document.referrer`에 포함된 아임웹 결제 리다이렉트 URL의 query params를 자동 파싱하여 `metadata.referrerPayment`에 구조화 저장.

**파싱 대상 필드:**

| 필드 | 예시 값 | 용도 |
|------|---------|------|
| orderCode | `o2026040182e4ff3b758bd` | 아임웹 내부 주문 코드 |
| orderNo | `202604017586987` | 주문번호 (orderId fallback) |
| paymentCode | `pa202604018c83c9d953876` | 아임웹 결제 코드 |
| orderId | `202604017586987-P1` | PG사 orderId (Toss 크로스 검증용) |
| paymentKey | `iw_th20260401233352v3as0` | Toss paymentKey (크로스 검증용) |
| amount | `21300` | 결제 금액 |

**fallback 로직:**
- payload에 orderId가 없으면 → referrer의 `orderNo` → referrer의 `orderId` 순으로 fallback
- payload에 paymentKey가 없으면 → referrer의 `paymentKey`로 fallback

**기존 live row 예시 (변경 전):**
```json
{
  "orderId": "202604017586987",
  "paymentKey": "",          // ← 누락
  "metadata": {}             // ← source, referrer 정보 없음
}
```

**변경 후 (다음 live row부터 적용):**
```json
{
  "orderId": "202604017586987",
  "paymentKey": "iw_th20260401233352v3as0",  // ← referrer에서 자동 추출
  "metadata": {
    "source": "thecleancoffee_imweb",
    "clientObservedAt": "2026-04-01T23:33:52.000Z",
    "referrerPayment": {
      "orderCode": "o2026040182e4ff3b758bd",
      "orderNo": "202604017586987",
      "paymentCode": "pa202604018c83c9d953876",
      "orderId": "202604017586987-P1",
      "paymentKey": "iw_th20260401233352v3as0",
      "amount": "21300"
    }
  }
}
```

### 1-2. source 필터링 API (routes/attribution.ts)

`GET /api/attribution/ledger`에 쿼리 파라미터 추가:

| 파라미터 | 설명 | 예시 |
|----------|------|------|
| `source` | metadata.source로 필터 | `thecleancoffee_imweb` |
| `captureMode` | live/replay/smoke 필터 | `live` |
| `limit` | 반환 건수 (max 200) | `50` |

**사용 예시:**
```
GET /api/attribution/ledger?source=thecleancoffee_imweb&captureMode=live
```

필터 적용 시 `summary`는 필터된 결과의 요약, `allEntriesSummary`는 전체 요약을 함께 반환.

### 1-3. summary에 추가된 필드

| 필드 | 설명 |
|------|------|
| `countsBySource` | source별 row 수 (e.g., `{"thecleancoffee_imweb": 1, "(none)": 12}`) |
| `entriesWithReferrerPayment` | referrer에서 결제 정보가 파싱된 row 수 |

---

## 2. 현재 확보된 필드 / 아직 비어 있는 필드

### 확보 완료

| 필드 | 소스 | 상태 |
|------|------|------|
| orderId | URL param `order_no` | ✅ 자동 |
| paymentKey | referrer URL | ✅ **신규 — 다음 row부터** |
| amount | referrer URL | ✅ **신규 — metadata에** |
| orderCode | referrer URL | ✅ **신규 — metadata에** |
| paymentCode | referrer URL | ✅ **신규 — metadata에** |
| source | payload `source` 필드 | ✅ **신규 — metadata에** |
| clientObservedAt | payload | ✅ **신규 — metadata에** |
| touchpoint | payload | ✅ |
| captureMode | payload | ✅ |
| userAgent | request header | ✅ |
| origin | request header | ✅ |
| IP | request header | ✅ |

### 아직 비어 있는 필드 (UTM 테스트 필요)

| 필드 | 원인 | 해결 방법 |
|------|------|-----------|
| landing | UTM 없이 직접 접속해서 빈 값 | UTM 붙은 URL로 재테스트 |
| originalReferrer | 동일 | UTM 테스트 시 확인 |
| utm_source | 동일 | UTM 테스트 시 확인 |
| utm_medium | 동일 | UTM 테스트 시 확인 |
| utm_campaign | 동일 | UTM 테스트 시 확인 |
| gclid / fbclid | Google/Meta 광고 클릭 시만 생성 | 실제 광고 클릭 또는 수동 파라미터 |

---

## 3. UTM 재테스트 체크리스트

### 테스트 URL
```
https://thecleancoffee.com/?utm_source=test&utm_medium=cpc&utm_campaign=p1s1a_verify&gclid=test_gclid_001
```

### 검증 시나리오

| # | 단계 | 확인 사항 | 기대 결과 |
|---|------|-----------|-----------|
| 1 | 위 URL로 사이트 진입 | 페이지 정상 로딩 | ✅ |
| 2 | 개발자 도구 > Application > Session Storage | `_att_landing` 키 존재 | JSON에 utm_source=test 포함 |
| 3 | 상품 1개 장바구니 → 결제 진행 (카드) | 결제완료 페이지 도달 | URL에 `shop_payment_complete` 포함 |
| 4 | `GET /api/attribution/ledger?source=thecleancoffee_imweb&captureMode=live` | 새 row 확인 | utmSource=test, utmMedium=cpc, utmCampaign=p1s1a_verify |
| 5 | 새 row의 metadata.referrerPayment | paymentKey, amount 존재 | ✅ |
| 6 | 새 row의 gclid | test_gclid_001 | ✅ |
| 7 | 새 row의 landing | 위 UTM URL 전체 | ✅ |

### 주의사항
- **시크릿 모드** 사용 (캐시/기존 세션 영향 제거)
- ngrok URL이 살아 있는지 먼저 health check
- 가상계좌가 아닌 **카드 결제**로 테스트

---

## 4. 더클린커피 Toss Secret Key 정리

| 항목 | 현재 상태 |
|------|-----------|
| 바이오컴 MID | `iw_biocomo8tx` — Secret Key 확보 완료 |
| **커피 MID** | **`iw_thecleaz5j`** — **Secret Key 미확보** |
| 커피 Toss Secret Key 필요 이유 | paymentKey로 결제 상세 크로스 검증 (금액, 상태, 카드사 등) |

### Secret Key 확보 후 설정 방법

1. `.env`에 추가:
   ```
   TOSS_COFFEE_SECRET_KEY=test_gsk_... (또는 live_gsk_...)
   ```
2. `backend/src/routes/toss.ts`에 커피 전용 조회 엔드포인트 추가 (또는 store 파라미터로 분기)
3. 검증:
   ```
   GET /api/toss/payments/orders/202604017586987-P1?store=coffee
   ```
   → Toss API가 결제 상세 반환하면 성공

---

## 5. 푸터 코드 감지 조건 최종 점검

현재 `gptfeedback_0401_3reply.md`에서 확인된 수정판 코드:

```javascript
if(location.href.indexOf('shop_payment_complete')<0 && location.href.indexOf('shop_order_done')<0)return;
```

**✅ `shop_payment_complete` + `shop_order_done` 둘 다 포함.** 정상.

---

## 6. 바이오컴 확장 전 필요한 것 3개

| # | 항목 | 상태 | 설명 |
|---|------|------|------|
| 1 | **바이오컴 결제완료 URL 패턴 확인** | ⬜ 미확인 | biocom.kr의 결제완료 페이지 URL이 `shop_payment_complete`인지 다른 패턴인지 확인 필요 |
| 2 | **바이오컴용 푸터 코드 준비** | ⬜ 미작성 | source를 `biocom_imweb`으로 변경, 감지 조건을 바이오컴 URL에 맞춰야 함 |
| 3 | **ngrok → 고정 endpoint 전환** | ⬜ 미진행 | ngrok free URL은 재시작 시 변경됨. Vercel/Cloudflare Tunnel 또는 고정 서브도메인(ngrok 유료) 필요 |

---

## 7. 다음 단계 판단

### 결론: **B. referrer 파싱 보강 완료 → A. 현재 구조 유지 + UTM 테스트 확대**

이유:
1. referrer 파싱이 구현되어, 다음 live row부터 paymentKey·amount가 자동 구조화됨
2. source 필터링 API가 추가되어 커피 전용 모니터링 가능
3. UTM 추적은 V1 헤더 코드가 이미 처리 — UTM 붙은 URL로 1회 재테스트만 하면 검증 완료
4. checkout-context(V2)는 여전히 급하지 않음
5. 커피 Toss Secret Key 확보되면 크로스 검증 완성

---

## 바꾼 파일

| 파일 | 변경 내용 |
|------|-----------|
| `backend/src/attribution.ts` | `parseReferrerPaymentParams()` 추가, `normalizeAttributionPayload`에서 referrer 파싱·source 보존·paymentKey fallback, `filterLedgerEntries()` 추가, `buildLedgerSummary`에 countsBySource·entriesWithReferrerPayment 추가 |
| `backend/src/routes/attribution.ts` | ledger GET에 source/captureMode/limit 쿼리 파라미터 필터링 추가, `filterLedgerEntries` import |

## 검증 결과

| 항목 | 결과 |
|------|------|
| TypeScript attribution 타입 체크 | ✅ 에러 0건 |
| 기존 toss.ts 에러 (무관) | ⚠️ 1건 (기존 이슈, 이번 변경 무관) |

## 남은 리스크

1. 기존 live row 1건은 이미 적재된 상태라 paymentKey가 빈 값. 수동 보정 또는 재테스트로 갱신 필요
2. ngrok URL이 재시작되면 변경됨 — 장기 운영 시 고정 endpoint 필요
3. 커피 Toss Secret Key 미확보 — 크로스 검증 불가

## 다음 액션

1. **UTM 재테스트 1건** (위 체크리스트 참조) → landing, utm_*, gclid가 정상 적재되는지 확인
2. 더클린커피 Toss Secret Key 확보 → .env 설정
3. 바이오컴 결제완료 URL 패턴 확인 → 확장 준비
