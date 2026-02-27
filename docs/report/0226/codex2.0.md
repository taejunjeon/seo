# Codex 백엔드 프롬프트 모음 (v2 - repo 검증 반영)
## Biocom AI Agent Dashboard - Backend

작성일: 2026-02-26 (v2)
대상: Codex (백엔드 전용)
코드 경로: `/Users/vibetj/coding/seo/backend/src/`
핵심 파일: `server.ts`, `ai.ts`, `intent.ts`, `gsc.ts`, `ga4.ts`, `env.ts`
git HEAD: `e3d831a`

---

## ⚠️ v2 변경 이력 (v1 대비)

| 항목 | v1 (잘못된 전제) | v2 (repo 검증 반영) |
|------|------------------|---------------------|
| 기술 스택 | Next.js 14 | Next.js 16.1.6 (package.json 확인) |
| 캐싱 상태 | 캐시 없음 | in-memory 캐시 이미 존재 (GSC 60s, GA4 30m, AI citation 6h) |
| UTM/AI referrer | CONTAINS 매칭으로 구현됨 | ChatGPT 중심 구현만 확인, 나머지 미확인 |
| Phase 3 | 0% 미착수 | cron endpoint, 캐시 기반 등 일부 존재 |
| env 키 | 미언급 | GSC/GA4/PSI/OpenAI/SerpAPI/Perplexity/Supabase 키 정의 존재 |

---

## 프롬프트 B0: 사전 확인 리포트 (P0 - 모든 작업 전 필수 실행)

### 목적
B1-B6 프롬프트를 실행하기 전에, 현재 repo 상태를 정확히 파악하여 프롬프트 전제를 최종 검증한다. 이 리포트의 결과에 따라 B1-B6 실행 시 세부 접근이 달라질 수 있다.

### 작업
아래 항목을 순서대로 확인하고, 결과를 마크다운 리포트로 출력한다.

### 확인 항목

**1. package.json 상세 확인**
```bash
cat backend/package.json
cat frontend/package.json
```
리포트에 포함할 것:
- Next.js 정확한 버전
- Tailwind CSS 설치 여부 + 버전
- shadcn/ui 설치 여부 + 버전
- Recharts 설치 여부 + 버전
- TypeScript 버전
- 기타 주요 의존성 목록 (런타임 + devDependencies 구분)

**2. 기존 캐시 구조 상세 파악**
```bash
grep -rn "cache\|Cache\|CACHE\|ttl\|TTL\|expire\|Expire" backend/src/ --include="*.ts"
```
리포트에 포함할 것:
- 캐시가 구현된 파일명과 라인 번호
- 각 캐시의 키 패턴 (어떤 데이터를 캐싱하는지)
- 각 캐시의 TTL 값
- 캐시 구조 (Map, 객체, 외부 라이브러리 등)
- 캐시 무효화 방법 (있으면)
- AI Insights 관련 캐시가 있는지 (있다면 상세 구조)

**3. 기존 엔드포인트 전체 목록**
```bash
grep -n "app\.\(get\|post\|put\|delete\|patch\)" backend/src/server.ts
```
리포트에 포함할 것:
- 모든 엔드포인트 경로 + HTTP 메서드
- 각 엔드포인트가 호출하는 주요 함수/모듈
- Trend API, Comparison API, Funnel 고도화 등 Phase 3 목표와 겹치는 기존 구현이 있는지

**4. AI referrer / UTM 현재 구현 상세**
```bash
grep -rn "chatgpt\|perplexity\|gemini\|copilot\|claude\|utm_source\|referr\|allowlist\|AI_SOURCES\|ai.*source" backend/src/ --include="*.ts" -i
```
리포트에 포함할 것:
- AI referrer 매칭 로직이 있는 파일과 라인
- 현재 등록된 AI 서비스 목록 (ChatGPT만? 다른 것도?)
- 매칭 방식 (exact, contains, endsWith, regex 등)
- allowlist가 코드 내 하드코딩인지, 설정 파일 분리인지

