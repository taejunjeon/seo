# robots.txt 수정안

**대상 파일**: `https://biocom.kr/robots.txt`
**현재 상태 진단**: 공개 `robots.txt` 직접 확인 + `reports/seo/robots_sitemap_audit.md`
**검토 시각**: 2026-04-28 17:42 KST
**수정 우선순위**: P0 (sitemap 지시문 형식) + P1 (잡음 차단 규칙)
**정본 문서**: `imweb/robotstxt.md`

---

## 1. 현재 robots.txt 문제점

```
User-agent: *
Allow: /
Disallow: /site_join
Disallow: /site_join_agree
Disallow: /login
Disallow: /logout.cm
Disallow: /shop_cart
Disallow: /?mode*
Disallow: /admin
User-agent: *
# 불필요한 커머스 경로 차단 (크롤링 예산 절약)
Disallow: /admin/
Disallow: /cart/
Disallow: /order/
Disallow: /mypage/
Disallow: /login/
Disallow: /join/

# 저가치 및 중복 콘텐츠 경로 차단
Disallow: /search/
Disallow: /shipping-info/
Disallow: /policy/
Disallow: /*?search=

# AI 크롤러 전용 요약 파일 경로 허용 및 명시
Allow: /llms.txt
Sitemap: https://biocom.kr/sitemap.xml
```

- **해결 1**: Markdown sitemap 링크가 사라졌다.
- **해결 2**: sitemap 줄이 `Sitemap: https://biocom.kr/sitemap.xml` 한 줄만 남았다.
- **해결 3**: `sitemap.xml.`처럼 끝에 마침표가 붙은 문제도 없다.
- **남은 구조**: 아임웹 기본 블록이 앞에 자동으로 붙고 사용자 입력 블록이 뒤에 붙어 `User-agent: *`가 2번 보인다. Google은 같은 user-agent 그룹을 합쳐 해석하므로 현재 상태는 사용 가능하다.

---

## 2. 수정 후 robots.txt (적용본)

아임웹 robots.txt 입력칸에 넣을 정본이다. 2026-04-28 17:42 KST 공개 확인 결과 아임웹이 sitemap 줄을 자동으로 뒤에 추가하고 있으므로, 입력창에는 `Sitemap:` 줄을 넣지 않는 것을 1순위로 권장한다.

```
User-agent: *

# 불필요한 커머스 경로 차단 (크롤링 예산 절약)
Disallow: /admin/
Disallow: /cart/
Disallow: /order/
Disallow: /mypage/
Disallow: /login/
Disallow: /join/

# 저가치 및 중복 콘텐츠 경로 차단
Disallow: /search/
Disallow: /shipping-info/
Disallow: /policy/
Disallow: /*?search=

# SEO 정리 작업 추가 (2026-04-28 B 승인안 반영)
# 내부 검색결과 차단 (잡음 URL)
Disallow: /?q=
Disallow: /*?q=*
Disallow: /*&q=*

# 리뷰 게시판 잡음 차단 (같은 리뷰가 여러 URL로 노출)
Disallow: /*interlock=shop_review*

# 검색결과 페이지네이션 잡음 차단
Disallow: /*&page=*&only_photo=*
Disallow: /*?page=*&only_photo=*

# AI 크롤러 전용 요약 파일 경로 허용 및 명시
Allow: /llms.txt
```

아임웹 저장 후 공개 파일의 마지막에 아래 줄이 자동으로 1개 붙으면 정상이다.

```
Sitemap: https://biocom.kr/sitemap.xml
```

---

## 3. 최종 공개 목표본

아임웹이 자동 기본 블록까지 포함해 최종 공개 파일을 직접 정리할 수 있다면, 공개 `https://biocom.kr/robots.txt`는 아래처럼 한 그룹으로 보이는 것이 가장 좋다.

```txt
User-agent: *
Allow: /

# 아임웹 기본/회원/관리 영역
Disallow: /site_join
Disallow: /site_join_agree
Disallow: /login
Disallow: /logout.cm
Disallow: /shop_cart
Disallow: /?mode*
Disallow: /admin

# 불필요한 커머스 경로 차단 (크롤링 예산 절약)
Disallow: /admin/
Disallow: /cart/
Disallow: /order/
Disallow: /mypage/
Disallow: /login/
Disallow: /join/

# 저가치 및 중복 콘텐츠 경로 차단
Disallow: /search/
Disallow: /shipping-info/
Disallow: /policy/
Disallow: /*?search=

# SEO 정리 작업 추가 (2026-04-28 B 승인안 반영)
Disallow: /?q=
Disallow: /*?q=*
Disallow: /*&q=*
Disallow: /*interlock=shop_review*
Disallow: /*&page=*&only_photo=*
Disallow: /*?page=*&only_photo=*

# AI 크롤러 전용 요약 파일 경로 허용 및 명시
Allow: /llms.txt

# Sitemap
Sitemap: https://biocom.kr/sitemap.xml
```

