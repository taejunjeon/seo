# utm_campaign Alias 자동 분류 현황 및 계획

> 작성: 2026-04-16
> 스크린샷: `campaign/ads_biocom.png`, `campaign/ads_aibio.png`, `campaign/ads_coffee.png`

---

## 1. 왜 분류하는가

내부 주문 데이터에 찍히는 `utm_campaign` 값(예: `meta_biocom_yeonddle_igg`)은 **Meta 캠페인 ID와 1:1로 매칭되지 않는다.**

- utm_campaign은 광고 랜딩 URL에 수동으로 심는 태그인데, 동일 소재가 여러 캠페인에 복사(사본) 되면서 같은 utm_campaign이 2~4개 캠페인에 걸린다.
- 이 매핑이 안 되면 **캠페인별 Attribution ROAS**를 산출할 수 없다.
- 현재는 사람이 Meta 광고관리자에서 하나씩 대조하여 yes/no 판정을 내리고 있다.

**목표**: AI가 자동 분류하거나, 최소한 "이것은 확실하다"는 후보를 먼저 걸러서 수동 검토 부담을 줄인다.

---

## 2. 어떻게 분류하는가 (현재 시스템)

### 현재 워크플로

```
1. export-meta-campaign-alias-audit.ts 실행
   → Meta API에서 캠페인/광고세트/광고/URL 태그 수집
   → 내부 주문 ledger에서 utm_campaign별 주문 건수/매출 집계
   → data/meta_campaign_alias_audit.{site}.json 생성

2. metaCampaignAliasReview.ts
   → audit 파일 + seed 파일(기존 판정 결과)을 결합
   → API로 프론트엔드에 제공

3. /ads 페이지 → "utm_campaign alias 검토" 섹션
   → 사람이 후보 캠페인마다 yes/no 클릭
   → data/meta_campaign_aliases.{site}.json에 저장
```

### 매칭 기준

| 매칭 레벨 | 설명 | 현재 지원 |
|-----------|------|-----------|
| `exact_id` | utm_campaign == campaign_id | O (거의 없음) |
| URL 태그 매칭 | 광고 랜딩 URL의 utm_campaign 파라미터와 일치 | O |
| `manual_verified` | 사람이 yes 누름 | O |
| 광고명 한글 키워드 매칭 | alias의 영문 키워드 → 광고명의 한글 이름 | X (제안) |
| spend/status 기반 disambig | 같은 utm_campaign이 여러 캠페인에 있을 때 집행비/활성 상태로 1개 선택 | X (제안) |

---

## 3. 현재 분류 현황 (2026-04-16 기준)

### 사이트별 요약

| 사이트 | 전체 alias | 검토 완료 | 검토 필요 | audit 생성됨 |
|--------|-----------|-----------|-----------|-------------|
| **바이오컴** | 19 | 3 (yes 확정) | 16 | O (2026-04-11) |
| **AIBIO** | 0 | 0 | 0 | X (audit 미생성) |
| **더클린커피** | 0 | 0 | 0 | X (audit 미생성) |

### 바이오컴 19개 alias 상세 분류

#### A. AI가 지금 바로 자동 확정 가능 — 5건

URL 태그 매칭으로 **정확히 1개 캠페인**에만 해당 utm_campaign이 존재한다.
별도 확인 없이 `manual_verified`로 올릴 수 있다.

| alias | 매칭 캠페인 |
|-------|-----------|
| `meta_biocom_sikdanstory_igg` | 음식물 과민증 검사 어드밴티지+캠페인(251020) |
| `meta_biocom_allhormon_miraclemorningstory` | 호르몬 검사 바이럴 소재 캠페인_0811 |
| `meta_biocom_kimteamjang_supplements` | 건강기능식품 - 클린, 풍성, 바이오 |
| `meta_biocom_channelA_acid` | 종합대사기능검사 전환캠페인(11/4~) - 사본 |
| `meta_master_slow` | 건강기능식품 - 클린, 풍성, 바이오 |

