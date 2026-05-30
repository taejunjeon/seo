# Meta UTM API evidence field 확장 패치 결과

작성 시각: 2026-05-27 02:00 KST  
대상: 바이오컴 `/ads/meta-utm` 진단 API  
작업 성격: Green Lane, 로컬 코드 패치 + read-only 검증, VM Cloud 배포 없음

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - docs/agent-harness/growth-data-harness-v0.md
  project_harness_read:
    - AGENTS.md
    - project/meta-utm-api-evidence-improvement-plan-20260527.md
  required_context_docs:
    - meta/campaign-alias-mapping.md
  lane: Green
  allowed_actions:
    - local_code_patch
    - local_typecheck
    - local_api_smoke_read_only
    - meta_api_read_only_probe
  forbidden_actions:
    - vm_cloud_deploy
    - production_db_write
    - meta_ads_setting_change
    - gtm_publish
  source_window_freshness_confidence:
    source: "local backend + Meta Ads API read-only attempt"
    window: "2026-05-20~2026-05-26 KST"
    freshness: "Meta live refresh blocked by ad-account rate limit at 2026-05-27 01:59 KST"
    confidence: "High for code patch/typecheck, Low-Medium for UTM discovery result because live source was rate-limited"
```

## 한 줄 결론

API가 실제 광고 URL/URL Parameters를 더 깊게 읽도록 패치는 완료했다. 다만 Meta ad-account 호출 제한 때문에 live 재조회가 실패해, 현재 시점에서는 “새로 UTM을 발견했다/못 했다”를 확정할 수 없다.

## 바꾼 것

대상 파일:

- `backend/src/routes/ads.ts`

변경 내용:

- Meta creative evidence 필드를 공통 상수로 분리했다.
- `/ads/meta-utm` 진단 API의 광고 조회가 기존 얕은 필드만 보던 상태에서 아래 필드까지 읽도록 확장했다.

```ts
const META_AD_CREATIVE_EVIDENCE_FIELDS = [
  "id",
  "name",
  "thumbnail_url",
  "image_url",
  "url_tags",
  "link_url",
  "object_url",
  "object_story_spec",
  "asset_feed_spec",
  "instagram_permalink_url",
].join(",");
```

기존 진단 조회:

```ts
creative{id,thumbnail_url,image_url,url_tags,link_url}
```

변경 후 진단 조회:

```ts
creative{${META_AD_CREATIVE_EVIDENCE_FIELDS}}
```

## 왜 중요한가

TJ님이 확인한 `meta_biocom_acid_reel_260504` 사례처럼 Ads Manager 실제 URL에는 alias UTM이 있는데, 기존 API 진단 응답에는 `sampleUrl=null`, `sampleTags=null`로 내려온 케이스가 있었다.

이번 패치는 이런 케이스를 줄이기 위해 `object_story_spec`, `asset_feed_spec`, `object_url`처럼 실제 URL이 숨어 있을 수 있는 creative 필드까지 요청하게 만든 것이다.

## 검증 결과

### 타입 검증

명령:

```bash
cd /Users/vibetj/coding/seo/backend && npm run typecheck
```

결과:

- 통과

### 로컬 API smoke

명령:

```bash
curl 'http://localhost:7020/api/ads/meta-utm-diagnostics?account_id=act_3138805896402376&date_preset=last_7d&force=1'
```

결과:

- HTTP 응답은 정상 JSON 반환
- 그러나 `cache.source=disk_cache_hit`
- `cache.stale=true`
- stale reason은 Meta ad-account rate limit

반환된 stale cache 기준 숫자:

- 최근 7일 지출 있는 광고 미맵핑: 34개
- 이 34개 중 `sampleUrl` 또는 `sampleTags`가 새로 채워진 row: 0개

해석:

- 이 0개는 “패치 후에도 UTM이 없다”가 아니다.
- live Meta 응답을 못 받아 기존 disk cache를 본 결과라서, 새 필드 확장 효과가 아직 반영되지 않았다.

### Meta 단건 direct probe

확인 대상:

- `120240625478010396`
- `120237382384260396`
- `120239451369460396`
- `120244878904160396`

결과:

- 4개 모두 Meta API error code `80004`, subcode `2446079`
- 메시지: ad-account 호출이 너무 많아 나중에 다시 시도 필요

해석:

- account-level rate limit이라 전체 진단 API뿐 아니라 단건 광고 조회도 막힌 상태다.

## 현재 판단

가능해진 것:

- API가 UTM을 찾을 수 있는 위치가 넓어졌다.
- 다음 live refresh가 성공하면 기존보다 더 많은 URL/UTM evidence를 발견할 가능성이 생겼다.

아직 확정하지 못한 것:

- 남은 34개 중 몇 개가 실제로 자동 복구되는지.
- `object_story_spec`/`asset_feed_spec` 안에 실 URL이 들어오는지.
- 여전히 안 잡히는 광고가 partnership/post 기반이라 creative direct probe가 필요한지.

## 다음 권장

1. Meta rate limit이 풀린 뒤 같은 force 조회를 다시 실행한다.
2. before/after로 아래 숫자를 비교한다.
   - 최근 7일 지출 있는 광고 미맵핑 수
   - 그중 `sampleUrl`/`sampleTags`가 채워진 수
   - Section C에서 Section B/blocked 또는 ready로 이동한 수
3. 여전히 20개 이상 남으면 creative direct probe를 별도 TTL cache付き로 구현한다.

## Auditor verdict

PASS_WITH_NOTES.

- 로컬 코드 패치와 typecheck는 통과했다.
- 운영/광고/DB 변경은 없다.
- live source 검증은 Meta rate limit으로 막혔다.
- 따라서 “UTM 발견 개선 효과”는 다음 live refresh 성공 후 재판정해야 한다.
