작성 시각: 2026-05-25 21:47 KST
기준일: 2026-05-25
문서 성격: VM Cloud 배포 결과 / no-write 분석 기준점

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_harness_read:
    - frontrule.md
    - docurule.md
    - project/google-npay-bridge-exact-review-table-20260525.md
    - project/google-npay-external-click-bridge-flow-diagnostic-20260525.md
    - project/google-npay-order-bridge-design-20260525.md
  required_context_docs:
    - data/!data_inventory.md
  lane: Yellow
  allowed_actions:
    - VM Cloud backend/frontend deploy
    - read-only API smoke
    - no-write NPay bridge candidate expansion
    - Google Ads dashboard display split
  forbidden_actions:
    - Google Ads conversion upload
    - 운영DB write
    - VM Cloud bridge ledger write
    - GTM publish
    - Imweb header/footer change
  source_window_freshness_confidence:
    source: VM Cloud live API + VM Cloud SQLite read-only + Google Ads API dashboard response
    window: last_7d
    freshness: 2026-05-25 21:36 KST public API smoke
    confidence: high_for_display_and_no_write_analysis / low_for_platform_send
```

## 10초 요약

NPay 외부 결제완료 주문과 내부 Google 클릭 흔적을 이어 보는 no-write 후보표를 확장했다.
이제 프론트 보고서에서 `내부 bridge 후보`와 `Google Ads 전송 후보`를 분리해서 볼 수 있다.
또한 캠페인별로 Google Ads가 주장하는 ROAS와 내부 주문 연결 수를 같은 화면에 나란히 표시한다.

중요한 결론은 두 가지다.

1. TJ님이 2026-05-24 13:53 KST에 만든 NPay 주문 `2026052431047480`은 no-write bridge 후보로 잡혔고, 같은 세션 paid-click 원장에서 Google campaign id `22018178848`까지 복원됐다.
2. 하지만 Google Ads로 실제 구매를 전송할 후보는 여전히 0건이다. 내부 분석 후보와 외부 전송 후보를 섞지 않는 것이 맞다.

## 무엇이 가능해졌나

### 1. NPay 외부 결제완료와 내부 click id 후보 확장

이제 NPay 외부 결제완료 주문을 아래 기준으로 더 깊게 본다.

- NPay 결제완료 주문번호
- 내부 주문번호
- NPay intent 수집 시각
- VM Cloud `imweb_orders` 주문 생성 시각
- Google click id 존재 여부
- `gad_campaignid` 직접 존재 여부
- 같은 client/session의 `paid_click_intent_ledger` 보조 증거

이번 배포 후 API에서 확인된 값:

- 실제 NPay 결제완료 주문: 20건
- 내부 bridge exact 후보: 17건
- 그중 Google click id 포함: 1건
- Google Ads 전송 후보: 0건
- VM Cloud write: 0건
- 운영DB write: 0건

### 2. Google campaign id 복원

문제였던 지점은 NPay intent row 자체에는 `gad_campaignid`가 빠져 있었지만, 같은 client/session의 `paid_click_intent_ledger`에는 남아 있었다는 점이다.

그래서 화면에는 아래처럼 출처를 분리해서 표시한다.

- `intent URL`: NPay intent 자체 URL에서 campaign id를 찾은 경우
- `같은 세션 paid-click`: 같은 client/session의 paid-click 원장에서 campaign id를 복원한 경우
- `같은 세션 landing`: site landing 원장에서 복원한 경우
- `없음`: 복원 실패

확인된 대표 row:

- NPay 주문번호: `2026052431047480`
- 내부 주문번호: `202605242646467`
- 결제완료 시각: 2026-05-24 13:53 KST
- 금액: 39,000원
- 상품: 바이오밸런스 90정
- Google click id: gclid + gbraid 있음
- campaign id: `22018178848`
- campaign id evidence source: `same-session paid-click`
- internal bridge decision: manual review candidate
- Google Ads send decision: blocked no-send

## 캠페인별 화면 분리

프론트 보고서에 새 섹션을 추가했다.

섹션 이름:

`캠페인별 Google 주장 ROAS와 내부 주문 연결`

이 섹션은 같은 캠페인을 한 줄에 놓고 아래 값을 분리해서 보여준다.

- Google Ads 주장 ROAS: Google Ads가 구매로 세는 전환값과 ROAS
- 내부 직접 연결 주문: 우리 주문 원장에 campaign id가 직접 붙은 주문
- NPay bridge 후보: 아직 원장에 쓰지 않은 no-write 후보
- Google Ads 전송 후보: 외부 전송해도 되는 주문 후보

2026-05-25 21:36 KST 기준 last_7d 공개 API 값:

- Google Ads 캠페인 row: 4개
- Google Ads 주장 전환값: 36,606,473원
- 내부 confirmed 매출: 760,900원
- Google Ads 주장 ROAS: 11.26x
- 내부 confirmed ROAS: 0.23x
- 내부 직접 campaign 연결 주문: 3건
- campaign id coverage: 82%
- NPay bridge candidate with campaign id `22018178848`: 1건 / 39,000원

## 검증 결과

통과:

- 로컬 backend typecheck 통과
- 로컬 frontend `tsc --noEmit` 통과
- VM Cloud backend typecheck 통과
- VM Cloud backend build 통과
- VM Cloud frontend `tsc --noEmit` 통과
- VM Cloud frontend build 통과
- `https://att.ainativeos.net/health` 200
- `https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_7d&campaign_limit=20` 200
- `https://biocom.ainativeos.net/ads/google-roas-report` 200
- Chrome headless smoke 통과
- PM2 status 확인: backend online, frontend online
- backend memory 안정 확인: `pm2 status` 약 290MB, process RSS 약 297MB

Chrome headless smoke 확인 항목:

- `NPay 내부 bridge 후보와 Google Ads 전송 후보` 섹션 표시
- `캠페인별 Google 주장 ROAS와 내부 주문 연결` 섹션 표시
- campaign id `22018178848` 표시
- `같은 세션 paid-click` evidence label 표시
- page error 0건

## 하지 않은 것

- Google Ads conversion upload 하지 않음
- 운영DB write 하지 않음
- VM Cloud bridge 원장 write 하지 않음
- GTM/Imweb 수정 없음
- 실제 결제 테스트 없음
- 광고 캠페인/예산/전환 액션 변경 없음

## 남은 판단

현재 화면은 내부 분석 후보를 더 잘 보여주지만, Google Ads에 구매를 보내는 단계는 아니다.
Google Ads 전송 후보가 0건인 이유는 이번 대표 row가 `Grade B`이고, 자동 전송 기준을 넘지 못했기 때문이다.

다음은 `Grade B`가 왜 `A`가 아닌지 사람이 이해할 수 있게 화면에서 더 잘 설명하고, `A`로 올릴 수 있는 추가 증거가 무엇인지 좁히는 작업이 필요하다.

## 운영 상태 메모

배포 직후 `pm2 jlist`에서 backend memory가 순간적으로 높게 보였으나, 재확인 결과 `pm2 status`와 OS process RSS 기준 backend는 약 290MB 수준이었다.
현재 고메모리 유지 상태는 아니다.

최근 backend log에는 이번 배포와 직접 관련 없는 기존 경고도 남아 있다.

- OpenAI quota 429
- Imweb/Toss sync aborted
- Naver Ads summary precompute timeout
- ROAS summary precompute aborted

이번 작업에서 새로 확인한 Google ROAS dashboard API는 200으로 응답했고, last_7d `campaign_limit=20` 기준 응답 시간은 약 12.3초였다.
