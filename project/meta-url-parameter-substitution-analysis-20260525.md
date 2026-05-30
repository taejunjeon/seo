작성 시각: 2026-05-25 23:36 KST
기준일: 2026-05-25
문서 성격: Meta URL 매개변수 숫자 치환 문제 분석 보고

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - frontrule.md
    - data/!data_inventory.md
  lane: Green
  allowed_actions:
    - documentation
    - read_only_local_report
    - frontend_backend_local_patch
  forbidden_actions:
    - meta_ads_mutation
    - offline_event_set_save
    - vm_cloud_deploy_or_restart
    - operating_db_write
    - platform_send
    - gtm_publish
  source_window_freshness_confidence:
    source: TJ님 Ads Manager screenshots + user-provided Meta help text + VM Cloud SQLite read-only bridge artifact
    window: 2026-05-18~2026-05-26 UTC bridge, Ads Manager 화면 2026-05-25 KST
    site: biocom
    confidence: medium_high for current diagnosis, medium for root cause until actual clicked final URL/export is obtained
```

## 10초 요약

현재 URL 매개변수 문법 자체는 대체로 맞다. `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}`는 광고 설정 화면이나 URL 매개변수 만들기 미리보기에서는 원래 템플릿 문구로 보일 수 있다.

문제는 실제 고객 클릭 후 내부 원장에도 이 템플릿 문구가 그대로 저장된 row가 있다는 점이다. VM 원장 기준 `/iiary02`는 원본 랜딩 bridge 148건 중 132건은 숫자 ID가 정상으로 남았고, 16건만 숫자로 바뀌지 않은 템플릿 문구로 남았다.

따라서 "전체 설정이 작동하지 않는다"가 아니라, "일부 클릭 경로 또는 일부 광고/시점에서 Meta 숫자 치환이 실행되지 않았거나, 치환이 적용되지 않는 클릭 경로가 섞였다"로 보는 것이 맞다.

## 현재 설정에 대한 판단

현재 TJ님이 보여준 URL 매개변수는 아래 구조다.

```text
utm_source=meta
utm_medium=paid_social
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
utm_id={{campaign.id}}
campaign_alias=meta_biocom_광고별칭
meta_campaign_id={{campaign.id}}
meta_adset_id={{adset.id}}
meta_ad_id={{ad.id}}
meta_site_source={{site_source_name}}
meta_placement={{placement}}
```

이 중 숫자 ID 추적용 필드는 방향이 맞다.

- `utm_campaign={{campaign.id}}`: 캠페인 숫자 ID를 남기려는 설정
- `utm_term={{adset.id}}`: 광고세트 숫자 ID를 남기려는 설정
- `utm_content={{ad.id}}`: 광고 숫자 ID를 남기려는 설정
- `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`: 같은 숫자 ID를 명시 필드로 한 번 더 남기려는 보강 설정

다만 `campaign_alias=meta_biocom_광고별칭`은 매핑용으로는 좋지 않다. 이 값은 모든 광고에 공통으로 들어가는 자리표시 문구라서, 어느 캠페인인지 구분하는 B급 근거가 되지 않는다.

좋은 alias는 아래처럼 광고/캠페인마다 고유해야 한다.

```text
campaign_alias=meta_biocom_iiari_260518
campaign_alias=meta_biocom_hwajung_260514
campaign_alias=meta_biocom_foodtest_advantage_251014
```

## 왜 일부 클릭에서 숫자로 안 바뀔 수 있는가

아래는 현재 증거 기준 가능성이 높은 순서다.

### 1. 실제 광고 클릭과 검토/미리보기/공유 링크 클릭이 다르다

Ads Manager의 `검토` 화면에서 복사한 웹사이트 URL은 `https://biocom.kr/iiary02?fbclid=...` 형태였고, UTM은 붙어 있지 않았다.

이 화면은 고객이 실제 광고를 클릭하는 경로와 다를 수 있다. 즉 검토 화면, 공유 미리보기, 링크 주소 복사는 "광고 설정값 확인"에는 도움이 되지만, 실제 광고 게재 클릭에서 URL 매개변수가 어떻게 붙는지를 100% 증명하지 못한다.

