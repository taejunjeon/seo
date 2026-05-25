작성 시각: 2026-05-26 00:14 KST
기준일: 2026-05-26
문서 성격: Meta 원본 랜딩 bridge VM Cloud 배포 결과 + placeholder 16건 read-only 진단

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - docurule.md
    - frontrule.md
    - capivm/vmdeploy.md
  lane: Yellow deploy approved by TJ님 in chat + Green read-only diagnostic
  allowed_actions:
    - VM Cloud target file backup
    - deploy scoped backend/frontend Meta UTM bridge files
    - deploy read-only bridge JSON/report artifact
    - remote typecheck/build
    - pm2 restart seo-backend and seo-frontend
    - public read-only smoke
    - VM Cloud SQLite read-only placeholder aggregate
  forbidden_actions:
    - Meta account mutation
    - Meta CAPI manual send/backfill
    - GA4/Google/TikTok/Naver platform send
    - GTM submit/create_version/publish
    - Imweb header/footer save
    - operating DB write/import
    - VM Cloud SQLite schema/data write
  source_window_freshness_confidence:
    source: VM Cloud backend/frontend + VM Cloud SQLite read-only attribution_ledger
    window: /iiary02 bridge 2026-05-18 00:00:00 ~ 2026-05-26 00:00:00 UTC
    site: biocom
    freshness: 2026-05-26 00:10 KST post-deploy smoke
    confidence: high for deploy/API/UI smoke, high for placeholder aggregate counts, medium for root-cause until Meta click surface is reproduced
```

## 10초 요약

VM Cloud 외부 보고서에 `/iiary02` 원본 랜딩 bridge를 배포했다.

이제 `https://biocom.ainativeos.net/ads/meta-utm?account_id=act_3138805896402376&date_preset=last_7d` 화면에서 고객 유입 장부에는 0건처럼 보이던 `/iiary02` 원본 랜딩을 결제/체크아웃 원장 기준 148건으로 볼 수 있다.

16건 placeholder는 우리 쪽이 숫자를 지운 것이 아니다. 같은 URL 구조의 132건은 정상적으로 숫자와 placement가 들어왔고, 16건은 `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}`, `{{site_source_name}}`, `{{placement}}`가 모두 그대로 남았다. 즉 일부 클릭 경로에서 Meta 동적 매개변수 치환 전체가 실패한 상태로 들어온 것으로 보는 것이 맞다.

## 배포 범위

- Backend: `backend/src/routes/ads.ts`
- Frontend: `frontend/src/app/ads/meta-utm/page.tsx`
- Bridge artifact:
  - `data/project/vm-original-landing-bridge-readonly-20260525.json`
  - `project/vm-original-landing-bridge-readonly-20260525.md`

전체 저장소 rsync는 하지 않았다. 현재 로컬 워크트리에 다른 변경이 많아서 이번 Meta UTM 보고서에 필요한 파일만 VM Cloud에 반영했다.

이번 파일 단위 배포에는 TJ님이 앞서 승인한 `topbanner_MO` 제외 규칙과 `ig/link_in_bio` 보조 소셜 유입 제외 규칙도 같이 포함됐다. 두 규칙은 Meta 미매핑 오분류 제외용이며, 광고 계정 설정이나 외부 플랫폼 전송을 바꾸지 않는다.

## 백업

VM Cloud backup path:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/meta-original-landing-bridge-20260525T150327Z
```

배포 후 파일 hash:

```text
backend/src/routes/ads.ts
659c1715acf42e6b71cd6226b064aaa60e8b52b39f1ec02a206c8733f3e59068

frontend/src/app/ads/meta-utm/page.tsx
d29a7db96e8c5c190417cb4e9a59a7f5e709b35f71f870098071d36d097ff0d9

