# 아임웹 robots.txt 검토 기록

작성 시각: 2026-04-28 16:08 KST  
기준일: 2026-04-28  
대상: `https://biocom.kr/robots.txt`  
Primary source: 공개 `robots.txt`, 공개 `sitemap.xml`, Google Search Central robots.txt 문서, Naver Search Advisor robots.txt 문서  
Freshness: 2026-04-28 17:42 KST 적용 후 직접 확인  
Confidence: 92%

## 10초 요약

결론은 **적용 완료**다. 2026-04-28 17:42 KST 공개 확인 기준으로 Markdown sitemap 링크, sitemap 중복, 끝 마침표 문제가 모두 해결됐다. 현재 `Sitemap: https://biocom.kr/sitemap.xml` 한 줄만 남아 있다.

## 왜 바꿔야 하는가

현재 공개 `robots.txt`에는 아래 문제가 있다.

1. sitemap 첫 줄이 Markdown 링크 형식이다.
2. 같은 sitemap URL이 두 번 나온다.
3. 내부 검색, 리뷰 interlock, 검색결과 페이지네이션 같은 잡음 URL 차단 규칙이 아직 공개 파일에 반영되지 않았다.

robots.txt는 Markdown 문서가 아니라 일반 텍스트 규칙 파일이다. 따라서 `Sitemap: [https://biocom.kr/sitemap.xml](https://biocom.kr/sitemap.xml)` 형식은 쓰지 않는다.

## 현재 공개 상태

2026-04-28 16:08 KST 기준 공개 응답은 다음과 같다.

```txt
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

# 사이트맵 경로 안내
Sitemap: [https://biocom.kr/sitemap.xml](https://biocom.kr/sitemap.xml)
Sitemap: https://biocom.kr/sitemap.xml
```

확인된 sitemap 상태:

| 항목 | 값 |
|---|---:|
| `https://biocom.kr/sitemap.xml` 응답 | 200 |
| content-type | `application/xml` |
| `<loc>` 수 | 239 |

## 적용 후 공개 확인

2026-04-28 17:42 KST 기준 공개 `robots.txt`의 sitemap 줄은 다음과 같다.

```txt
Sitemap: https://biocom.kr/sitemap.xml
```

판단:

- Markdown 링크 형식은 사라졌다.
- `sitemap.xml.`처럼 끝에 마침표가 붙은 문제도 없다.
- sitemap 줄은 1개다.
- robots.txt와 sitemap.xml 모두 HTTP 200으로 응답한다.
- robots.txt 정리는 적용 완료로 본다.

## 다시 검토한 판단

| 항목 | 판단 | 이유 |
|---|---|---|
| Markdown sitemap 줄 제거 | YES | robots.txt는 plain text 규칙이다. sitemap 값은 절대 URL이면 충분하다. |
| sitemap 한 줄만 유지 | YES | 여러 sitemap 줄 자체는 가능하지만 같은 URL 중복은 필요 없다. |
| `/?q=` 차단 | YES | 내부 검색결과 URL은 검색결과 품질을 떨어뜨리는 저가치 URL이다. |
| `interlock=shop_review` 차단 | YES | 같은 리뷰가 여러 URL로 노출되는 중복 잡음이다. |
| `page + only_photo` 차단 | YES | 검색결과/리뷰 페이지네이션 잡음을 줄이는 규칙이다. |
| `/?mode=privacy`, `/?mode=policy` 차단 | 조건부 YES | 현재 아임웹 기본 규칙 `Disallow: /?mode*`가 이미 더 넓게 막고 있다. 별도 추가는 중복이라 최종안에서는 `/?mode*` 유지로 정리한다. |
| RSS를 sitemap 줄에 추가 | 보류 | 아임웹이 RSS 주소를 별도로 제공하므로 이번 robots.txt 수정 범위에는 넣지 않는다. |
| llms.txt 본문을 robots.txt에 삽입 | NO | `Allow: /llms.txt`만 robots.txt에 두고, 긴 설명 본문은 아임웹의 llms.txt 입력란에 따로 둔다. |

## 아임웹 입력안