운영 판단: 이 경로에서 본 URL만으로 "UTM이 안 붙는다" 또는 "치환이 실패한다"고 확정하면 안 된다.

### 2. 기존 게시물 홍보/파트너십 광고/인플루언서 광고에서 클릭 경로가 섞였을 수 있다

Meta 도움말 기준으로 URL 매개변수는 광고의 URL 클릭에 적용된다. 기존 Facebook/Instagram 게시물을 홍보하는 경우에도 광고 클릭에는 적용될 수 있지만, 누군가 같은 게시물을 유기적으로 보고 클릭하면 URL 매개변수가 적용되지 않을 수 있다.

현재 `/iiary02`는 인플루언서/파트너십 성격이 강하다. 같은 소재가 광고 클릭, 게시물 클릭, 프로필/공유/미리보기 클릭으로 섞이면 일부 row만 숫자 치환이 다르게 남을 수 있다.

운영 판단: 인플루언서 공동구매 캠페인은 광고 클릭과 자연/프로필/공유 클릭을 더 강하게 분리해야 한다.

### 3. 일부 광고가 예전 설정 또는 복제본 설정으로 클릭됐을 수 있다

VM 원장에서는 `/iiary02` 원본 랜딩 bridge 148건 중 132건은 숫자 ID가 있다. 즉 동일 랜딩에서 숫자 치환이 정상으로 작동한 흔적이 이미 많다.

반대로 16건은 템플릿 문구가 그대로 남았다. 이 차이는 아래 둘 중 하나일 가능성이 높다.

1. 같은 랜딩을 쓰는 광고 중 일부 복제본/파트너십 광고만 URL 매개변수 설정이 달랐다.
2. 고객이 클릭한 시점에는 아직 현재 표준 URL 매개변수가 적용되지 않았고, 이후 결제 시점에 원장에 남았다.

운영 판단: 현재 ACTIVE 광고만 보는 것과 2026-05-18~2026-05-24 실제 클릭 당시 설정을 보는 것은 다를 수 있다.

### 4. URL 매개변수 만들기 화면의 미리보기는 숫자로 치환되기 전 상태다

`URL 매개변수 만들기` 화면에서 `utm_campaign={{campaign.id}}`처럼 보이는 것은 그 자체로 오류가 아니다. 이 화면은 "클릭 때 Meta가 채울 템플릿"을 보여주는 것이기 때문이다.

문제 판정은 미리보기 화면이 아니라 실제 랜딩 후 내부 원장 또는 최종 주소창에 무엇이 남았는지로 해야 한다.

운영 판단: `URL 매개변수 만들기` 미리보기만 보고 실패로 판단하지 않는다.

### 5. URL 중복/덮어쓰기 가능성은 낮지만 확인 대상이다

Meta 도움말에 따르면 URL 매개변수 필드의 값은 웹사이트 URL 필드에 같은 키가 있을 때 덮어쓴다. 예를 들어 웹사이트 URL에 `utm_source=1`이 있고 URL 매개변수 필드에 `utm_source=2`가 있으면 최종 URL은 `utm_source=2`가 된다.

현재 샘플의 웹사이트 URL은 `https://biocom.kr/iiary02`로 보였으므로 중복 덮어쓰기 문제가 주원인일 가능성은 낮다. 다만 다른 광고에서 웹사이트 URL 자체에 UTM이 이미 붙어 있으면 확인해야 한다.

운영 판단: 광고별로 웹사이트 URL과 URL 매개변수 필드를 함께 봐야 한다.

## 오프라인 이벤트 데이터 세트 추적 버튼 의견

`추적된 오프라인 이벤트 세트 수정`은 이번 UTM 숫자 치환 문제를 해결하는 버튼이 아니다.

이 버튼은 광고가 어떤 오프라인 이벤트 데이터 세트를 추적할지 고르는 설정이다. 저장하면 Meta 광고 설정에 영향을 줄 수 있다. 현재 문제는 "고객이 광고 클릭 후 URL에 어떤 campaign/adset/ad ID를 남기는가"이므로, 오프라인 이벤트 세트를 바꿔도 `{{campaign.id}}`가 숫자로 바뀌는 문제는 해결되지 않는다.

권장 결정:

