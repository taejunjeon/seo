# Google tag gateway POC 조사 및 활성화 승인안

작성 시각: 2026-05-07 20:45 KST
대상: biocom.kr · www.biocom.kr · thecleancoffee.com (AIBIO 도메인은 별도 sprint)
문서 성격: Yellow Lane 조사·승인안. 이 문서는 활성화 전 read-only 조사와 사전 결정 사항만 담는다. 실제 활성화는 별도 명시 승인 후 실행한다.
Status: read-only investigation / activation pending TJ approval
관련 문서: [[../total/!total-current]], [[gtm]], [[../gdn/!gdnplan]], [[../agent/!aiosagentplan]]
Do not use for: Google tag gateway 활성화, Cloudflare/Fastly/Akamai/CDN 권한 부여, GTM Production publish, 운영 backend deploy, 운영 DB write, GA4/Meta/Google Ads/TikTok/Naver 실제 전송, conversion upload, 광고 예산/캠페인 변경

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - GA4/gtm.md
    - total/!total-current.md
    - gdn/!gdnplan.md
  lane: Green for read-only investigation / Yellow for activation
  allowed_actions_now:
    - 공식 문서 read-only fetch
    - DNS/HTTP 헤더 read-only 조사
    - 호환성 분석 문서 작성
    - 활성화 전후 검증 계획 작성
    - 비활성화/롤백 계획 작성
    - 승인안 초안 작성
  allowed_actions_after_approval:
    - 측정 경로 결정 (예: `/_gtag/...` 또는 자사 first-party path)
    - Cloudflare 또는 대체 경로에서 wizard 진행
    - 활성화 후 Tag Assistant Hits Sent 검증
    - 활성화 후 paid_click_intent receiver 정상 동작 확인
    - 비활성화/롤백 (필요 시)
  forbidden_actions_until_explicit_separate_approval:
    - Google tag gateway 실제 활성화
    - Cloudflare/Fastly/Akamai/CDN 신규 계약 또는 nameserver 이전
    - GTM Production publish
    - 운영 backend deploy
    - 운영 DB/ledger write
    - GA4/Meta/Google Ads/TikTok/Naver 실제 전송
    - conversion upload
    - 광고 예산/캠페인 변경
  source_window_freshness_confidence:
    source: "Google for Developers + Google support (analytics/tag-manager) + Cloudflare developers docs + biocom.kr/thecleancoffee.com HTTP 헤더 + DNS"
    window: "2026-05-07 KST"
    freshness: "공식 문서 fetch 2026-05-07 20:40 KST. CDN/DNS read-only 조사 2026-05-07 20:42 KST"
    confidence: 0.85