아임웹 robots.txt 입력칸에 넣을 정본이다. 2026-04-28 17:42 KST 공개 확인 결과 아임웹이 sitemap 줄을 자동으로 추가하고 있으므로, 입력창에는 `Sitemap:` 줄을 넣지 않는 것을 1순위로 권장한다.

```txt
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

```txt
Sitemap: https://biocom.kr/sitemap.xml
```

## 최종 공개 목표본

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

## llms.txt 처리

TJ님이 아임웹에서 본 아래 내용은 robots.txt가 아니라 llms.txt 입력란에 들어갈 내용이다.

```txt
User-agent: *
Allow: /
Commercial-use: allowed
Research-use: allowed
```

그 아래의 바이오컴 설명, 핵심 기술, 주요 분석 서비스, 공식 링크도 llms.txt 본문으로는 사용할 수 있다. 단, `800만 건`, `KOLAS급`, `92% 재현성`, `규격번호` 같은 신뢰·성능 표현은 외부 노출 문서가 되므로 내부 근거가 확인된 문구만 유지한다.

## 적용 절차

1. 아임웹 관리자에서 현재 robots.txt 입력값을 백업한다.
2. 위 `아임웹 입력안`으로 교체한다.
3. 저장 후 `https://biocom.kr/robots.txt`를 직접 연다.
4. `Sitemap:` 줄이 `Sitemap: https://biocom.kr/sitemap.xml` 한 줄만 남았는지 확인한다.
5. `https://biocom.kr/sitemap.xml`이 200으로 응답하는지 확인한다.
6. Google Search Console과 Naver Search Advisor에서 robots.txt 수집/검증을 실행한다.
7. Google Search Console > Sitemaps에서 `https://biocom.kr/sitemap.xml`을 다시 제출한다.

## 적용 직후 검증 명령

```bash
curl -I https://biocom.kr/robots.txt
curl https://biocom.kr/robots.txt | grep '^Sitemap:'
curl -I https://biocom.kr/sitemap.xml
curl https://biocom.kr/sitemap.xml | grep -c '<loc>'
```

정상 기준:

| 항목 | 정상 |
|---|---|
| robots.txt | HTTP 200 |
| sitemap 줄 | `Sitemap: https://biocom.kr/sitemap.xml` 1줄 |
| sitemap.xml | HTTP 200 |
| sitemap `<loc>` 수 | 239 전후 |

## 주의할 점

- robots.txt의 `Disallow`는 수집 차단이다. 이미 검색결과에 나온 URL을 바로 지우는 기능이 아니다.
- 이미 색인된 URL을 제거하려면 해당 페이지의 `noindex`, 404/410, redirect, Search Console/Naver 제외 요청을 별도로 써야 한다.
- 핵심 상품 URL인 `/HealthFood/?idx=97`, `/HealthFood/?idx=198`, `/organicacid_store/?idx=259`, `/igg_store/?idx=85`는 이번 규칙에 걸리지 않는다.
- CSS, JS, 이미지 같은 렌더링 리소스를 넓게 막지 않는다. 네이버도 검색 로봇이 페이지 해석을 위해 리소스를 수집할 수 있어야 한다고 안내한다.

## 근거

- Google Search Central: robots.txt는 plain text 규칙 파일이며 `Sitemap: [absoluteURL]` 형식을 사용한다. 여러 sitemap 줄은 가능하지만 이번 경우는 같은 URL 중복이라 한 줄이면 충분하다. https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt
- Google Search Central: robots.txt로 차단된 URL은 내용 색인은 막히지만 URL 자체가 검색결과에 남을 수 있다. 제거 목적이면 noindex 등 별도 방법이 필요하다. https://developers.google.com/search/docs/crawling-indexing/block-indexing
- Naver Search Advisor: robots.txt는 루트 디렉터리의 일반 텍스트 파일이어야 하며, sitemap.xml 위치를 robots.txt에 기록할 수 있다. https://searchadvisor.naver.com/guide/seo-basic-robots
- Naver Search Advisor: 검색결과 제외에는 noindex, 삭제/에러 응답, 제외 요청 등이 필요하며 robots.txt 선차단만으로는 원하는 제거가 안 될 수 있다. https://searchadvisor.naver.com/guide/faq-serpremove
