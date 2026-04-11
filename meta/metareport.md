# Meta Purchase 이벤트 품질 점검 리포트

작성 시각: 2026-04-11 16:50 KST

분석 대상:
- Meta Events Manager 화면: `바이오컴_TEMP` 데이터셋, Purchase 이벤트
- 샘플 활동 다운로드 파일: `/Users/vibetj/Downloads/바이오컴_TEMP_1283400029487161_Purchase_2026. 4. 11. 오후 4_42.csv`
- 관련 배경: Meta ROAS가 내부 Attribution ROAS보다 크게 높게 나오는 원인 중 하나로 Pixel/CAPI 중복 또는 CAPI 과다 수신 가능성을 점검

## 결론

이벤트 품질 개선 조치가 필요하다.

이번 샘플 활동 CSV는 이전의 시간대별 집계 파일보다 더 유용하지만, 최종 dedup 성공 여부를 직접 판정하기에는 부족하다. 파일에 `event_id`, Meta의 dedup status, 원주문번호 기준의 event-level 매칭 정보가 없다.

다만 방향성은 명확하다. Purchase 샘플에서 서버 CAPI 이벤트가 브라우저 Pixel 이벤트보다 많고, 서버 이벤트의 payload 구조도 일관되지 않다. 이 상태에서는 Meta가 실제 주문보다 Purchase를 더 넓게 잡거나, 일부 중복을 완전히 제거하지 못할 가능성을 계속 주요 원인 후보로 봐야 한다.

## CSV에서 확인된 수치

샘플 행 수:
- 전체 Purchase 샘플: 77건
- Browser 이벤트: 33건
- Server 이벤트: 44건

공통 필드:
- `timestamp`: 77건 모두 비어 있음
- `eventDetectionMethod`: 77건 모두 `manual_not_detected`
- `placedURL`: 68건은 `https://biocom.kr/`, 9건은 빈 값

Browser Purchase:
- `value`: 33건, 100.0%
- `currency`: 33건, 100.0%
- `content_ids`: 33건, 100.0%
- `contents`: 33건, 100.0%
- `content_type`: 33건, 100.0%
- `order_id`: 0건

Server Purchase:
- `value`: 44건, 100.0%
- `currency`: 44건, 100.0%
- `content_type`: 44건, 100.0%
- `order_id`: 9건, 20.5%
- `content_ids`: 14건, 31.8%
- `contents`: 14건, 31.8%
- `placedURL` 빈 값: 9건

## 중요한 관찰

서버 이벤트가 브라우저 이벤트보다 많다.

샘플 기준으로 `SERVER 44건`, `BROWSER 33건`이다. 이전 시간대별 집계에서도 서버 Purchase가 브라우저 Purchase보다 크게 많았다. 따라서 Meta ROAS 과대 원인 후보로 CAPI 과다 수신 또는 중복 전송 가능성은 계속 유효하다.

서버 이벤트 구조가 일관되지 않다.

일부 Server 이벤트에는 `order_id`가 있고, 일부는 `content_ids`만 있으며, 일부는 둘 다 없다. `placedURL`이 빈 Server 이벤트도 있다. 같은 Purchase라도 Meta에 전달되는 정보가 이벤트마다 다르면, Meta 이벤트 품질과 매칭 품질이 흔들린다.

`order_id`가 Meta 샘플에서 우리 주문번호 형태로 안정적으로 보이지 않는다.

우리 CAPI 로컬 코드에서는 `custom_data.order_id`로 내부 주문번호를 보내는 구조다. 하지만 Meta 샘플 활동 파일에서는 Server 이벤트 44건 중 9건만 `order_id`가 있고, 그 값도 `202604...` 형태의 우리 주문번호가 아니라 Meta 내부 식별자처럼 보이는 긴 문자열이다. 이 화면만으로는 우리 CAPI의 `order_id`가 Meta 샘플에 어떻게 표시되는지 확정할 수 없다.

`event_id`가 CSV에 없다.

dedup 검증의 핵심은 Browser Pixel Purchase와 Server CAPI Purchase가 같은 `event_id`를 쓰는지다. 이번 CSV에는 `event_id`가 없으므로, 주문 1건이 Meta 안에서 Purchase 1개로 합쳐졌는지 확인할 수 없다.

## 이벤트 품질 개선이 필요한 이유

Meta ROAS는 Meta가 Purchase로 인정한 전환값을 기준으로 계산된다. 이때 Browser Pixel과 Server CAPI가 같은 주문을 각각 다른 이벤트로 인식하면, Meta Purchase ROAS가 내부 Attribution ROAS보다 과대하게 보일 수 있다.