data/project/vm-original-landing-bridge-readonly-20260525.json
ec11e8f28b43bdc0628d9f9a33f7ed1f248e460521e7cc295a5344fbde537794
```

## 검증 결과

- 로컬 backend typecheck: PASS
- 로컬 frontend lint: PASS, 기존 `<img>` warning 1개만 있음
- harness preflight strict: PASS
- VM Cloud backend typecheck: PASS
- VM Cloud backend build: PASS
- VM Cloud frontend build: PASS
- `pm2 restart seo-backend --update-env`: PASS, restart count 18 -> 19
- `pm2 restart seo-frontend --update-env`: PASS, restart count 11 -> 12
- `pm2 save`: PASS
- `https://att.ainativeos.net/health`: HTTP 200
- `https://att.ainativeos.net/api/ads/meta-utm-diagnostics?...`: HTTP 200, `originalLandingBridge.status=loaded`
- `https://biocom.ainativeos.net/ads/meta-utm?...`: HTTP 200
- Playwright external smoke: PASS
  - `원본 랜딩 bridge` 패널 표시
  - 148건 표시
  - 132건 표시
  - console error 0
  - failed API request 0

스크린샷:

```text
/Users/vibetj/coding/seo/data/project/meta-original-landing-bridge-vm-cloud-smoke-20260525.png
```

## 배포 후 bridge 숫자

Source: VM Cloud backend + VM Cloud SQLite read-only bridge artifact

Window: 2026-05-18 00:00:00 ~ 2026-05-26 00:00:00 UTC

Freshness: bridge artifact generated 2026-05-25 23:23 KST, post-deploy smoke 2026-05-26 00:10 KST

Confidence: high for bridge count, medium-high for attribution interpretation

```text
site_landing_ledger /iiary02 exact path rows: 0
original landing bridge rows: 148
numeric campaign/adset/ad ID rows: 132
template placeholder rows: 16
confirmed payment rows: 54
confirmed revenue: ₩19,636,820
```

## placeholder 16건 진단

### 사람이 이해하는 결론

16건은 `UTM이 전부 없던 유입`이 아니다. `utm_source=meta`, `utm_medium=paid_social`은 남아 있었고, Meta 유료 유입임은 볼 수 있다.

하지만 campaign/adset/ad를 확정하는 숫자 키가 전부 템플릿 문구로 남았다. 더 중요한 점은 `meta_site_source`와 `meta_placement`도 숫자나 실제 placement 값으로 바뀌지 않았다. 즉 우리 쪽 파서가 일부 항목만 놓친 것이 아니라, 그 클릭 URL에서는 Meta가 동적 매개변수를 실제 값으로 바꾸지 않은 상태로 들어왔다.

### 16건 집계

```text
placeholder rows: 16
checkout_started rows: 10
payment_success confirmed rows: 6
confirmed revenue: ₩1,894,000
distinct safe sessions: 8
distinct safe click ids: 3
same-session prior numeric UTM rows: 0
same-session later numeric UTM rows: 0
```

`same-session numeric UTM`이 0이라는 뜻은 같은 세션 안에서 앞뒤로 숫자 campaign/adset/ad ID가 남은 다른 row를 찾지 못했다는 뜻이다. 따라서 이 16건은 현재 원장만으로 특정 광고세트나 광고소재에 자동 배정하면 안 된다.

### 시간대 분포

| KST hour | rows | confirmed rows | confirmed revenue |
|---|---:|---:|---:|
| 2026-05-18 15:00 | 2 | 1 | ₩459,000 |
| 2026-05-20 23:00 | 2 | 1 | ₩234,000 |
| 2026-05-21 07:00 | 4 | 1 | ₩234,000 |
| 2026-05-21 23:00 | 2 | 1 | ₩234,000 |
| 2026-05-22 02:00 | 2 | 1 | ₩248,000 |
| 2026-05-22 09:00 | 2 | 0 | ₩0 |
| 2026-05-24 16:00 | 2 | 1 | ₩485,000 |

한 시점에 몰린 단일 버그라기보다 3개의 safe click id에서 여러 세션/결제 단계로 이어진 것으로 보인다.

### 남아 있던 파라미터 값

```text
utm_source: meta
utm_medium: paid_social
utm_campaign: {{campaign.id}}
utm_term: {{adset.id}}
utm_content: {{ad.id}}
campaign_alias: meta_biocom_광고별칭
meta_campaign_id: {{campaign.id}}
meta_adset_id: {{adset.id}}
meta_ad_id: {{ad.id}}
meta_site_source: {{site_source_name}}
meta_placement: {{placement}}
```