```

## 5줄 결론

1. Google tag gateway는 **Google 측정 신호를 자사 도메인 first-party 경로로 받게 만드는 기능**이다. 자사 인프라를 통해 measurement request를 Google로 forward 한다.
2. biocom.kr · www.biocom.kr · thecleancoffee.com 모두 현재 **AWS CloudFront**(NRT12, Imweb 자사몰 인프라) 위에서 동작 중이다. Cloudflare를 사용하지 않는다.
3. 따라서 Google이 공식 제공하는 **Cloudflare wizard 경로는 그대로 적용할 수 없다**. 활성화하려면 ① Cloudflare 도입(DNS 변경) ② Imweb 측 native 지원 확인 ③ custom server endpoint 자체 구현 중 하나가 필요하다.
4. 현재 P0(`paid_click_intent Mode B 24h/72h monitoring`) 및 P1(minimal ledger write 판단 / confirmed_purchase no-send 재실행) 보다 우선되지 않는다. **중기 후보**로 둔다.
5. 본 문서는 조사·승인안까지만이다. 실제 활성화·DNS 이전·CDN 권한 부여는 TJ님 명시 승인 전 금지.

## 1. Google tag gateway가 무엇인가

Google이 제공하는 first-party measurement gateway 기능이다. 표준 설정에서는 사이트가 `googletagmanager.com` 등 Google 도메인에서 태그를 로드하고, 측정 이벤트를 Google 도메인으로 직접 보낸다. Gateway 설정에서는 자사 도메인이 태그를 로드하고, 일부 측정 이벤트도 자사 도메인의 measurement path를 거쳐 Google로 전달된다.

기대 효과 (공식 문서 기준):
- 광고차단/추적차단으로 끊기던 Google 측정 신호 일부 복구
- 자사 도메인이 1st-party이므로 cookie/payload 신뢰도 향상
- Tag Assistant Hits Sent에서 measurement path로 라우팅되는지 확인 가능

본 프로젝트와의 관계:
- Google Ads ROAS 계열 자동입찰 학습 신호 회복에 일부 기여 가능 (Google click id 보존률 개선과는 별개)
- 그러나 NPay confirmed_purchase 오염, Meta CAPI, BigQuery join, ProductEngagementSummary, AIBIO Supabase 정합성 등 **본 프로젝트의 핵심 정합성 병목은 직접 해결하지 않는다**

## 2. 공식 요구사항

| 요건 | 내용 | 근거 |
| --- | --- | --- |
| Google tag 또는 Tag Manager container 보유 | 사이트에 GA4 tag 또는 GTM container가 이미 설치되어 있어야 함 | Google for Developers 공식 가이드 |
| CDN 또는 load balancer | measurement request를 Google로 forward 가능한 자사 인프라 필요 | Google for Developers 공식 가이드 |
| Google tag settings 또는 CDN 관리자 권한 | 활성화/비활성화 권한 | Google support 가이드 |
| Cloudflare 사용자: 계정 역할 | Super Administrator, Administrator 또는 Zaraz Admin | Cloudflare developers docs |
| Cloudflare 사용자: zone 단위 활성화 | 활성화 시 해당 zone 내 모든 호스트네임/서브도메인에 적용 | Cloudflare developers docs |

## 3. biocom·coffee 인프라 호환성 조사

### 3.1 DNS / CDN read-only 결과

```text
biocom.kr A: 3.173.254.84 / 102 / 71 / 66
biocom.kr Server: nginx
biocom.kr Via: 1.1 *.cloudfront.net (CloudFront)
biocom.kr X-Amz-Cf-Pop: NRT12-P9

www.biocom.kr A: 3.173.254.* (동일 CloudFront 대역)
www.biocom.kr Via: 1.1 *.cloudfront.net (CloudFront)
www.biocom.kr X-Amz-Cf-Pop: NRT12-P8