- 지금은 누르거나 저장하지 않는다.
- 데이터 세트 제한/픽셀 교체 이슈와 연결해 검토할 때만 별도 승인안으로 다룬다.
- 만약 나중에 오프라인 이벤트 세트를 연결해야 한다면, 어느 데이터 세트가 현재 바이오컴 실사용 정본인지 먼저 확정해야 한다.

현재 화면에 보인 후보 중 이름만 보면 `바이오컴(biocom) - Meta 픽셀`과 `바이오컴_TEMP`가 섞여 있다. 어떤 것이 현재 운영 기준인지 확인 없이 저장하면 오히려 추적/최적화가 더 혼란스러워질 수 있다.

## 추가 테스트가 필요한 광고

전체를 다 볼 필요는 없다. 아래 5개 샘플만 보면 원인을 상당히 좁힐 수 있다.

1. `meta_biocom_iiari_Igg_260518`
   - 이유: `/iiary02` 숫자 ID 정상 row의 핵심 후보.
   - 보고 싶은 값: 웹사이트 URL, URL 매개변수 원문, 실제 클릭 최종 URL.

2. `meta_biocom_iiari_acid_260518`
   - 이유: 같은 `/iiary02` 랜딩이지만 다른 광고세트/소재 후보.
   - 보고 싶은 값: `utm_campaign`, `utm_term`, `utm_content`가 실제로 120... 숫자로 바뀌는지.

3. `meta_biocom_iiari_Igg_260518 - 사본`
   - 이유: 복제본/사본에서 설정 차이가 발생했는지 보기 좋다.
   - 보고 싶은 값: 원본 광고와 URL 매개변수 원문이 완전히 같은지.

4. `[바이오컴] 음식물 과민증 검사 어드밴티지+캠페인`
   - 이유: 예산/매출 영향이 큰 핵심 캠페인이라 여기서 문제가 있으면 ROAS 영향이 크다.
   - 보고 싶은 값: 성과 큰 ACTIVE 광고 1개와 최근 수정 광고 1개.

5. `meta_biocom_acid_260504` 또는 `meta_biocom_igg_260504`
   - 이유: 인플루언서가 아닌 일반 Meta 캠페인에서 같은 문제가 반복되는지 비교하기 위함.
   - 보고 싶은 값: 인플루언서/파트너십 계열만의 문제인지, 전체 Meta 광고 설정 문제인지.

## 테스트할 때 복사해야 하는 값

광고마다 아래 7개만 있으면 된다.

```text
캠페인명:
캠페인 ID:
광고세트명:
광고세트 ID:
광고명:
광고 ID:
웹사이트 URL:
URL 매개변수 원문:
실제 클릭 후 최종 주소창 URL:
```

성공 기준은 아래처럼 숫자 ID가 보이는 것이다.

```text
utm_campaign=120...
utm_term=120...
utm_content=120...
meta_campaign_id=120...
meta_adset_id=120...
meta_ad_id=120...
```

실패 기준은 아래처럼 템플릿 문구가 그대로 남는 것이다.

```text
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
```

## Codex 쪽 다음 구현 판단

프론트/백엔드 보고서에는 원본 랜딩 bridge를 read-only 보조 증거로만 붙인다.

이번 단계에서는 ROAS 산식에 바로 반영하지 않는다. 이유는 bridge가 원본 랜딩 후보를 복구하는 장치이지, D급 템플릿 문구 row를 특정 광고로 자동 배정하는 장치가 아니기 때문이다.

다음 단계에서 할 수 있는 것은 아래다.

1. `/ads/meta-utm` 화면에 원본 랜딩 bridge 패널을 붙인다.
2. API 응답에 `originalLandingBridge`를 붙여 고객 유입 장부 0건과 원본 랜딩 bridge 148건의 차이를 보여준다.
3. 그로스팀 테스트 결과로 실제 광고별 숫자 ID가 확인되면, bridge를 ROAS 산식으로 승급할지 별도 승인안으로 분리한다.

## Auditor verdict

PASS_WITH_NOTES.

분석과 로컬 설계만 수행한다. Meta 광고 저장, 오프라인 이벤트 세트 저장, VM Cloud 배포, 운영DB write, 플랫폼 전송은 하지 않는다.
