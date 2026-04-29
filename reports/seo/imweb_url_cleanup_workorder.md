# 아임웹 URL 정리 작업 요청서

**문서 종류**: 운영팀 작업 지시서 (체크리스트 포함)
**대상**: 아임웹 운영 담당자
**작성**: Claude Code (B 승인안 진행 결과)
**승인일**: 2026-04-28 (TJ — "승인안 B 진행해")
**근거 문서**: `reports/seo/url_policy_recommendations.md`, `reports/seo/url_policy_matrix.csv`, `reports/seo/duplicate_url_groups.csv`, `reports/seo/url_inventory.csv`
**예상 작업 시간**: 4~6시간 (아임웹 관리자 익숙도 기준)
**롤백 가능 여부**: 모든 단계 즉시 롤백 가능 (자세한 기준은 본 문서 §5)

---

## 0. 작업 개요 (먼저 읽기)

### 0-1. 무엇을 하는가
바이오컴 사이트의 URL이 같은 페이지를 가리키는데도 여러 형태로 흩어져 있어, 구글이 「어느 게 진짜냐」를 헷갈립니다. 이 작업은 다음 4가지를 정리합니다.

1. **대표 URL 지정** — 같은 상품/검사권/칼럼이 여러 URL로 있을 때 「이 URL이 대표」라고 명시 (canonical 태그)
2. **검색결과 숨김 처리** — 로그인·장바구니·내부 검색 결과처럼 검색결과에 뜰 필요 없는 페이지에 noindex 메타 태그 추가
3. **검색엔진 제출 목록 정리** — robots.txt sitemap 지시문 형식 수정 (Markdown 링크 → 일반 URL)
4. **잡음 URL 차단** — 의미 없이 검색결과에 떠서 클릭률을 떨어뜨리는 URL 패턴 차단

### 0-2. 운영 영향
- **즉시 영향**: 없음 (사용자가 보는 화면은 그대로)
- **검색엔진 반영 시간**: 1~7일 (구글이 다시 크롤하면서 적용)
- **예상 SEO 효과**: 같은 키워드 검색에서 우리 사이트 노출이 분산되지 않고 한 URL에 모임 → 평균 순위·CTR 개선 (4~8주 후 측정 가능)

### 0-3. 사전 확인 사항 (작업 전 1번만)
- [ ] 아임웹 관리자 권한이 있는가
- [ ] SEO 설정 메뉴 (대시보드 > 사이트 관리 > SEO 또는 페이지별 SEO) 위치 확인
- [ ] robots.txt 편집 권한 확인 (사이트 관리 > robots.txt 또는 사용자 코드 영역)
- [ ] 작업 시작 전 현재 robots.txt 전체 복사해서 백업 (롤백용)

---

## 1. URL 종류별 처리 기준표 (한눈에 보기)

| # | URL 유형 | 예시 | canonical 처리 | sitemap 포함 | noindex 처리 | 우선순위 |
|---|---|---|---|---|---|---|
| 1 | 홈 | `/` | 자기 자신 | YES | NO | INFO |
| 2 | `/index` 별칭 | `/index` | → `/` 로 redirect 또는 canonical | NO | YES | P1 |
| 3 | 홈의 `?mode=privacy`/`?mode=policy` | `/?mode=privacy` | → 해당 정책 페이지로 | NO | YES | P1 |
| 4 | 카테고리/서비스 | `/service`, `/healthinfo`, `/HealthFood` | 자기 자신 | YES | NO | P0 |
| 5 | 상품 상세 | `/HealthFood/?idx=97` | 자기 자신 (대표 URL) | YES | NO | P0 |
| 6 | 검사권 상세 | `/organicacid_store/?idx=259` | 자기 자신 (대표 URL) | YES | NO | P0 |
| 7 | 같은 상품 다른 경로 | `/shop_view/?idx=97`, `/HealthFood/97` | → 대표 URL로 | NO | NO | P0 |
| 8 | 칼럼 글 | `/healthinfo/?bmode=view&idx=*` | 자기 자신 | 상위 칼럼 + 주요 글만 | NO | P1 |
| 9 | 리뷰/게시판 잡음 | `/?q=*&bmode=view&interlock=shop_review&idx=*&t=board` | (없음 — 검색 차단) | NO | YES | P0 |
| 10 | 검색 결과 페이지 | `/?q=*&page=*&only_photo=*` | (없음) | NO | YES | P0 |
| 11 | 로그인/회원가입 | `/login?*`, `/site_join_pattern_choice?*` | (없음) | NO | YES | P0 |
| 12 | 장바구니/마이페이지 | `/shop_cart`, `/shop_mypage` | (없음) | NO | YES | P0 |