**5. GA4 퍼널 현재 구현 상세**
```bash
grep -rn "funnel\|Funnel\|FUNNEL\|view_item\|add_to_cart\|begin_checkout\|purchase" backend/src/ --include="*.ts"
```
리포트에 포함할 것:
- 현재 퍼널 단계 정의 (어떤 이벤트를 사용하는지)
- 검사/영양제 분리 로직 존재 여부
- runReport vs runFunnelReport 중 어느 것을 사용하는지

**6. Cron 작업 현재 구현 상세**
```bash
grep -rn "cron\|Cron\|CRON\|schedule\|daily\|hourly" backend/src/ --include="*.ts"
```
리포트에 포함할 것:
- 등록된 cron 엔드포인트 목록
- 각 cron이 수행하는 작업 내용
- Vercel Cron 설정 파일 (vercel.json 등) 존재 여부

**7. 키워드 인텐트 현재 구현 상세**
```bash
cat backend/src/intent.ts
```
리포트에 포함할 것:
- intent.ts 파일 존재 여부 (없으면 인텐트 로직이 어디에 있는지)
- 현재 인텐트 분류 방식 (규칙기반? GPT 호출?)
- 현재 비율 계산 방식 (개수 기준? 이미 클릭 가중?)
- API 응답 구조

### 출력 형식
```markdown
# B0 사전 확인 리포트
## 1. 기술 스택 (package.json)
...
## 2. 캐시 구조
...
## 3. 엔드포인트 목록
...
## 4. AI referrer 구현
...
## 5. 퍼널 구현
...
## 6. Cron 작업
...
## 7. 키워드 인텐트
...
## 8. B1-B6 프롬프트 영향 요약
- B1에 영향: [기존 캐시 구조에 따라 접근 변경 필요 여부]
- B2에 영향: [intent.ts 구조에 따라 접근 변경 필요 여부]
- ...
```

### 주의사항
- 코드를 변경하지 않는다. 읽기 전용 작업이다.
- 추측하지 않는다. 코드에서 확인된 사실만 기록한다.
- 파일이 없으면 "파일 없음"으로 명확히 기록한다.

---

## 프롬프트 B1: AI Insights 캐싱 체계화 (P0 - 즉시 실행)

### ⚠️ v2 핵심 변경: "신규 생성"이 아닌 "기존 확장"

### 배경
repo 검증 결과, in-memory 캐시가 이미 존재한다. GSC 60초, GA4 AI traffic 30분, AI citation 6시간 TTL로 각각 구현되어 있다. 그러나 AI Insights의 캐시 상태가 충분한지는 B0 리포트에서 확인이 필요하다. 현재 응답 시간이 20-30초로 사용자 경험이 나쁘다.

### 사전 조건
- B0 리포트의 "2. 캐시 구조" 섹션을 먼저 읽는다.
- 기존 캐시 패턴(Map 구조, TTL 방식, 키 패턴)을 그대로 따른다.

### 작업
기존 캐시 구조를 확장하여 AI Insights 캐싱을 체계화한다.

### 요구사항

1. **기존 캐시 패턴 파악 후 통합**
   - 먼저 `backend/src/` 전체에서 기존 캐시 구현을 읽는다.
   - 기존 패턴(Map 기반이면 Map, 객체 기반이면 객체)을 동일하게 따른다.
   - 별도의 캐시 유틸리티가 이미 있다면 그것을 재사용한다.
   - 기존 패턴과 다른 새로운 캐시 메커니즘을 도입하지 않는다.

2. **AI Insights 캐시 확장**
   - AI Insights 엔드포인트(B0에서 확인한 경로)에 캐시를 적용 또는 강화
   - TTL: 6시간 (기존 AI citation과 동일 수준)
   - 캐시 키: `insights-${siteUrl}-${dateRange}` 또는 기존 키 패턴과 일관된 형식

