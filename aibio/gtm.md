# AIBIO GTM 운영 변경 기록

기준일: 2026-04-17 KST

## 2026-04-17 마이크로 전환 이벤트 게시

대상 컨테이너:

| 항목 | 값 |
|---|---|
| GTM Account | `4703003246` / `바이오컴(최종)` |
| GTM Container | `92360859` / `AIBIO` |
| Public ID | `GTM-T8FLZNT` |
| Published version | `4` |
| Version name | `AIBIO micro conversion events 2026-04-17` |

게시된 태그:

| 태그 ID | 태그명 | 유형 | 트리거 |
|---:|---|---|---|
| `16` | `AIBIO Listener - ChannelTalk open + ticket checkout` | Custom HTML | All Pages |
| `17` | `GA4 aibio_kakao_click` | GA4 이벤트 | `11` / `AIBIO - Kakao channel click` |
| `18` | `Meta Custom - aibio_kakao_click` | Custom HTML / `fbq('trackCustom')` | `11` / `AIBIO - Kakao channel click` |
| `19` | `GA4 aibio_channeltalk_open` | GA4 이벤트 | `12` / `AIBIO - ChannelTalk open` |
| `20` | `Meta Custom - aibio_channeltalk_open` | Custom HTML / `fbq('trackCustom')` | `12` / `AIBIO - ChannelTalk open` |
| `21` | `GA4 aibio_ticket_checkout` | GA4 이벤트 | `13` / `AIBIO - Ticket checkout intent` |
| `22` | `Meta Custom - aibio_ticket_checkout` | Custom HTML / `fbq('trackCustom')` | `13` / `AIBIO - Ticket checkout intent` |
| `23` | `GA4 aibio_engaged_60s` | GA4 이벤트 | `14` / `AIBIO - Engaged 60 seconds` |
| `24` | `Meta Custom - aibio_engaged_60s` | Custom HTML / `fbq('trackCustom')` | `14` / `AIBIO - Engaged 60 seconds` |
| `25` | `GA4 aibio_scroll_90` | GA4 이벤트 | `15` / `AIBIO - Scroll 90 percent` |
| `26` | `Meta Custom - aibio_scroll_90` | Custom HTML / `fbq('trackCustom')` | `15` / `AIBIO - Scroll 90 percent` |

게시된 트리거:

| 트리거 ID | 트리거명 | 유형 | 조건 |
|---:|---|---|---|
| `11` | `AIBIO - Kakao channel click` | Link Click | `{{Click URL}}` matches `^https?://pf\.kakao\.com/_jRxcPK(/chat)?/?$` |
| `12` | `AIBIO - ChannelTalk open` | Custom Event | `{{_event}} equals aibio_channeltalk_open` |
| `13` | `AIBIO - Ticket checkout intent` | Custom Event | `{{_event}} equals aibio_ticket_checkout` |
| `14` | `AIBIO - Engaged 60 seconds` | Timer | `{{Page Hostname}}` matches `(^|\.)aibio\.ai$`, 60,000ms, limit 1 |
| `15` | `AIBIO - Scroll 90 percent` | Scroll Depth | `{{Page Hostname}}` matches `(^|\.)aibio\.ai$`, vertical 90% |

운영 판단:

- 이 이벤트 세트는 폼 제출 전 단계의 관심 신호를 GA4와 Meta Pixel에 동시에 남긴다.
- `aibio_kakao_click`, `aibio_engaged_60s`, `aibio_scroll_90`는 GTM만으로 즉시 발화된다.
- `aibio_channeltalk_open`은 GTM 리스너가 ChannelTalk `onShowMessenger`와 위젯 클릭을 감지해 `dataLayer`에 밀어 넣는다.
- `aibio_ticket_checkout`은 `/shop_view/?idx=25` 체험권/패키지 페이지에서 구매/주문/결제 의도 버튼을 누를 때 발화한다. 현재 상품 페이지에 실제 구매 CTA가 노출되지 않으면 이벤트는 대기 상태다.
- Meta에는 표준 전환이 아니라 `trackCustom`으로 보낸다. 광고 최적화 이벤트로 바로 쓰기보다 리타겟팅/퍼널 진단 신호로 먼저 본다.