---

## 2. 작업 절차 (한 줄씩 체크하면서 진행)

### 2-1. P0 작업 — 검색결과 숨김 처리 (noindex)

**목적**: 로그인·장바구니·검색결과·리뷰 잡음 페이지가 구글 검색결과에 뜨지 않도록 차단.

**아임웹 작업 위치**: 대시보드 > 사이트 관리 > SEO 설정 > 페이지별 SEO 또는 robots.txt 편집

| 체크 | URL 패턴 | 처리 방법 | 비고 |
|---|---|---|---|
| ☐ | `/login` (모든 변형) | 페이지 SEO에서 「검색엔진 색인 차단 (noindex)」 체크 | 로그인 페이지는 색인할 가치 없음 |
| ☐ | `/site_join_*` (회원가입 단계 페이지) | 동일 (noindex) | 가입 단계마다 다른 URL이라 잡음 |
| ☐ | `/membership` | 동일 (noindex) | 사용자 전용 페이지 |
| ☐ | `/shop_cart` | 동일 (noindex) | 장바구니는 사용자별 |
| ☐ | `/shop_mypage` (있다면) | 동일 (noindex) | 마이페이지 |
| ☐ | 검색결과 페이지 `/?q=*` | robots.txt에 `Disallow: /?q=` 추가 | 내부 검색결과는 검색엔진에 무의미 |
| ☐ | 리뷰 잡음 `interlock=shop_review` | robots.txt에 `Disallow: /*interlock=shop_review*` 추가 | 같은 리뷰가 여러 URL로 노출되어 검색결과에 잡음 |
| ☐ | `/?mode=privacy`, `/?mode=policy` | 정책 페이지 본문으로 redirect (있다면), 또는 noindex | 홈을 가리지 않도록 |

**검증**: 작업 후 각 URL을 시크릿 모드에서 열어 `<meta name="robots" content="noindex">` 또는 `Disallow:` 적용 확인.

### 2-2. P0/확인 작업 — 대표 URL 확인 (같은 상품 여러 URL)

**목적**: 같은 상품/검사권을 가리키는 여러 URL의 canonical이 현재 어떻게 자동 생성되는지 확인하고, GSC에서 Google이 어떤 표준 URL을 선택하는지 추적.

**아임웹 작업 위치**: 없음. 2026-04-28 아임웹 AI 답변 기준 특정 URL을 다른 URL로 301 리디렉션하거나 페이지별 canonical을 임의 URL로 직접 지정하는 기능은 제공하지 않는다. Canonical Tag는 아임웹이 자동 삽입한다.

**운영 방식 변경**: 이 단계는 더 이상 "canonical 입력 작업"이 아니다. 공개 HTML과 GSC URL 검사로 자동 canonical을 기록하고, 문제가 큰 항목만 상담원에게 예외 처리 가능 여부를 확인한다.

**확인 완료 · 작업 없음**: 아래 항목은 이미 정상 확인됐으므로 아임웹에서 입력하거나 상담할 일이 없다. 정기 점검 때만 다시 본다.

| URL | 상태 | 사유 |
|---|---|---|
| `https://biocom.kr/` (홈) | 완료 | 공개 HTML canonical이 `https://biocom.kr/`로 정상 확인됨. 아임웹 canonical 입력란이 없는 것도 정상 |
| `https://biocom.kr/service` (서비스 소개) | 완료 | 공개 HTML canonical이 `https://biocom.kr/service`로 정상 확인됨. 직접 입력 작업 없음 |

**남은 작업 체크리스트**: 아래는 실제로 확인하거나 상담원에게 물어볼 항목만 남긴다.

