# robots.txt 수정안

**대상 파일**: `https://biocom.kr/robots.txt`
**현재 상태 진단**: `reports/seo/robots_sitemap_audit.md` (2026-04-27 21:17 KST 기준)
**수정 우선순위**: P0 (sitemap 지시문 형식) + P1 (잡음 차단 규칙)

---

## 1. 현재 robots.txt 문제점

```
Sitemap: [https://biocom.kr/sitemap.xml](https://biocom.kr/sitemap.xml)
Sitemap: https://biocom.kr/sitemap.xml
```

- **문제 1**: 첫 줄이 Markdown 링크 형식. 일부 검색엔진(특히 Naver)이 파싱 실패할 수 있음.
- **문제 2**: 같은 sitemap URL이 2번 등장. 둘 다 같은 곳을 가리키지만 첫 줄을 정상 처리하는 검색엔진은 중복으로 판단.

---

## 2. 수정 후 robots.txt (적용본)

기존 robots.txt 전체를 백업한 뒤, sitemap 부분과 잡음 차단 규칙을 다음으로 교체합니다.

```
User-agent: *

# === 기본 정책 (기존 규칙 유지) ===
# (기존 robots.txt에 있던 다른 Disallow 규칙들은 그대로 유지)

# === SEO 정리 작업 추가 (2026-04-28 B 승인안 반영) ===
# 내부 검색결과 차단 (잡음 URL)
Disallow: /?q=
Disallow: /*?q=*

# 리뷰 게시판 잡음 차단 (같은 리뷰가 여러 URL로 노출)
Disallow: /*interlock=shop_review*

# 검색결과 페이지네이션 잡음 차단
Disallow: /*&page=*&only_photo=*

# 정책 모드 별칭 차단 (홈을 가리지 않도록)
Disallow: /?mode=privacy
Disallow: /?mode=policy

# === Sitemap (1줄로 단순화) ===
Sitemap: https://biocom.kr/sitemap.xml
```

---

## 3. 적용 절차

1. **백업**: 현재 robots.txt 전체를 `robots_backup_20260428.txt` 같은 파일로 저장 (롤백용)
2. **편집**: 아임웹 관리자 > 사이트 관리 > robots.txt (또는 사용자 코드 영역) 에서 위 내용으로 교체
3. **저장**: 저장 후 `https://biocom.kr/robots.txt` 직접 열어 적용 확인
4. **GSC 재제출**: Google Search Console > Sitemaps > `https://biocom.kr/sitemap.xml` 「다시 보내기」
5. **24시간 후 검증**: GSC > 색인 > 페이지 리포트에서 「색인 안 됨」 사유에 `Disallow: /?q=` 등이 새로 표시되는지 확인 (정상)

---

## 4. 검증 (적용 직후)

| 항목 | 명령/위치 | 정상 결과 |
|---|---|---|
| robots.txt 파일 자체 응답 | `curl -I https://biocom.kr/robots.txt` | HTTP 200 |
| sitemap 지시문 1줄로 정리됐는지 | `curl https://biocom.kr/robots.txt \| grep Sitemap` | `Sitemap: https://biocom.kr/sitemap.xml` (1줄만) |
| 잡음 URL이 차단됐는지 | GSC URL 검사로 `/?q=test` 입력 | 「robots.txt에 의해 차단됨」 표시 |
| sitemap.xml 자체 정상 응답 | `curl -I https://biocom.kr/sitemap.xml` | HTTP 200, content-type: application/xml |

---

## 5. 1주일 후 검증

| 항목 | 위치 | 정상 결과 |
|---|---|---|
| GSC 「색인 안 됨」 사유에 robots.txt 차단 페이지 수 증가 | GSC > 색인 > 페이지 | parameter URL이 차단됐다는 증거 |
| 핵심 6개 페이지는 여전히 「색인됨」 | GSC > URL 검사 | 정상 색인 유지 |
| sitemap의 URL 수가 변하지 않음 | `curl https://biocom.kr/sitemap.xml \| grep -c '<loc>'` | 239 ± 5 (정상 변동 범위) |

---

## 6. 롤백 절차

robots.txt 변경 후 다음 중 하나라도 발생하면 즉시 백업본으로 교체:

- 핵심 페이지 (`/`, `/service`, `/HealthFood/?idx=97` 등)가 「색인 안 됨」으로 분류
- sitemap.xml이 200 응답하지 않음
- 사이트 트래픽이 24시간 만에 의미 있게(전일 대비 -30% 이상) 하락

**롤백 명령**: 아임웹 관리자에서 백업본(`robots_backup_20260428.txt`) 내용으로 교체 → 저장 → `https://biocom.kr/robots.txt` 재확인.
