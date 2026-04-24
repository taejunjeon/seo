# 바이오컴 Header 교체 가이드

작성 시각: 2026-04-23 22:00 KST

## 결론

현재 바이오컴 최신 코드 문서 [biocom_imwebcode_최신.md](/Users/vibetj/coding/seo/capivm/biocom_imwebcode_최신.md) 안의 TikTok Header 블록은 **최신이 아니다**.

확인 결과:

- 버전: `2026-04-17.tiktok-purchase-guard-enforce.v1`
- 설정: `debug: true`

즉, 이 문서는 현재 운영에 들어가 있는 **구버전 v1 헤더 상태를 반영**하고 있다.

## 실제로 써야 하는 문서

TikTok Header 교체용 최신 문서는 아래다.

- [headercode.md](/Users/vibetj/coding/seo/tiktok/headercode.md)

이 문서 안에 아래가 모두 들어 있다.

- 운영 적용 승인 게이트
- browser CORS smoke
- live source 확인 기준
- 붙여넣을 최종 `<script>` 전체

## 무엇을 바꾸면 되나

아임웹 `공통 코드 삽입 > Header Code`에서 **기존 TikTok Guard v1 블록만 제거**하고, [headercode.md](/Users/vibetj/coding/seo/tiktok/headercode.md)의 `Header Code` 섹션 전체로 교체하면 된다.

바꾸면 안 되는 것:

- Meta `server-payment-decision-guard-v3`
- Funnel CAPI mirror
- footer attribution 코드
- 아임웹 자동 TikTok pixel 코드

## 현재 코드 상태 확인 근거

[biocom_imwebcode_최신.md](/Users/vibetj/coding/seo/capivm/biocom_imwebcode_최신.md) 안에서 확인된 값:

- `Version: 2026-04-17.tiktok-purchase-guard-enforce.v1`
- `debug: true`

따라서 현재 콘솔에 아래 로그가 보이는 것은 이상이 아니라 **아직 v1이 라이브에 남아 있다는 뜻**이다.

- `accessor_installed_TIKTOK_PIXEL`
- `wrapped_TIKTOK_PIXEL_track`
- `wrapped_ttq_track`

## Codex 판단

- `tiktok/headercode.md`는 현재 기준으로 **수정할 것 없음**
- 실제 필요한 작업은 **아임웹 Header Code 교체**
- 교체 후 확인 기준:
  - `2026-04-17.tiktok-purchase-guard-enforce.v1` -> 0회
  - `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log` -> 1회