thecleancoffee.com A: 3.173.197.125 / 54 / 57 / 93
thecleancoffee.com Via: 1.1 *.cloudfront.net (CloudFront)
thecleancoffee.com X-Amz-Cf-Pop: NRT12-P8
```

### 3.2 결론

- 세 사이트 모두 AWS CloudFront 위에서 동작.
- DNS nameserver는 `bns1/bns2/bns3.hostcocoa.com`(Imweb 자사몰 호스팅).
- Cloudflare zone에 등록되어 있지 않음 → Cloudflare wizard 즉시 적용 **불가**.

### 3.3 가능한 활성화 경로

| 옵션 | 내용 | 장점 | 단점 / blocker |
| --- | --- | --- | --- |
| A. Cloudflare 앞단 도입 | biocom.kr / thecleancoffee.com nameserver를 Cloudflare로 이전, Imweb origin 그대로 | 공식 wizard 그대로 사용 | DNS 이전 영향 큼 (이메일·기존 CDN·SSL·기존 캐시 정책 모두 재검증). Imweb과의 origin 호환성 별도 확인 |
| B. Imweb native 지원 확인 | Imweb이 Google tag gateway 또는 1st-party measurement를 native로 지원하는지 문의 | 인프라 변경 최소 | 현재 공식 지원 미확인. Imweb 응답 의존 |
| C. 자체 backend custom 구현 | `att.ainativeos.net` 또는 다른 first-party endpoint에서 measurement path 자체 프록시 | 통제 가능 | 작업량 가장 큼. 공식 wizard 외 경로라 Tag Assistant 검증·rollback 패턴이 비표준 |

### 3.4 권장 조사 순서 (이번 sprint 범위)

1. 공식 문서 fetch — 완료 (본 문서 §2).
2. CDN/DNS read-only 조사 — 완료 (본 문서 §3.1).
3. Imweb 측 native 지원 가능성 문의 초안 작성 — 본 문서 §6에 정리.
4. Cloudflare 도입 시 DNS·SSL·기존 CloudFront 캐시 영향 분석 — 별도 후속 sprint(POC 단계).
5. 자체 backend custom 구현 견적 — 본 문서 §3.3 옵션 C에 한계만 명시. 견적은 옵션 A·B가 모두 막힐 때 별도 sprint.

## 4. 기존 시스템과의 충돌 가능성

| 영역 | 충돌 가능성 | 판단 근거 |
| --- | --- | --- |
| paid_click_intent receiver (`/api/attribution/paid-click-intent/no-send`) | 낮음 | measurement path는 Google 측 path와 별개 first-party endpoint. paid_click_intent receiver는 자체 attribution endpoint로 path 충돌 없음. 단 measurement path 결정 시 `/api/attribution/...` 와 겹치지 않게 한다 |
| GTM live version 142 (paid_click_intent_v1_receiver_20260506T150218Z) | 낮음 | Gateway 활성화는 GTM container 자체를 변경하지 않음. 단, gateway 활성화 후 `Default Workspace` 변경 0 유지 여부를 별도 sprint에서 재확인 |
| Google Ads conversion linker / AW-304339096 | 낮음 | Conversion linker는 cookie/parameter 전달 메커니즘이며 gateway path와 분리 |
| GA4 tag `G-WJFXN5E2Q1` | 낮음 | Gateway가 활성화되면 일부 hit이 measurement path로 전송될 뿐 GA4 tag 정의는 변경되지 않음 |
| Google Ads `구매완료` Primary 전환 (AW-308…) | 낮음 | Gateway는 conversion action 자체를 변경하지 않음. Primary 변경은 별도 future Red 승인안 |
| Meta CAPI · NPay · BigQuery join · ProductEngagementSummary | 해당 없음 | Google tag gateway는 Google 측정만 다룸. Meta/Naver는 별도 |

## 5. 활성화 전후 검증 계획 (활성화 승인 시 적용)

### 5.1 활성화 전 (read-only)
- 현재 GTM live version, default workspace conflict count, AW-304339096 / G-WJFXN5E2Q1 / `구매완료` primary 상태를 다시 snapshot.
- biocom.kr/www/thecleancoffee.com Server/Via/X-Amz-Cf-Pop 헤더 snapshot.
- Tag Assistant 기준 Hits Sent path가 Google 도메인으로 가는 것 확인.
- 기존 `att.ainativeos.net` paid_click_intent receiver 200 baseline 기록.

### 5.2 활성화 후 (활성화 승인 후 실행)
- Cloudflare(또는 채택된 경로)에서 활성화 status가 `First-party`인지 확인.
- Tag Assistant 재실행 → Hits Sent에서 일부 hit이 measurement path 도메인으로 라우팅되는지 확인.
- GA4 DebugView에서 이벤트 수신이 활성화 전과 동일한지 확인.
- Google Ads 진단 화면에서 conversion linker / 광고 ID 인식 정상 여부.
- paid_click_intent receiver 200 유지, GTM live version 미변동.
- 24h 후 Google Ads 캠페인 reporting에서 conversion 수집 이상치 없는지 확인.

### 5.3 비활성화/롤백
- Cloudflare(또는 채택된 경로)에서 동일 wizard로 비활성화 토글.
- 활성화 전 snapshot과 동일 상태로 복귀하는지 확인.
- biocom.kr/thecleancoffee.com에서 사용자 영향 없음을 헤더·콘솔로 확인.

## 6. 활성화 전 결정해야 할 사항

| 항목 | 옵션 | 추천 | 이유 |
| --- | --- | --- | --- |
| 대상 도메인 | biocom.kr만 / +www / +thecleancoffee.com / +AIBIO | biocom.kr + www만 1단계 | 영향 범위 최소화. coffee와 AIBIO는 Mode B 안정화 후 별도 sprint |
| measurement path | `/_gtag/...` (gateway 기본 후보) / `/m/...` / 자체 path | `/_gtag/...` 또는 충돌 없는 자체 path | 기존 `/api/attribution/...` 와 분리. Imweb router 충돌 없음 확인 필요 |
| 활성화 경로 | A. Cloudflare 도입 / B. Imweb native / C. 자체 custom | B 가능성 우선 조사 | DNS 변경 영향이 가장 큰 경로(A)를 마지막 후보로 |
| 권한 부여 | Cloudflare/Imweb 관리자 권한 | TJ님 직접 진행 | 권한 부여는 비밀정보 영역. Codex는 권한 받지 않음 |
| 활성화 시점 | Mode B 24h/72h PASS 전 / 후 | 후 | Mode B 결과를 먼저 본 다음 활성화. 동시 변수 줄이기 |
| 알림 | Telegram / 문서만 | 문서만 | 본 작업은 외부 신호 변경. Telegram 자동 알림은 따로 결정 |

## 7. 한계와 명시 사항

- Google tag gateway는 **Google 측정 신호 회복 후보**다. **NPay confirmed_purchase 오염, Meta CAPI, AIBIO Supabase 정합성, BigQuery join, 캠페인 매핑 split_required**는 본 기능으로 해결되지 않는다.
- 활성화는 자동입찰 학습 신호와 무관해야 정상이지만, 활성화 후 24~72h 동안 Google Ads `구매완료` Primary action의 일별 conversion 수집 변동은 별도로 관측 필요.
- Cloudflare 도입(옵션 A)은 SEO·이메일·SSL·기존 CloudFront 캐시 정책 등 비측정 영역에 영향이 크다. 본 문서 범위 밖이며 별도 검토.

## 8. 참고 자료

- [Google for Developers — Set up Google tag gateway for advertisers](https://developers.google.com/tag-platform/tag-manager/gateway/setup-guide)
- [Google support — Tag Manager x Cloudflare 설정](https://support.google.com/tagmanager/answer/16061641?hl=en)
- [Google support — Google Ads x Cloudflare 설정](https://support.google.com/google-ads/answer/16061406?hl=en)
- [Cloudflare developers — Google tag gateway for advertisers](https://developers.cloudflare.com/google-tag-gateway/)
- [Cloudflare blog — First-party tags in seconds](https://blog.cloudflare.com/google-tag-gateway-for-advertisers/)

## 9. 다음 할 일

| 순서 | 담당 | 할 일 | 의존성 | 컨펌 필요 |
|---:|---|---|---|---|
| 1 | TJ + Codex | Imweb 자사몰 측 Google tag gateway 또는 first-party measurement 지원 여부 확인 | 본 문서 작성 후 즉시 가능 (TJ님 Imweb 문의 또는 Imweb help/도움말 검색) | NO, read-only 문의 |
| 2 | Codex | 옵션 B(Imweb native) 또는 옵션 C(자체 custom)로 진행할 경우의 measurement path/검증 단계 보강 | 1번 결과 의존 | NO |
| 3 | TJ | Cloudflare 도입(옵션 A) 검토 여부 결정 | 1번 결과가 부정적일 때 | YES, DNS/SSL 영향 |
| 4 | TJ | 실제 활성화 승인 (옵션 확정 후) | 2~3번 완료, P0 paid_click_intent Mode B 24h/72h PASS 후 | YES, Yellow → 실행 직전 명시 승인 |