3. **API 응답에 캐시 메타데이터 추가**
   - 기존에 `_meta(live/fallback)` 태그가 GA4 엔드포인트에 존재한다고 확인됨
   - 동일한 `_meta` 패턴을 AI Insights에도 적용
   ```json
   {
     "insights": [...],
     "_meta": {
       "source": "cache" | "live",
       "generatedAt": "2026-02-26T09:00:00Z",
       "expiresAt": "2026-02-26T15:00:00Z",
       "ttl": 21600
     }
   }
   ```

4. **수동 갱신 엔드포인트**
   - `POST /api/ai/insights/refresh` — 캐시를 무시하고 새로 생성
   - 기존 엔드포인트 네이밍 컨벤션을 따른다 (B0에서 확인한 패턴)
   - 성공 시 새 캐시 저장 + 응답 반환

5. **기존 캐시와의 충돌 방지**
   - AI citation 캐시(6h)와 AI insights 캐시는 별도 키로 분리
   - 다른 캐시(GSC 60s, GA4 30m)에 영향 주지 않음

### 변경하지 않을 것
- OpenAI 프롬프트 내용
- GSC 데이터 조회 로직
- 기존 다른 엔드포인트의 캐시 TTL
- 프론트엔드 코드

### 검증
- 첫 호출: OpenAI 호출 발생, `_meta.source: "live"` 반환
- 두 번째 호출 (6시간 내): OpenAI 미호출, `_meta.source: "cache"`, 응답 100ms 이내
- `/refresh` 호출 후: 새 인사이트 생성, 캐시 갱신, `_meta.source: "live"`
- 기존 다른 캐시가 정상 동작하는지 확인 (회귀 테스트)

---

## 프롬프트 B2: 키워드 인텐트 가중치 개선 (P1)

### ⚠️ v2 핵심 변경: intent.ts 존재 여부를 먼저 확인

### 사전 조건
- B0 리포트의 "7. 키워드 인텐트" 섹션을 먼저 읽는다.
- `intent.ts` 파일이 없으면 인텐트 로직이 어디에 있는지 B0에서 확인한 위치를 사용한다.
- 현재 비율 계산이 이미 클릭 가중이라면 이 프롬프트는 스킵한다.

### 배경
현재 인텐트 비율 계산이 키워드 "개수" 기준이라면, 클릭 1000회 키워드와 클릭 0회 키워드가 동일 가중치를 갖는 문제가 있다.

### 작업
인텐트 비율 계산 로직에 클릭/노출 가중치 옵션을 추가한다.

### 요구사항

1. **현재 구현 먼저 읽기**
   - 인텐트 분류 로직이 있는 파일을 전체 읽는다.
   - 현재 비율 계산 방식을 정확히 파악한다.
   - 이미 가중치가 적용되어 있다면, 그 방식을 문서화하고 프롬프트를 스킵한다.

2. **클릭 가중치 비율 계산 추가**
   - 기존 방식(개수 기준)을 제거하지 않고, 가중치 옵션으로 확장
   - 기존: 각 카테고리별 키워드 개수 / 전체 개수
   - 추가: 각 카테고리별 총 클릭수 합산 / 전체 클릭수 합산
   - 클릭이 모두 0인 경우: 노출수(impressions) 기준 fallback

3. **API 응답 확장**
   - 기존 응답 구조를 깨지 않고 필드 추가 (하위호환)
   ```json
   {
     "categories": [
       {
         "intent": "informational",
         "percentage": 45.2,
         "totalClicks": 338,
         "totalImpressions": 12500,
         "keywordCount": 120,
         "topKeywords": ["비타민D 효과", "콜라겐 먹는법"]
       }
     ],
     "weightedBy": "clicks" | "impressions" | "count",
     "totalKeywords": 280,
     "totalClicks": 747
   }
   ```

4. **가중치 모드 쿼리 파라미터**
   - `GET /api/keywords/intent?weight=clicks` (기본값)
   - `GET /api/keywords/intent?weight=impressions`
   - `GET /api/keywords/intent?weight=count` (기존 방식 유지)

