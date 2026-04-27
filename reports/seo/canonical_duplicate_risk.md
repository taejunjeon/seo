# canonical / 중복 URL 위험 진단

작성 시각: 2026-04-27 21:17 KST
기준일: 2026-04-27
Source: URL 인벤토리, 핵심 페이지 본문 hash, 공개 HTML canonical
Freshness: 2026-04-27 21:17 KST
Confidence: 76%

## 10초 요약

수집 URL 300개 중 parameter URL은 53개다. noisy parameter URL로 분류된 URL은 25개다. 중복 의심 그룹은 4개다.

## URL 유형 요약

| 유형 | 수 |
| --- | --- |
| home | 2 |
| category | 242 |
| lab/test service | 2 |
| product | 17 |
| article/column | 4 |
| cart/login/member | 8 |
| noisy parameter URL | 25 |

## 중복 의심 그룹 예시

| 그룹 | URL 수 | 대표 URL 후보 | 유형 |
| --- | --- | --- | --- |
| https://biocom.kr/ | 3 | https://biocom.kr/ | home | noisy parameter URL |
| https://biocom.kr/login | 3 | https://biocom.kr/login?back_url=Lw%3D%3D&used_login_btn=Y | cart/login/member |
| https://biocom.kr/site_join_pattern_choice | 2 | https://biocom.kr/site_join_pattern_choice?back_url=Lw%3D%3D | cart/login/member |
| :q | 10 | https://biocom.kr/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&page=1&only_photo=Y | noisy parameter URL |

## 판단

사실: 중복 그룹은 URL 패턴과 본문 hash 기준의 기계적 후보군이다.

현재 판단: `/index/?bmode=view&idx=...`, `?idx=`, `?bmode=view` 유형은 canonical, 내부 링크, sitemap 정책을 함께 정해야 한다.