정상 구조는 다음과 같다.
- 사용자가 결제완료 페이지에 도달하면 Browser Pixel Purchase가 발생한다.
- 우리 서버도 같은 주문을 Server CAPI Purchase로 보낸다.
- 두 이벤트는 같은 `event_name=Purchase`와 같은 `event_id`를 가져야 한다.
- Meta는 같은 `event_id`를 보고 Browser/Server 이벤트를 같은 전환으로 중복제거한다.

현재는 이 정상 구조가 Meta 화면에서 확인되지 않았다. 특히 `event_id` 확인이 안 되고, Server payload도 일관되지 않기 때문에 조치가 필요하다.

## 개선 우선순위

1. Browser Purchase와 Server Purchase의 `event_id` 일치 여부를 Test Events에서 확인한다.

같은 주문에서 Browser와 Server Purchase가 둘 다 뜰 때, 두 이벤트의 `event_id`가 같아야 한다. 다르면 Meta가 같은 주문을 2건으로 볼 수 있다.

2. Server CAPI의 `event_source_url`을 항상 절대 URL로 보낸다.

로컬 CAPI 로그에는 `/shop_payment_complete` 같은 상대경로가 일부 남아 있고, Meta 샘플에서도 Server `placedURL` 빈 값이 있다. Meta에는 `https://biocom.kr/...` 형태의 절대 URL을 보내는 것이 맞다.

3. Server CAPI payload에 내부 주문번호가 안정적으로 보이게 한다.

우리 코드상 `custom_data.order_id`는 보내고 있지만, Meta 샘플 CSV에서는 우리 주문번호 형태로 확인되지 않는다. Test Events에서 실제 payload 상세를 열어 `custom_data.order_id`가 들어가는지 확인해야 한다.

4. Server CAPI에 상품 정보도 가능하면 보강한다.

현재 Server 이벤트의 `content_ids/contents` 커버리지는 31.8% 수준이다. 상품 ID, 수량, 금액을 안정적으로 붙이면 이벤트 품질과 최적화 품질이 좋아질 수 있다. 다만 dedup 관점의 1순위는 `event_id`다.

5. 식별자 품질을 계속 올린다.

`_fbc`, `_fbp`, `fbclid`, IP, user-agent, 이메일/전화번호 해시값은 Meta 이벤트 매칭 품질에 영향을 준다. 내부 caller coverage 기준 `payment_success` 식별자 유입률은 개선 중이지만 아직 충분하지 않다.

## 다음 검증 절차

Meta Events Manager의 `샘플 활동` CSV만으로는 dedup 성공 여부를 판정할 수 없다. 다음은 `Test Events`를 켜고 새 테스트 주문 1건으로 확인해야 한다.

대표님이 Meta 화면에서 바로 할 일:
- Meta Events Manager에서 `바이오컴_TEMP` 데이터셋을 연다.
- `Test Events` 화면을 연다.
- 웹사이트 URL 입력칸에 실제 결제 흐름 시작 URL을 넣는다. 예: 상품 상세, 공동구매 랜딩, 검사 상품 랜딩.
- 이벤트 테스트를 눌러 새 탭을 연다.
- 새 탭에서 `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`가 발생하도록 결제 흐름을 진행한다.
- 다시 Meta 화면으로 돌아와 위 이벤트들이 Browser로 뜨는지 확인한다.

개발 쪽에서 서버 CAPI를 같은 Test Events 화면에 띄우는 방법:
- 백엔드에는 특정 주문 1건만 Test Events로 보내는 필터가 필요하다.
- 2026-04-11 기준 `POST /api/meta/capi/sync`에 `order_id`, `payment_key`, `test_event_code` 필터를 연결했다.
- 따라서 테스트 주문이 local ledger에 `confirmed`로 들어오면 아래처럼 특정 주문만 `TEST95631`로 전송할 수 있다.

```bash
curl -X POST "http://localhost:7020/api/meta/capi/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "테스트주문번호",
    "test_event_code": "TEST95631",
    "limit": 1
  }'
```

주의:
- 이 `sync` 경로는 confirmed 주문만 후보로 잡는다.
- 가상계좌 미입금 주문은 운영 CAPI 전송 대상이 아니므로, 자동 sync에서는 제외된다.
- 가상계좌 미입금 주문으로 서버 CAPI까지 강제로 테스트하려면 `/api/meta/capi/send` 단건 수동 테스트를 써야 하지만, 이 경우 운영 confirmed 흐름과는 다르다.
- 최종 dedup 검증은 가능한 한 카드 결제 또는 입금 완료된 테스트 주문으로 하는 것이 가장 정확하다.

확인할 것:
- Purchase 이벤트가 Browser와 Server 양쪽에서 들어오는지 확인한다.
- 두 이벤트의 `event_id`가 같은지 확인한다.
- Server 이벤트 상세에서 `custom_data.order_id`, `value`, `currency`, `event_source_url`, `fbc/fbp`, user-agent, IP가 들어오는지 확인한다.
- 확인 화면을 캡처한다.