### 변경하지 않을 것
- 인텐트 분류 로직 자체 (정보/상업/탐색/브랜드 분류 규칙)
- 기존 응답의 하위호환성

### 검증
- `?weight=clicks` 응답에서 클릭이 많은 키워드 카테고리 비율이 높은지
- `?weight=count` 응답이 기존 응답과 동일한지 (회귀 테스트)
- 파라미터 없이 호출 시 기본값(clicks) 적용 확인

---

## 프롬프트 B3: Trend API 개발 (P2)

### 사전 조건
- B0 리포트의 "3. 엔드포인트 목록"에서 Trend 관련 기존 구현이 있는지 확인한다.
- 기존에 시계열 데이터를 반환하는 엔드포인트가 있다면 그것을 확장한다.

### 배경
오버뷰 차트에서 시계열 추이 데이터를 보여주고 있지만, 전주 대비/전월 대비 비교가 불가능하다.

### 작업
`backend/src/server.ts`에 Trend API를 추가한다.

### 요구사항

1. **기존 GSC 데이터 조회 패턴 따르기**
   - 먼저 `gsc.ts`에서 기존 GSC API 호출 패턴(인증, 에러 처리, 응답 파싱)을 읽는다.
   - 동일한 패턴으로 두 기간의 데이터를 병렬 조회한다.

2. **엔드포인트**: `GET /api/trends`

3. **쿼리 파라미터**
   - `metric`: `clicks` | `impressions` | `ctr` | `position` (필수)
   - `period`: `7d` | `30d` | `90d` (기본: 30d)
   - `compare`: `previous` | `yoy` (선택, 기본: previous)

4. **응답 구조**
   ```json
   {
     "metric": "clicks",
     "period": "30d",
     "current": {
       "startDate": "2026-01-27",
       "endDate": "2026-02-26",
       "data": [{"date": "2026-01-27", "value": 25}],
       "total": 747,
       "average": 24.9
     },
     "previous": {
       "startDate": "2025-12-28",
       "endDate": "2026-01-26",
       "data": [{"date": "2025-12-28", "value": 20}],
       "total": 680,
       "average": 22.7
     },
     "change": {
       "absolute": 67,
       "percentage": 9.85,
       "direction": "up"
     },
     "_meta": { "source": "live" }
   }
   ```

5. **캐싱**: 기존 캐시 패턴을 따라 TTL 5분 적용 (GSC 데이터 변동 주기 고려)

6. **병렬 조회**: `Promise.all`로 두 기간 동시 조회. 데이터 없는 날짜는 0으로 채움.

### 검증
- 30d 기간: current 30개 + previous 30개 데이터 포인트
- change.percentage 정확성 검증
- 병렬 조회로 응답 시간이 직렬 대비 절반 이내

---

## 프롬프트 B4: Comparison API 개발 (P2)

### 사전 조건
- B0 리포트에서 페이지/키워드별 성과 비교 관련 기존 구현 여부 확인

### 작업
`backend/src/server.ts`에 Comparison API를 추가한다.

### 요구사항

1. **기존 패턴 준수**
   - `gsc.ts`의 기존 dimension(page, query) 조회 패턴을 따른다.
   - 엔드포인트 네이밍은 기존 컨벤션과 일관되게

2. **엔드포인트**: `GET /api/comparison`

3. **쿼리 파라미터**
   - `dimension`: `page` | `query` (필수)
   - `period`: `7d` | `30d` | `90d` (기본: 30d)
   - `limit`: 상위 N개 (기본: 20)
   - `sortBy`: `clicks` | `impressions` | `ctr` | `position` | `change` (기본: clicks)