#### B. AI가 heuristic으로 분류 가능 (높은 확신) — 7건

동일 utm_campaign이 2개 캠페인에 있지만, **spend와 active 상태**를 보면 하나가 압도적이다.

| alias | 캠페인 1 (spend / active) | 캠페인 2 (spend / active) | AI 추천 |
|-------|--------------------------|--------------------------|---------|
| `meta_biocom_happynewyear_igg` | 전환캠(10/14~): ₩263K / 1 active | 어드밴티지+: ₩0 / 0 active | 전환캠 |
| `meta_biocom_igevsiggblog_igg` | 전환캠(10/14~): ₩855K / 1 active | 어드밴티지+: ₩0 / 0 active | 전환캠 |
| `meta_biocom_iggacidset_2026` | 종대사 전환캠: ₩946K / 1 active | 어드밴티지+: ₩0 / 0 active | 종대사 전환캠 |
| `meta_biocom_iggspring` | 전환캠(10/14~): ₩1.5M / 2 active | 어드밴티지+: ₩0 / 0 active | 전환캠 |
| `meta_biocom_iggunboxing_igg` | 어드밴티지+: ₩598K / 1 active | 전환캠(10/14~): ₩0 / 0 active | 어드밴티지+ |
| `meta_biocom_proteinstory_igg` | 어드밴티지+: ₩1.7M / 2 active | 전환캠(10/14~): ₩751K / 1 active | **양쪽 모두 활성 — 수동 확인 권장** |
| `meta_biocom_skincare_igg` | 어드밴티지+: ₩2.0M / 2 active | 전환캠(10/14~): ₩0 / 0 active | 어드밴티지+ |

- 7건 중 **6건**은 한쪽이 spend=₩0 + active=0이므로 자동 확정 가능.
- `proteinstory_igg`만 양쪽 모두 활성이라 수동 확인이 필요.

#### C. URL 매칭 불가, 한글 광고명 매칭으로 후보 추정 가능 — 5건

audit의 `matchedUtmCampaign`이 없지만, alias 영문 키워드와 광고명 한글의 대응 관계로 캠페인을 특정할 수 있다.

| alias | 키워드 | 광고명에서 발견 | 발견된 캠페인 |
|-------|--------|----------------|-------------|
| `meta_biocom_songyuul08` | 송율 | [송율x바이오컴], [송율x음과검] 등 5개 ad | 공동구매 인플루 파트너 광고 모음_3 |
| `meta_biocom_yeonddle_igg` | 연뜰 | [연뜰살뜰x음과검] 등 38개 ad | 어드밴티지+, 전환캠, 공동구매, 종대사 — **4개 캠페인에 분산** |
| `meta_biocom_hyunseo01_igg` | 현서 | [현서쓰고그리다x음과검] 1개 ad | 공동구매 인플루 파트너 광고 모음_3 |
| `meta_biocom_mingzzinginstatoon_igg` | 밍찡 | [밍찡X음과검] 1개 ad | 어드밴티지+캠페인(251020) |
| `meta_biocom_cellcleanerreel_igg` | cellcleaner | 검색 불가 | **미확인 — 소재 삭제 또는 이름 변경 추정** |

- **songyuul08, hyunseo01, mingzzinginstatoon**: 한글 키워드 매칭 + spend 기반으로 자동 확정 가능.
- **yeonddle**: 4개 캠페인에 걸려 있어 수동 확인 필수. (이미 yes 확정 상태: 공동구매 인플루 파트너 광고 모음_3)
- **cellcleanerreel**: 자동 분류 불가.

#### D. 자동 분류 불가 — 2건

| alias | 이유 |
|-------|------|
| `inpork_biocom_igg` | utm_source가 `meta`가 아님 (외부 유입). Meta 캠페인 후보 0개. |
| `meta_biocom_iggpost_igg` | 광고명에 키워드 없음. 삭제/아카이브된 광고 추정. |

---

## 4. AI 자동 분류 실행 이력