판정 기준:
- Browser와 Server가 같은 `event_id`: dedup 가능성이 높음
- Browser와 Server가 다른 `event_id`: Meta 중복 집계 위험 높음
- Server만 여러 번 뜨고 같은 `event_id`: retry-like 중복, Meta 처리 결과 추가 확인 필요
- Server만 여러 번 뜨고 서로 다른 `event_id`: 가장 위험한 중복

## 현재 판단

Meta 화면의 `전환 API 보고 추가 전환 +125.7%`는 서버 CAPI가 Pixel 대비 추가 전환을 많이 보고하고 있다는 뜻이다. 이것이 전부 진짜 추가 매출이라고 보기는 어렵다. 정상적인 서버 보완분과 중복/재시도/품질 불안정분이 섞여 있을 수 있다.

따라서 현재 단계의 판단은 다음과 같다.
- Meta ROAS는 계속 보되, 클릭 1일 기준을 메인 참고값으로 낮춰 본다.
- 내부 Attribution ROAS는 보수적인 운영 기준으로 유지한다.
- Meta와 내부 ROAS 차이의 핵심 원인 후보는 CAPI/Purchase 이벤트 품질과 dedup 여부다.
- 다음 액션은 광고 증액 판단이 아니라 Test Events로 `event_id` dedup을 확정하는 것이다.

## 추가 확인: 가상계좌 미입금 주문의 Browser Purchase

확인 시각: 2026-04-11 22:25 KST 전후

확인 내용:
- 가상계좌 주문번호: `202604114568447`
- 결제 상태: 미입금, local ledger 기준 `paymentStatus=pending`
- 금액: 39,000원
- local payment key: `iw_bi20260411222457z2W48`
- local checkout id: `chk_1775913890793_p3mzxcxu`
- Meta Pixel Helper: 결제완료 페이지에서 Browser `Purchase`가 `value=39000`, `currency=KRW`, `content_ids=["97"]`로 발화

해석:
- 입금 전 가상계좌 주문도 브라우저 Pixel 기준으로는 이미 Purchase로 잡힌다.
- 우리 서버 CAPI는 입금 전 가상계좌 주문을 전송하지 않는다. 최신 CAPI 로그에도 이 주문은 없다.
- 따라서 이 케이스는 Pixel/CAPI dedup 문제가 아니라 **Browser Pixel의 Purchase 정의가 내부 confirmed 기준보다 빠른 문제**다.
- Meta는 이 주문을 Purchase로 볼 수 있고, 내부 Attribution confirmed ROAS는 아직 매출로 보지 않는다. 이 차이는 Meta purchase 수가 내부 confirmed 주문 수보다 커지는 직접 원인이다.

Purchase를 confirmed 시점으로 늦추는 방향:
- 원칙적으로 맞다. 내부 운영 ROAS와 맞추려면 Meta Purchase도 `입금/승인 완료` 기준이어야 한다.
- 가상계좌는 사용자가 나중에 입금하므로, 브라우저 Pixel만으로 confirmed 시점 Purchase를 정확히 보낼 수 없다.
- 따라서 confirmed 기준 Purchase는 서버 CAPI가 정본이 되어야 한다.
- 결제완료 페이지의 브라우저 이벤트는 `Purchase`가 아니라 `InitiateCheckout`, `AddPaymentInfo`, 또는 별도 custom event인 `VirtualAccountIssued` 정도로 낮추는 것이 맞다.

실행 옵션:
- 가장 안정적인 방식: 아임웹/Meta 기본 구매 추적에서 결제완료 페이지 Purchase 자동 발화를 끄고, 우리 쪽에서 confirmed CAPI Purchase만 보낸다.
- 차선책: 사이트 공통 코드에서 `fbq('track', 'Purchase')`를 가상계좌 미입금 화면에서만 차단한다. 다만 실행 순서와 아임웹 내부 스크립트에 의존하므로 운영 반영 전 테스트가 필요하다.
- 카드 결제는 결제완료 시점이 곧 confirmed에 가깝기 때문에 Browser Purchase를 유지할 수 있다. 다만 CAPI와 병행하려면 Browser `eventID`와 CAPI `event_id`를 반드시 맞춰야 한다.

바로 해야 할 일:
- 아임웹 관리자 또는 현재 사이트 코드에서 Meta Pixel Purchase 자동 발화 설정 위치를 찾는다.
- 가상계좌 미입금 주문완료 화면에서 Purchase만 차단 가능한지 확인한다.
- 차단이 가능하면 가상계좌 미입금은 `VirtualAccountIssued`로 대체하고, 입금 완료 후 CAPI Purchase를 보낸다.
- 차단이 불가능하면 아임웹 기본 Meta Pixel 구매 추적을 끄고, 자체 Pixel/CAPI 이벤트 체계로 전환하는 방안을 검토한다.