4. **응답 구조**
   ```json
   {
     "dimension": "page",
     "period": "30d",
     "items": [
       {
         "key": "/healthinfo/vitamin-d-guide",
         "current": {"clicks": 120, "impressions": 3500, "ctr": 3.43, "position": 4.2},
         "previous": {"clicks": 95, "impressions": 3200, "ctr": 2.97, "position": 5.1},
         "change": {
           "clicks": {"absolute": 25, "percentage": 26.3, "direction": "up"},
           "position": {"absolute": -0.9, "percentage": -17.6, "direction": "up"}
         }
       }
     ],
     "totalItems": 47,
     "_meta": { "source": "live" }
   }
   ```

5. **position 방향 주의**: position 감소 = "up" (개선)

6. **캐싱**: 기존 패턴 따라 TTL 5분

### 검증
- `sortBy=change` 시 가장 큰 변화가 상위에 오는지
- position change 방향이 올바른지
- limit 파라미터 동작 확인

---

## 프롬프트 B5: GA4 Funnel 고도화 - 검사/영양제 분리 (P2)

### ⚠️ v2 핵심 변경: 기존 퍼널 구현을 먼저 파악

### 사전 조건
- B0 리포트의 "5. 퍼널 구현" 섹션을 먼저 읽는다.
- 현재 퍼널 단계 정의, 사용 중인 이벤트, runReport/runFunnelReport 방식을 확인한다.

### 배경
현재 `GET /api/ga4/funnel`은 범용 퍼널(Organic → 페이지뷰 → 참여 → 전환)만 제공한다. 검사와 영양제를 분리한 의사결정용 퍼널이 필요하다.

### 작업
기존 퍼널 구현을 확장한다 (기존 응답 하위호환 유지).

### 요구사항

1. **기존 퍼널 유지 + 확장**
   - `GET /api/ga4/funnel` — 기존 범용 퍼널 그대로 (하위호환)
   - `GET /api/ga4/funnel?type=test` — 검사 전용 퍼널
   - `GET /api/ga4/funnel?type=supplement` — 영양제 전용 퍼널
   - `GET /api/ga4/funnel?type=all` — 기존과 동일 (기본값)

2. **퍼널 단계 (검사)**
   - view_item (검사 상품 상세 진입)
   - begin_checkout (결제 시작)
   - purchase (구매 완료)

3. **퍼널 단계 (영양제)**
   - view_item (영양제 상세 진입)
   - add_to_cart (장바구니)
   - purchase (구매 완료)

4. **검사/영양제 구분 config 분리**
   - `backend/src/config/funnel-config.ts` (또는 .json) 파일로 분리
   - 향후 카테고리 추가/변경 시 이 파일만 수정
   ```typescript
   export const FUNNEL_CONFIG = {
     test: {
       label: '검사',
       steps: ['view_item', 'begin_checkout', 'purchase'],
       filter: { /* page_path 또는 item_category 조건 */ }
     },
     supplement: {
       label: '영양제',
       steps: ['view_item', 'add_to_cart', 'purchase'],
       filter: { /* page_path 또는 item_category 조건 */ }
     }
   };
   ```

5. **응답 구조**
   ```json
   {
     "type": "test",
     "period": "30d",
     "steps": [
       {"name": "상품 조회", "event": "view_item", "sessions": 1200, "conversionRate": 100},
       {"name": "결제 시작", "event": "begin_checkout", "sessions": 320, "conversionRate": 26.7},
       {"name": "구매 완료", "event": "purchase", "sessions": 180, "conversionRate": 56.3}
     ],
     "overallConversion": 15.0,
     "biggestDropoff": {"from": "상품 조회", "to": "결제 시작", "dropRate": 73.3},
     "_meta": { "source": "live" }
   }
   ```

6. **기간 선택**: `period=7d|30d|custom`, `startDate`/`endDate` (custom일 때)

### 변경하지 않을 것
- 기존 `?type=all` (파라미터 없음) 응답 형식 (하위호환)
- GA4 인증 로직
- runReport 기반 접근 (runFunnelReport 사용하지 않음)

### 검증
- `?type=all` 응답이 기존과 동일한지 (회귀)
- `?type=test`와 `?type=supplement` 반환 구조가 스펙과 일치하는지
- biggestDropoff 계산 정확성