### Phase 1: URL 단일 매칭 자동 확정 — 2026-04-16 실행 완료

```
조건: alias의 matchedUtmCampaign이 정확히 1개 캠페인에만 존재
행동: status → manual_verified, confidence → auto_url_match
```

| alias | 확정 캠페인 |
|-------|-----------|
| `meta_biocom_sikdanstory_igg` | 음식물 과민증 검사 어드밴티지+캠페인(251020) |
| `meta_biocom_allhormon_miraclemorningstory` | 호르몬 검사 바이럴 소재 캠페인_0811 |
| `meta_biocom_kimteamjang_supplements` | 건강기능식품 - 클린, 풍성, 바이오 |
| `meta_biocom_channelA_acid` | 종합대사기능검사 전환캠페인(11/4~) - 사본 |
| `meta_master_slow` | 건강기능식품 - 클린, 풍성, 바이오 (신규 추가) |

### Phase 2: spend/active heuristic 자동 확정 — 2026-04-16 실행 완료

```
조건: 2개+ 캠페인에 존재하지만, 한쪽이 spend=₩0 & active=0
행동: status → manual_verified, confidence → auto_spend_heuristic
```

| alias | 확정 캠페인 | 근거 |
|-------|-----------|------|
| `meta_biocom_happynewyear_igg` | 음식물 과민증 검사 전환캠페인(10/14~) | 상대 spend=₩0, active=0 (신규 추가) |
| `meta_biocom_igevsiggblog_igg` | 음식물 과민증 검사 전환캠페인(10/14~) | 상대 spend=₩0, active=0 |
| `meta_biocom_iggacidset_2026` | 종합대사기능검사 전환캠페인(11/4~) - 사본 | 상대 spend=₩0, active=0 |
| `meta_biocom_iggspring` | 음식물 과민증 검사 전환캠페인(10/14~) | 상대 spend=₩0, active=0 |
| `meta_biocom_iggunboxing_igg` | 음식물 과민증 검사 어드밴티지+캠페인(251020) | 상대 spend=₩0, active=0 |
| `meta_biocom_skincare_igg` | 음식물 과민증 검사 어드밴티지+캠페인(251020) | 상대 spend=₩0, active=0 |

**제외**: `proteinstory_igg` — 양쪽 모두 spend > 0 & active > 0 (어드밴티지+ ₩1.67M vs 전환캠 ₩751K). 수동 확인 필요.

### Phase 3: 한글 키워드 매칭 (미실행)

```
1. alias에서 영문 키워드 추출 (meta_biocom_ prefix 제거, _igg suffix 제거)
2. 한글 변환 사전 구축:
   songyuul → 송율, yeonddle → 연뜰살뜰, hyunseo → 현서쓰고그리다
   mingzzinginstatoon → 밍찡, etc.
3. 광고명에서 한글 키워드 검색 → 캠페인 후보 산출
4. spend/active 기준으로 disambiguate
```

### Phase 4: AIBIO / 더클린커피 audit 생성 (미실행)

```
1. export-meta-campaign-alias-audit.ts를 aibio, thecleancoffee에 대해 실행
2. 동일한 Phase 1~3 로직 적용
3. 프론트엔드 REVIEW_TARGET_SITES에 aibio, thecleancoffee 추가
```

---

## 5. 분류 현황 (Phase 1+2 실행 후)

### 요약

| 구분 | 건수 | 비율 |
|------|------|------|
| **확정 (manual_verified)** | **14** | **74%** |
| 미확정 (needs_manual_review) | 5 | 26% |
| 전체 거절 | 0 | 0% |

### 확정 14건 분류 방법별

| 방법 | 건수 | alias |
|------|------|-------|
| 수동 확정 (기존) | 3 | songyuul08, yeonddle_igg, hyunseo01_igg |
| Phase 1 자동 (auto_url_match) | 5 | sikdanstory, allhormon, kimteamjang, channelA_acid, master_slow |
| Phase 2 자동 (auto_spend_heuristic) | 6 | happynewyear, igevsiggblog, iggacidset, iggspring, iggunboxing, skincare |

