# P1-S1A 운영 고정 + 첫 성과 리포트 — 결과보고서

작성일: 2026-04-02

## 10초 요약

중복 방지 로직 추가, 기존 중복 1건 제거 완료. 현재 live row 4건(커피 3 + 바이오컴 1), 총 ₩116,425. channel_talk 캠페인 유입 실제 고객 1건(₩34,825) 포착됨. Named Tunnel은 Cloudflare 도메인 설정이 필요해 당장은 Quick Tunnel 유지를 권장. checkout-context(V2)는 **보류**.

---

## 1. 고정 Endpoint 전환안

### 현재 상태

| 항목 | 값 |
|------|-----|
| 방식 | Cloudflare Quick Tunnel |
| URL | `https://vendors-wait-candles-dominant.trycloudflare.com` |
| URL 고정 | ❌ 재시작 시 변경 |
| `~/.cloudflared/cert.pem` | ❌ 없음 (`cloudflared tunnel login` 미완료) |

### Named Tunnel 전환 조건

Named Tunnel을 쓰려면 **도메인 DNS가 Cloudflare에서 관리**되어야 한다. 현재:
- thecleancoffee.com: 아임웹 DNS → Cloudflare로 이전하면 **사이트 다운 위험**
- biocom.kr: 아임웹 DNS → 동일 위험

**안전한 방법 2가지:**

| 방법 | 비용 | 위험도 | 설정 시간 |
|------|------|--------|-----------|
| A. 별도 도메인 구매 → Cloudflare DNS 등록 → Named Tunnel | ₩10,000~/년 | 없음 | 30분 |
| B. ngrok 유료 (고정 도메인) | $8/월 | 없음 | 5분 |

### 권장: 당장은 Quick Tunnel 유지

이유:
1. 아직 테스트/초기 운영 단계 — URL이 바뀌어도 푸터 코드 1줄 수정이면 됨
2. 실 고객 결제가 꾸준히 들어오는 시점(일 10건+)에 고정 URL로 전환해도 늦지 않음
3. 사이트 DNS를 건드리는 건 리스크 대비 이득이 적음

**Quick Tunnel URL이 바뀌었을 때 할 일:**
1. `cloudflared tunnel --url http://localhost:7020` 재실행
2. 새 URL 복사
3. 아임웹 관리자 → 더클린커피 푸터 코드의 URL 변경
4. 아임웹 관리자 → 바이오컴 푸터 코드의 URL 변경
5. curl로 health check → 200 확인

---

## 2. 운영 체크리스트

### 2-1. 현재 지표 (중복 제거 후)

| 지표 | thecleancoffee_imweb | biocom_imweb | 전체 |
|------|---------------------|-------------|------|
| live row 수 | **3건** | **1건** | **4건** |
| 결제 금액 합계 | **₩77,425** | **₩39,000** | **₩116,425** |
| paymentKey 존재율 | 3/3 (100%) | 1/1 (100%) | **100%** |
| amount 존재율 | 3/3 (100%) | 1/1 (100%) | **100%** |
| utmSource 비어있는 비율 | 1/3 (33%) | 0/1 (0%) | **25%** |
| Toss 크로스 검증 가능 | ❌ Secret Key 미확보 | ✅ 검증 성공 | 1/2 사이트 |

### 2-2. utmSource 비어있는 1건 분석

| orderId | 202604017770927 |
|---------|-----------------|
| 원인 | V0.2 이전 버전(V0)으로 적재됨. 아임웹 세션을 읽지 않던 시점 |
| 해결 | V0.2 적용 이후 row는 모두 UTM 정상. 자연 해결됨 |

### 2-3. 일일 점검 API

```bash
# 커피 최근 live
curl -s localhost:7020/api/attribution/ledger?source=thecleancoffee_imweb&captureMode=live&limit=10

# 바이오컴 최근 live
curl -s localhost:7020/api/attribution/ledger?source=biocom_imweb&captureMode=live&limit=10

# 전체 요약 (source별 카운트 포함)
curl -s localhost:7020/api/attribution/ledger | jq '.summary.countsBySource'
```

---

## 3. 첫 운영형 성과 리포트

### 3-1. Source별 주문