검증:

- GTM API `quick_preview` 컴파일 검사 통과 후 version `4` 생성 및 게시.
- GTM API 최신 게시본 확인: version `4`, tags `14`, triggers `7`.
- GTM live JS 확인: `aibio_kakao_click`, `aibio_channeltalk_open`, `aibio_ticket_checkout`, `aibio_engaged_60s`, `aibio_scroll_90`, `2026-04-17-aibio-micro-events-v1`, `fbq('trackCustom')` 포함.
- 문제가 생기면 GTM version `3` / `AIBIO form_submit GA4 + Meta Lead 2026-04-16`로 롤백한다.

## 2026-04-16 Meta Lead 게시

대상 컨테이너:

| 항목 | 값 |
|---|---|
| GTM Account | `4703003246` / `바이오컴(최종)` |
| GTM Container | `92360859` / `AIBIO` |
| Public ID | `GTM-T8FLZNT` |
| Published version | `3` |
| Version name | `AIBIO form_submit GA4 + Meta Lead 2026-04-16` |

게시된 태그:

| 태그 ID | 태그명 | 유형 | 트리거 |
|---:|---|---|---|
| `6` | `GA4 generate_lead` | GA4 이벤트 | `8` / `아임웹 폼 제출` |
| `7` | `Google Ads 리마케팅` | Google Ads 리마케팅 | All Pages |
| `10` | `Meta Lead - AIBIO form_submit` | Custom HTML | `8` / `아임웹 폼 제출` |

게시된 트리거:

| 트리거 ID | 트리거명 | 유형 | 조건 |
|---:|---|---|---|
| `8` | `아임웹 폼 제출` | Custom Event | `{{_event}} equals aibio_form_submit` |
| `3` | `이벤트-클릭-카톡채널` | Link Click | `{{Click URL}} equals https://pf.kakao.com/_jRxcPK` |

Meta Lead 태그 동작:

- `aibio_form_submit` dataLayer 이벤트에서 최신 `formId`, `formWidgetId`를 읽는다.
- Meta Pixel `fbq('track', 'Lead')`를 전송한다.
- `eventID`는 `Lead.{formId}`를 우선 사용하고, 없으면 `Lead.{formWidgetId}.{timestamp}`로 생성한다.
- 전송 직전 `window.__AIBIO_META_LEAD_LAST__`에 `eventId`, `formId`, `formWidgetId`, `sentAt`을 남긴다.

검증:

- GTM API 최신 게시본 확인: version `3`, tags `3`, triggers `2`.
- GTM live JS 확인: `generate_lead`, `aibio_form_submit`, `fbq("track","Lead")`, `2026-04-16-aibio-meta-lead-gtm-v1` 포함.
- 2026-04-16 KST 브라우저 Network 확인: `https://www.facebook.com/tr/` POST `200 OK`, `id=1068377347547682`, `ev=Lead`, `eid=Lead._59_w20250218fdfa6318ce162_1776315464919`.
- 같은 제출 시점에 Meta 자동 감지 `SubscribedButtonClick`도 별도 전송됨. 이 이벤트는 자동 버튼 클릭 이벤트이고, 명시적 리드 전환은 `ev=Lead`를 기준으로 본다.

다음 확인:

1. AIBIO 폼을 실제로 1건 제출한다.
2. GTM Preview에서 `GA4 generate_lead` 1회, `Meta Lead - AIBIO form_submit` 1회 실행을 확인한다.
3. Meta Events Manager 이벤트 테스트에서 `Lead`가 Pixel `1068377347547682`로 들어오는지 확인한다.
4. 내부 attribution 원장 `form_submit` 1건과 Meta `Lead` 1건이 같은 테스트 제출 기준으로 맞는지 비교한다.