### 미확정 5건 상세

| alias | 매출 | 이유 | 다음 액션 |
|-------|------|------|-----------|
| `proteinstory_igg` | ₩2,787,750 | 어드밴티지+ ₩1.67M vs 전환캠 ₩751K — 양쪽 활성 | Meta 광고관리자에서 수동 확인 |
| `mingzzinginstatoon_igg` | ₩980,000 | URL 매칭 없으나 한글 '밍찡' 1개 ad 발견 | Phase 3 한글 사전으로 해결 가능 |
| `inpork_biocom_igg` | ₩245,000 | utm_source가 meta 아님, 캠페인 후보 0개 | Meta 외 유입 — 분류 대상 아님 |
| `cellcleanerreel_igg` | ₩245,000 | 광고명에 키워드 없음, 소재 삭제 추정 | Meta 광고관리자에서 수동 확인 |
| `iggpost_igg` | ₩245,000 | 광고명에 키워드 없음 | Meta 광고관리자에서 수동 확인 |

---

## 6. 기술 구현 포인트

### Claude Code가 실제로 수행한 것

1. **audit JSON 분석** — utm→campaign 매핑 테이블 산출, spend/active 기반 disambiguate
2. **seed 파일 직접 업데이트** — Phase 1: 5건 auto_url_match, Phase 2: 6건 auto_spend_heuristic
3. **검증** — API 응답으로 결과 확인 (pendingReview 16→5)

### Codex 플러그인이 할 수 있는 것

1. **audit 스크립트 개선** — `export-meta-campaign-alias-audit.ts`에 auto-classify 로직 내장
2. **한글 사전 빌드** — 기존 광고명에서 `[한글키워드x...]` 패턴을 자동 추출하여 영한 매핑 사전 생성
3. **confidence score 계산** — spend 비율, active 비율, 키워드 일치도를 종합한 점수 산출

### 주의사항

- **잘못된 매핑은 ROAS를 왜곡한다.** Phase 1(단일 매칭)은 안전하다. Phase 2(spend heuristic)도 상대측이 spend=₩0/active=0이므로 위험도가 낮다.
- 어드밴티지+ 캠페인과 전환 캠페인 사이에 같은 소재가 복사되는 패턴이 반복되므로, **주문 발생 시점의 활성 캠페인**을 기준으로 disambiguate하는 것이 가장 정확하다.
- AIBIO/더클린커피는 아직 audit이 없으므로 먼저 생성해야 한다.
- 롤백: `data/meta_campaign_aliases.biocom.json.bak_20260416_phase1_auto`

---

## 7. 다음 액션

- [x] Phase 1 실행: A그룹 5건 자동 확정 — 2026-04-16 완료
- [x] Phase 2 실행: B그룹 6건 자동 확정 — 2026-04-16 완료
- [ ] `proteinstory_igg` 수동 확인 (매출 ₩2.79M — 어드밴티지+ vs 전환캠 중 어느 쪽인지)
- [ ] Phase 3 한글 사전 구축: `mingzzinginstatoon_igg` 자동 분류
- [ ] AIBIO audit 생성: `export-meta-campaign-alias-audit.ts --site=aibio`
- [ ] 더클린커피 audit 생성: `export-meta-campaign-alias-audit.ts --site=thecleancoffee`
- [ ] 프론트엔드 `REVIEW_TARGET_SITES`에 aibio, thecleancoffee 추가
- [ ] CAPI 퍼널 캠페인별 시각화 (아래 섹션 8 참조)

---

## 8. CAPI 퍼널 캠페인별 분석 (2026-04-16 추가)

### 문제 인식: 영양중금속검사 전환 캠페인

영양중금속검사 캠페인은 전환 1건(₩268,200)뿐이고 "표본 추가 필요"로 분류되어 있다.
**그러나 성과가 안 나오면 표본이 영원히 쌓이지 않는 순환 문제가 있다.**