132건 정상 row와 16건 placeholder row는 원본 랜딩 URL의 key 구조가 거의 같다.

정상 132건은 `meta_site_source=ig`, `meta_placement=Instagram_Feed/Reels/...`, `meta_campaign_id=120...`처럼 들어왔다.

문제 16건은 같은 자리에 `{{site_source_name}}`, `{{placement}}`, `{{campaign.id}}`가 그대로 남았다.

## TJ님이 준 랜딩 URL 해석

TJ님이 준 URL은 `https://biocom.kr/iiary02?...`에 `fbclid`만 붙은 형태다.

이 URL만으로는 `실제 광고 클릭에서 UTM 숫자 치환이 되는지`를 판정할 수 없다. 이유는 Ads Manager의 검토/공유/웹사이트 URL 복사 화면은 최종 광고 클릭 URL이 아니라 base website URL 또는 Facebook redirect URL만 보여줄 수 있기 때문이다.

다만 같은 광고세트의 원장 결과를 보면 아래는 확인된다.

- `meta_biocom_iiari_260518`: adset ID `120245700952890396`, bridge 89 rows
- `meta_biocom_iiari_260518 - 사본`: adset ID `120245956430970396`, bridge 26 rows

이 두 광고세트에서는 실제 고객 유입 원장에 숫자 ID가 많이 남아 있다. 따라서 현재 설정은 상당 부분 정상 작동 중이다.

## 아직 확정하지 않은 것

- 16건이 어느 광고소재 1개에서 발생했는지는 아직 확정하지 않았다.
- 현재 원장에는 16건을 특정 광고소재로 자동 배정할 숫자 ID가 없다.
- Meta의 미리보기/공유/검토 클릭 경로 때문인지, 특정 복제 광고 설정 때문인지는 추가 재현이 필요하다.

## 하지 않은 것

- Meta 광고 설정 저장: 0
- Meta CAPI manual send/backfill: 0
- GA4/Google/TikTok/Naver platform send: 0
- GTM submit/create_version/publish: 0
- Imweb header/footer save: 0
- 운영DB write/import: 0
- VM Cloud SQLite schema/data write: 0

주의: VM Cloud backend restart 이후 기존 운영 자동작업은 환경 설정대로 계속 켜져 있다. 이번 작업에서 수동 전환 전송은 하지 않았지만, 기존 `capiAutoSync`, `attributionStatusSync`, `imwebAutoSync`, `tossAutoSync`는 health에서 enabled 상태로 확인됐다.

## 다음 할일

### Codex가 할 일

1. 16건 placeholder를 보고서에서 D급으로 계속 분리한다.
   - Lane: Green
   - 이유: Meta 유료 유입은 맞지만 campaign/adset/ad 자동 확정 근거가 없다.
   - 성공 기준: ROAS 화면에서 132건 A급과 16건 D급이 섞이지 않는다.
   - 승인 필요: NO, 이미 read-only 표시만 한다.

2. 추가 샘플이 들어오면 3개의 safe click id 후보와 시간대만 대조한다.
   - Lane: Green
   - 이유: raw click id를 노출하지 않고도 같은 클릭 경로인지 확인할 수 있다.
   - 성공 기준: 신규 샘플이 기존 placeholder 패턴인지, 정상 A급 패턴인지 구분한다.
   - 승인 필요: NO.

### TJ님이 할 일

1. 같은 광고에서 `검토/공유 미리보기`가 아니라 실제 광고 클릭에 가까운 경로의 최종 URL을 1건만 확인한다.
   - 추천: 조건부 진행
   - 이유: 현재 설정 화면만으로는 Meta가 클릭 시점에 숫자 치환을 실행하는지 볼 수 없다.
   - 성공 기준: 최종 주소에 `meta_campaign_id=120...`, `meta_adset_id=120...`, `meta_ad_id=120...`, `meta_site_source=ig`, `meta_placement=Instagram_...`가 보인다.
   - 실패 기준: 최종 주소에 `{{campaign.id}}`, `{{adset.id}}`, `{{placement}}`가 그대로 보인다.
   - 승인 필요: 광고 저장은 하지 않으면 NO. 광고 설정 변경은 별도 승인/판단 필요.