---

## 프롬프트 B6: AI 유입 트래픽 allowlist 확장 및 정밀화 (P2)

### ⚠️ v2 핵심 변경: "CONTAINS→ENDS_WITH 전환"이 아닌 "현재 범위 확인 후 확장"

### 사전 조건
- B0 리포트의 "4. AI referrer 구현" 섹션을 먼저 읽는다.
- 현재 등록된 AI 서비스 목록, 매칭 방식, 코드 위치를 정확히 파악한다.

### 배경
repo 검증 결과, AI referrer 매칭이 ChatGPT 중심으로만 구현된 것으로 보인다. Perplexity, Gemini, Copilot, Claude 등이 누락되었을 수 있다. 매칭 방식도 오탐 가능성이 있는 부분 매칭일 수 있다.

### 작업
기존 AI referrer 구현을 확장하고 정밀화한다.

### 요구사항

1. **현재 구현 파악 후 확장**
   - 기존 코드를 먼저 전체 읽는다.
   - 이미 정확한 도메인 매칭이 되어있다면, 누락된 서비스만 추가한다.
   - 부분 매칭이라면 도메인 suffix 매칭(ENDS_WITH)으로 변경한다.

2. **AI 서비스 목록 확장**
   ```typescript
   const AI_REFERRERS = [
     { domain: 'chatgpt.com', label: 'ChatGPT' },
     { domain: 'chat.openai.com', label: 'ChatGPT' },
     { domain: 'perplexity.ai', label: 'Perplexity' },
     { domain: 'gemini.google.com', label: 'Gemini' },
     { domain: 'copilot.microsoft.com', label: 'Copilot' },
     { domain: 'claude.ai', label: 'Claude' },
     { domain: 'you.com', label: 'You.com' },
     { domain: 'phind.com', label: 'Phind' },
   ];
   ```

3. **allowlist 설정 외부화**
   - `backend/src/config/ai-referrers.json` (또는 .ts) 파일로 분리
   - 기존 하드코딩된 부분을 이 config에서 import하도록 변경

4. **검증용 엔드포인트 개선**
   - `GET /api/ga4/top-sources`에 `matched` 필드 추가
   ```json
   {
     "sources": [
       {"source": "chatgpt.com", "sessions": 45, "matched": true, "label": "ChatGPT"},
       {"source": "google", "sessions": 3200, "matched": false, "label": null}
     ]
   }
   ```

5. **오탐 방지 테스트**
   - `notchatgpt.com` 같은 유사 도메인이 매칭되지 않는지 확인하는 단위 테스트 또는 검증 로직

### 검증
- `chatgpt.com`, `chat.openai.com` 모두 ChatGPT로 매칭
- `perplexity.ai`, `gemini.google.com` 등 신규 추가 서비스 매칭 확인
- `notchatgpt.com`, `mygeminigame.com` 등 오탐 미발생 확인
- 기존 AI traffic API 응답에 새 서비스 데이터가 포함되는지

---

## 실행 순서

```
B0 (사전 확인, 필수) ─────────────────────────────┐
  │                                                │
  ├─→ B1 (캐싱 체계화, P0) ── 즉시 실행           │
  │                                                │
  ├─→ B2 (인텐트 가중치, P1) ── B1 완료 후        │
  │                                                │
  └─→ B3-B6 (P2, 병렬 가능) ──────────────────────┘
       ├── B3: Trend API
       ├── B4: Comparison API
       ├── B5: Funnel 고도화
       └── B6: AI allowlist 확장
```

핵심 규칙:
- B0은 반드시 먼저 실행. 결과에 따라 B1-B6 세부 접근이 달라짐.
- B1은 P0 (비용 절감 + 응답 속도 개선 즉시 효과)
- B3-B6는 서로 독립이므로 병렬 실행 가능
- 모든 프롬프트에서 "기존 코드를 먼저 읽는다"를 최우선 단계로 수행