→ 표본 수가 아니라 **퍼널 이탈 지점**을 보면 원인을 파악할 수 있다:
- 노출→클릭은 되는데 랜딩뷰가 없나? → 페이지 로딩 문제
- 랜딩뷰는 있는데 ViewContent가 없나? → 콘텐츠 적합성 문제
- ViewContent는 있는데 AddToCart가 없나? → 상품/가격 문제
- InitiateCheckout까지 갔는데 Purchase가 없나? → 결제 UX 문제

### 현재 상태

CAPI로 퍼널 이벤트(ViewContent, AddToCart, InitiateCheckout, Purchase)를 Meta에 전송하고 있고,
Meta Insights API의 `actions` 필드에서 캠페인별로 이 이벤트 수를 돌려받을 수 있다.

**현재 추출하는 action_type:**
- `landing_page_view`, `lead`, `purchase`

**추가 추출 가능한 action_type (2026-04-16 백엔드 수정 완료):**
- `offsite_conversion.fb_pixel_view_content` → ViewContent
- `offsite_conversion.fb_pixel_add_to_cart` → AddToCart
- `offsite_conversion.fb_pixel_initiate_checkout` → InitiateCheckout

### 구현 현황 (2026-04-16 완료)

| 항목 | 상태 |
|------|------|
| 백엔드: Meta Insights 응답에 퍼널 이벤트 추출 | ✅ 완료 (meta.ts에 view_content, add_to_cart, initiate_checkout 추가) |
| VM 배포 | ✅ 완료 (att.ainativeos.net — 로컬 빌드 후 dist/routes/meta.js SCP 배포, PM2 재시작) |
| 프론트엔드: 캠페인별 퍼널 바 시각화 | ✅ 완료 (CampaignFunnelSection 컴포넌트) |
| 프론트엔드: 퍼널 전환율 계산 | ✅ 완료 (클릭→랜딩, 조회→장바구니, 결제→구매, 랜딩→구매) |
| 프론트엔드: 퍼널 건강 점수 (A/B/C/D) | ✅ 완료 (0-100점 스코어링) |
| 프론트엔드: 병목 자동 감지 | ✅ 완료 (가장 이탈이 큰 구간 + 해결 제안 표시) |
| 데이터 소스 라벨 정확화 | ✅ 완료 (imweb Pixel / 서버 CAPI 구분) |

### VM 배포 이력

- **2026-04-16**: meta.ts CAPI 퍼널 필드 추가 배포
  - 변경: `view_content`, `add_to_cart`, `initiate_checkout` 3필드 추출 코드 추가
  - 방법: VM 메모리(2GB) 부족으로 tsc 빌드 불가 → 로컬 빌드 후 `dist/routes/meta.js` SCP 업로드 → PM2 재시작
  - 검증: `curl att.ainativeos.net/api/meta/insights?account_id=act_3138805896402376` 에서 vc/atc/ic 정상 반환 확인

### 실제 데이터 (last_7d, 2026-04-16 기준)

| 캠페인 | 상품조회 | 장바구니 | 결제시작 | 구매 |
|--------|---------|---------|---------|------|
| 음식물 과민증 검사 전환캠페인 | 5,765 | 51 | 192 | - |
| 영양중금속검사 전환 캠페인 | 4,609 | 25 | 93 | - |
| 건강기능식품 - 클린, 풍성, 바이오 | 861 | 20 | 40 | - |

### 다음 단계

1. ~~프론트엔드에 캠페인별 CAPI 퍼널 바 추가~~ ✅ 완료
2. ~~퍼널 단계별 전환율 자동 계산~~ ✅ 완료
3. ~~이탈이 큰 단계에 경고 표시~~ ✅ 완료
4. Codex 피드백 기반 UX 개선 (진행중)
5. Phase 3 한글 사전 구축 (mingzzinginstatoon_igg 자동 분류)
6. AIBIO/더클린커피 alias audit 생성