| 체크 | 대표 URL (목적지) | 합쳐야 할 다른 URL | 비고 |
|---|---|---|---|
| ☐ | `https://biocom.kr/HealthFood/?idx=97` (바이오밸런스) | `/HealthFood/97`, `/shop_view/?idx=97` 등 변형 | 공개 HTML canonical 정상 확인. GSC 표준 URL 추적 |
| ☐ | `https://biocom.kr/HealthFood/?idx=198` (뉴로마스터) | 변형 있다면 동일 처리 | 직접 변경 불가 전제. GSC 표준 URL 추적 |
| ☐ | `https://biocom.kr/organicacid_store/?idx=259` (종합 대사기능 분석) | `/organicacid`, `/organicacid_store`, `/shop_view/?idx=259` | 현재 canonical이 `/shop_view/?idx=259`로 확인됨. 상담원 예외 처리 가능 여부 확인 |
| ☐ | `https://biocom.kr/igg_store/?idx=85` (음식물 과민증 분석) | `/igg`, `/igg_store` | 직접 변경 불가 전제. 공개 HTML/GSC 추적 |
| ☐ | `https://biocom.kr/` (`/index` 홈 별칭) | `/index` | 홈 자체는 작업 없음. `/index`만 직접 301/canonical 설정 지원 안 됨으로 GSC 표준 URL 추적 |

**검증**: 각 변형 URL을 열고 `<head>` 안의 `<link rel="canonical" ...>` 값을 기록한다. 이후 GSC URL 검사에서 "사용자가 선언한 표준 URL"과 "Google이 선택한 표준 URL"을 함께 본다. 홈은 이미 `<link rel="canonical" href="https://biocom.kr/" />`로 확인됐으므로 체크리스트에서 제외한다.

**아임웹 상담원 문의가 필요한 경우**: AI 답변은 직접 설정 불가라고 했지만, `/organicacid_store/?idx=259`처럼 실제 canonical이 기대와 다르게 잡힌 항목은 예외 처리나 앱/코드 방식이 있는지 상담원에게 확인한다.

```
아임웹 AI 답변으로는 페이지별 canonical 직접 지정과 301 리디렉션 기능이 제공되지 않는다고 안내받았습니다.
이 전제는 이해했습니다.

다만 https://biocom.kr/organicacid_store/?idx=259 페이지의 공개 HTML canonical이
https://biocom.kr/shop_view/?idx=259 로 잡혀 있습니다.

이 canonical을 현재 상품 URL인 https://biocom.kr/organicacid_store/?idx=259 로 바꾸는 예외 처리,
또는 /shop_view 자동 URL이 검색 표준 URL로 잡히지 않게 하는 운영 권장 방식이 있는지 상담원 확인 부탁드립니다.
```

### 2-3. P1 작업 — robots.txt 정리

**현재 robots.txt sitemap 지시문 (수정 필요)**

```
Sitemap: [https://biocom.kr/sitemap.xml](https://biocom.kr/sitemap.xml)
Sitemap: https://biocom.kr/sitemap.xml
```

→ Markdown 링크 형식이 섞여 있어 일부 검색엔진이 첫 번째 줄을 파싱 실패할 수 있음.

**수정 후 robots.txt sitemap 부분 (이 형태로 교체)**

```
Sitemap: https://biocom.kr/sitemap.xml
```

**잡음 차단 규칙 추가 (User-agent: * 아래)**

```
# 내부 검색결과 차단 (잡음 URL)
Disallow: /?q=
Disallow: /*?q=*
# 리뷰 게시판 잡음 차단
Disallow: /*interlock=shop_review*
# 페이지네이션 잡음 차단
Disallow: /*&page=*&only_photo=*
# 정책 모드 별칭 차단
Disallow: /?mode=privacy
Disallow: /?mode=policy
```

**검증**: 저장 후 `https://biocom.kr/robots.txt` 직접 열어 위 규칙들이 보이는지 확인 → Google Search Console > Sitemaps 에서 sitemap 「다시 보내기」 → 24시간 후 「색인 상태」 확인.

### 2-4. P2 작업 — sitemap.xml 정리 (현재 문제 없음, 모니터링만)

**현재 상태**: sitemap.xml 안에 parameter URL이 0개로 깔끔함 (2026-04-27 기준).

**유지 작업**: 위 P0~P1 적용 후 1주일 뒤에 sitemap.xml에 잡음 URL이 새로 들어오지 않았는지 한 번 더 확인.

---

## 3. 작업 후 1주일 점검 체크리스트

작업 반영 후 7일이 지나면 다음을 한 번 확인합니다.