| Source | 주문 건수 | 결제 금액 |
|--------|----------|-----------|
| thecleancoffee_imweb | 3건 | ₩77,425 |
| biocom_imweb | 1건 | ₩39,000 |
| **합계** | **4건** | **₩116,425** |

### 3-2. UTM Source/Medium별 유입

| UTM Source / Medium | 건수 | 결제 금액 | 비고 |
|---------------------|------|-----------|------|
| **channel_talk / campaign** | **1건** | **₩34,825** | ★ 실제 고객 주문 |
| test / cpc | 2건 | ₩60,300 | TJ님 테스트 |
| (direct) | 1건 | ₩21,300 | UTM 없이 직접 접속 (V0 시절) |

### 3-3. 핵심 인사이트

1. **채널톡 캠페인 → 실전환 1건 포착**: `utmSource=channel_talk`, `utmMedium=campaign`으로 유입된 고객이 ₩34,825 결제. P1-S1A가 실전에서 작동하고 있다는 증거.

2. **referrer에서 paymentKey 100% 추출**: 아임웹 결제 리다이렉트 URL 구조 덕분에 별도 PG 연동 없이도 paymentKey가 자동 확보됨.

3. **바이오컴은 Toss 크로스 검증까지 즉시 가능**: `iw_bi20260402003116rnVY6` → Toss API에서 `WAITING_FOR_DEPOSIT` (가상계좌 입금 대기) 확인 완료.

---

## 4. 코드 변경: 중복 방지

### 문제
`orderId=202604024192225`가 2번 적재됨. 결제완료 페이지에서 푸터 코드가 2회 실행된 것으로 보임 (페이지 리로드 등).

### 해결
`routes/attribution.ts`의 `payment-success` 핸들러에 중복 방지 로직 추가:
- 같은 `orderId` + `payment_success`가 **최근 5분 내**에 이미 적재되어 있으면 skip
- 응답: `200 OK, { skipped: true, reason: "duplicate_order_id" }`

기존 중복 1건은 ledger 파일에서 직접 제거 완료 (20건 → 19건).

---

## 5. checkout-context(V2) 판단

**결론: 보류.**

이유:
1. payment-success만으로 전환 원장의 핵심(누가 무엇을 샀는지 + 어디서 왔는지)이 충분히 잡힘
2. checkout-context는 "장바구니 이탈 분석"에 필요한데, 현재 우선순위는 이탈 분석이 아니라 **유입→전환 귀속**
3. 채널톡이 이미 `CheckoutBegin` / `CheckoutComplete` 이벤트를 아임웹에서 자동 추적 중 (desk.channel.io에서 확인 가능)
4. V2를 추가하면 아임웹 코드 삽입 포인트가 늘어나고 유지보수 부담 증가
5. **필요해지는 시점**: checkout abandon 실험(P7)을 실제로 돌릴 때. 그때 추가해도 늦지 않음

---

## 바꾼 파일

| 파일 | 변경 내용 |
|------|-----------|
| `backend/src/routes/attribution.ts` | payment-success 중복 방지 로직 (5분 내 같은 orderId skip) |
| `backend/logs/checkout-attribution-ledger.jsonl` | 중복 row 1건 제거 (20 → 19건) |

## 검증 결과

| 항목 | 결과 |
|------|------|
| TypeScript attribution 타입 체크 | ✅ 에러 0건 |
| 중복 제거 후 row 수 | 19건 (live 4, replay 5, smoke 3, 기타 7) |

## 남은 리스크

1. Quick Tunnel URL 재시작 시 변경 → 양쪽 사이트 푸터 코드 수동 업데이트 필요
2. 커피 Toss Secret Key 미확보 → 커피 크로스 검증 불가
3. 백엔드 서버 또는 Cloudflare Tunnel이 다운되면 live row 유실

## 바로 다음 액션 1개

**실 고객 주문이 자연적으로 들어오는지 1~2일 모니터링.** 채널톡 캠페인 유입 건이 이미 1건 잡혔으므로, 추가 실주문이 들어오면 P1-S1A가 운영 단계에 진입한 것이다. 모니터링 후 커피 Toss Secret Key 확보로 넘어간다.