---

## 3-1. 적용 후 공개 확인

2026-04-28 17:42 KST 기준 공개 `robots.txt`의 sitemap 줄은 다음과 같다.

```
Sitemap: https://biocom.kr/sitemap.xml
```

판단:

- Markdown 링크 형식은 사라졌다.
- `sitemap.xml.`처럼 끝에 마침표가 붙은 문제도 없다.
- sitemap 줄은 1개다.
- robots.txt와 sitemap.xml 모두 HTTP 200으로 응답한다.
- robots.txt 정리는 적용 완료로 본다.

---

## 4. 적용 절차

1. **백업**: 현재 robots.txt 입력값 전체를 `robots_backup_20260428.txt` 같은 이름으로 저장한다.
2. **편집**: 아임웹 관리자 > 사이트 관리 > robots.txt 입력칸에서 `## 2. 수정 후 robots.txt (적용본)` 블록으로 교체한다.
3. **저장**: 저장 후 `https://biocom.kr/robots.txt` 직접 열어 적용 확인한다.
4. **GSC 재제출**: Google Search Console > Sitemaps > `https://biocom.kr/sitemap.xml`을 다시 제출한다.
5. **Naver 확인**: Naver Search Advisor에서 robots.txt 수집/검증을 실행한다.
6. **24시간 후 검증**: GSC와 Naver에서 차단 URL이 의도대로 제외되는지 확인한다.

---

## 5. 검증 (적용 직후)

| 항목 | 명령/위치 | 정상 결과 |
|---|---|---|
| robots.txt 파일 자체 응답 | `curl -I https://biocom.kr/robots.txt` | HTTP 200 |
| sitemap 지시문 1줄로 정리됐는지 | `curl https://biocom.kr/robots.txt \| grep '^Sitemap:'` | `Sitemap: https://biocom.kr/sitemap.xml` 1줄 |
| sitemap.xml 자체 정상 응답 | `curl -I https://biocom.kr/sitemap.xml` | HTTP 200, content-type: application/xml |
| sitemap URL 수 | `curl https://biocom.kr/sitemap.xml \| grep -c '<loc>'` | 239 전후 |
| 잡음 URL이 차단됐는지 | GSC URL 검사로 `/?q=test` 입력 | robots.txt 차단 표시 |

---

## 6. 주의사항

- robots.txt의 `Disallow`는 수집 차단이다. 이미 검색결과에 노출된 URL을 즉시 삭제하는 기능이 아니다.
- 이미 색인된 URL 제거가 목적이면 `noindex`, 404/410, redirect, Search Console/Naver 제외 요청을 별도로 사용한다.
- 핵심 상품 URL인 `/HealthFood/?idx=97`, `/HealthFood/?idx=198`, `/organicacid_store/?idx=259`, `/igg_store/?idx=85`는 이번 규칙에 걸리지 않는다.
- `llms.txt`의 긴 본문은 robots.txt가 아니라 아임웹 llms.txt 입력란에 둔다.
- `https://biocom.kr/rss`는 아임웹이 별도로 제공하는 RSS 주소다. 이번 robots.txt 변경 범위에는 넣지 않는다.

---

## 7. 롤백 절차

robots.txt 변경 후 다음 중 하나라도 발생하면 즉시 백업본으로 교체한다.

- 핵심 페이지 (`/`, `/service`, `/HealthFood/?idx=97`, `/HealthFood/?idx=198`, `/organicacid_store/?idx=259`, `/igg_store/?idx=85`)가 「색인 안 됨」으로 분류된다.
- sitemap.xml이 200 응답하지 않는다.
- 사이트 트래픽이 24시간 만에 의미 있게(전일 대비 -30% 이상) 하락한다.

**롤백 명령**: 아임웹 관리자에서 백업본(`robots_backup_20260428.txt`) 내용으로 교체 → 저장 → `https://biocom.kr/robots.txt` 재확인.