| 체크 | 확인 항목 | 어디에서 보나 | 정상 기준 |
|---|---|---|---|
| ☐ | Google Search Console > 색인 > 페이지 | https://search.google.com/search-console/index | 「색인 안 됨」 사유에 `noindex` 표시 페이지 수가 늘어 있어야 함 (의도한 차단이 적용된 증거) |
| ☐ | Google Search Console > 페이지 검사 | 핵심 6개 URL 입력 | 「색인됨」 + 사용자가 선언한 표준 URL = Google이 선택한 표준 URL 일치 |
| ☐ | 시크릿 모드에서 차단 URL 직접 열기 | `/login`, `/?q=...` 등 | 페이지 source view에서 `noindex` 메타 또는 robots.txt 차단 확인 |
| ☐ | 같은 상품 검색 (예: "바이오밸런스") | 구글 검색 | 같은 상품의 다른 URL이 동시에 안 뜨는지 확인 |

---

## 4. 작업 안 해도 되는 것 (혼동 방지)

다음은 이번 작업 범위 **밖**입니다. 임의로 손대지 마세요.

- 상품 상세 페이지의 본문 텍스트·이미지 (콘텐츠팀이 별도로 처리 — 승인안 C)
- 페이지 디자인·레이아웃
- 가격·재고·옵션 정보
- 신규 페이지 추가
- JSON-LD (검색엔진 설명서 코드) 삽입 — 별도 작업 (TJ 추가 승인 필요)

---

## 5. 롤백 기준 (이렇게 되면 되돌리기)

작업 반영 후 다음 중 하나라도 발생하면 **즉시 해당 단계만 되돌립니다**.

| 신호 | 어디서 보나 | 대응 |
|---|---|---|
| GSC 「색인됨」 페이지 수가 1주일 만에 30% 이상 줄음 | Search Console > 색인 > 페이지 | noindex 적용 범위 재확인. 의도하지 않은 페이지가 차단됐는지 점검 |
| 핵심 상품 페이지 (idx=97, 198, 259, 85)가 「색인 안 됨」으로 분류 | Search Console > 페이지 검사 | 즉시 noindex 해제 + canonical 재확인 |
| robots.txt 저장 후 sitemap.xml이 200 응답 안 함 | https://biocom.kr/sitemap.xml | robots.txt를 백업본으로 즉시 되돌리기 |
| 메인 카테고리 (`/service`, `/healthinfo`, `/HealthFood`) 가 검색결과에서 사라짐 | "biocom.kr/service" 등 사이트 검색 | canonical/noindex가 잘못 적용된 페이지 찾아 해제 |
| 상품 상세 전환율이 의미 있게(7일 평균 -20% 이상) 하락 | GA4 또는 아임웹 통계 | 이번 작업과 직접 관계 없을 가능성 크지만, 우선 noindex 적용 페이지에서 redirect 받는 트래픽 손실 여부 점검 |

**롤백 절차**:
1. 아임웹 관리자에서 해당 페이지의 noindex 체크 해제 / canonical을 자기 자신으로 되돌리기.
2. robots.txt는 작업 시작 전 백업본으로 교체 (사전 확인 사항 §0-3).
3. Search Console > URL 검사에서 해당 URL 「색인 요청」 다시 보내기.
4. 24~48시간 내 색인 상태 정상화 확인.

---

## 6. 진행 상황 보고 양식

작업 중·후 다음 양식으로 TJ에게 회신:

```
[아임웹 URL 정리 작업 보고]

§2-1 noindex 처리: __개 URL 적용 / __개 보류 (사유)
§2-2 canonical 통일: __개 URL 적용 / __개 보류 (사유)
§2-3 robots.txt 수정: 적용 완료 ☐ / 미적용 ☐ (사유)
§3 1주일 점검: __개 정상 / __개 이상 (상세)

이상 사항: (있다면 §5 롤백 기준 중 어느 항목인지)
첨부: 적용 전·후 robots.txt 파일
```

---

## 7. 부록: 데이터 근거

이 요청서의 모든 처리 기준은 다음 분석 결과에 근거합니다.

| 근거 파일 | 무엇이 들어 있는가 |
|---|---|
| `reports/seo/url_inventory.csv` | 공개 사이트에서 수집한 전체 URL 300건 |
| `reports/seo/url_policy_matrix.csv` | URL 유형별 정책 추천 매트릭스 |
| `reports/seo/url_policy_recommendations.md` | 정책 근거와 자신감(confidence) 78% |
| `reports/seo/duplicate_url_groups.csv` | 중복 의심 URL 그룹 4개 |
| `reports/seo/canonical_duplicate_risk.md` | 중복 위험 패턴 분석 |
| `reports/seo/robots_sitemap_audit.md` | robots.txt와 sitemap.xml 진단 |

추가 분석이 필요하면 위 파일 또는 `http://localhost:7010/seo` (내부 대시보드)를 참고.
