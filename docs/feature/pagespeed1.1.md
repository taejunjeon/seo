# PageSpeed 실행 결과 (pagespeed1.1)

- 대상 URL: https://biocom.kr (mobile/desktop)

> PSI는 **시뮬레이션(점수 산정용)** 과 **관측(실측 trace)** 값이 동시에 존재합니다. 아래에는 둘 다 표기했습니다.

## MOBILE 측정

- 측정 시각: 2026-02-13T15:02:02.719Z
- URL: https://biocom.kr
- Performance 점수: 28
- LCP(시뮬레이션): 42.45 s / LCP(관측): 3.13 s
- FCP(시뮬레이션): 16.95 s / FCP(관측): 2.87 s

### 1) LCP 요소(이번 측정)

- 요소 타입: 이미지(background-image)
- selector: `div#visual_s202503180fc3967c44ca2 > div.owl-carousel > div.owl-item > div.item`
- 화면 텍스트(요약): 당신을 가장 잘 아는 바이오컴이 건강을 약속할게요.
- 리소스 URL: https://cdn.imweb.me/thumbnail/20250318/2cb6fd2bae8a9.png
- 전송량(transfer): 1.11 MB / MIME: image/png

### 2) LCP 구간별 분해(TTFB/로딩지연/다운로드/렌더)

| 구간 | 시간 |
| --- | --- |
| TTFB | 601 ms |
| 로딩 지연(요청 시작까지) | 37.26 s |
| 다운로드(요청 duration) | 377 ms |
| 렌더 지연(다운로드 후 paint까지) | 4.22 s |

- 가장 큰 병목: **로딩 지연(요청 시작까지)**
- 참고: PSI는 시뮬레이션/관측 값이 함께 있어 LCP가 과대/과소 추정될 수 있습니다.

### 3) FCP를 막는 상위 10개 리소스(CSS/JS) + 낭비 시간(ms)

| # | 타입 | 낭비(추정) | 전송량 | URL |
| --- | --- | --- | --- | --- |
| 1 | CSS | 3.90 s | 62.5 KB | https://vendor-cdn.imweb.me/css/site/site2.css?1769595241 |
| 2 | CSS | 3.45 s | 51.5 KB | https://vendor-cdn.imweb.me/minify_css/vendor_blue_10.css?1653367465 |
| 3 | CSS | 3.30 s | 51.2 KB | https://vendor-cdn.imweb.me/css/site/site.css?1754031372 |
| 4 | CSS | 2.25 s | 31.3 KB | https://vendor-cdn.imweb.me/minify_css/vendor_red_10.css?1653367465 |
| 5 | JS | 1.95 s | 33.3 KB | https://vendor-cdn.imweb.me/js/jquery.js?1627517460 |
| 6 | JS | 1.66 s | 19.2 KB | https://t1.daumcdn.net/kas/static/kp.js |
| 7 | CSS | 1.50 s | 21.1 KB | https://vendor-cdn.imweb.me/css/tailwind.css?1768193489 |
| 8 | CSS | 1.41 s | 25.7 KB | https://biocom.kr/css/custom.cm?1770951522 |
| 9 | JS | 1.20 s | 8.9 KB | https://player.vimeo.com/api/player.js |
| 10 | JS | 1.20 s | 10.5 KB | https://wcs.naver.net/wcslog.js |

### 4) 전송량 Top 20 요청(타입별) + “첫 화면” vs “지연” 추천

#### 이미지

| 분류 | 전송량 | 우선순위 | 시작 | 호스트 | URL |
| --- | --- | --- | --- | --- | --- |
| 나중(지연 가능) | 4.01 MB | Low | 2919ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20241211/c8eff025bd220.png |
| 첫 화면 필수(LCP) | 1.11 MB | High | 2795ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250318/2cb6fd2bae8a9.png |
| 나중(지연 가능) | 657.6 KB | Low | 6053ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20241211/758948a4198da.png |
| 나중(지연 가능) | 591.6 KB | Low | 2691ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250124/aed3c9951b922.png |
| 나중(지연 가능) | 393.4 KB | Low | 2691ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250114/6b1b2dc1e3b94.png |
| 나중(지연 가능) | 365.9 KB | Low | 2690ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250114/1672ac3fb43d7.png |
| 나중(지연 가능) | 357.2 KB | Low | 6053ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20241211/b45020c524364.png |
| 나중(지연 가능) | 339.5 KB | Low | 2687ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20241230/40bd811db0d74.png |
| 나중(지연 가능) | 328.3 KB | Low | 2691ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20251201/9afbfce20eec4.png |
| 나중(지연 가능) | 318.0 KB | Low | 2687ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250117/1a4bb22c67116.png |
| 나중(지연 가능) | 287.7 KB | Low | 2689ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250117/dae3f6647f2a4.png |
| 나중(지연 가능) | 279.7 KB | Low | 7777ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20260213/17b759c61efd9.jpg |

#### 기타

| 분류 | 전송량 | 우선순위 | 시작 | 호스트 | URL |
| --- | --- | --- | --- | --- | --- |
| 나중(지연 가능) | 1.19 MB | High | 11814ms | vod-adaptive-ak.vimeocdn.com | https://vod-adaptive-ak.vimeocdn.com/exp=1770998439~acl=%2Fdcb9ea24-12f2-4cce-94e0-91d0068c9f35%2Fpsid%3Dfcb7c86c6bad3265aa34b7fbdd20cfb181601acb182a09790cef15ae75863809%2F%2A~hmac=be981724d1a80fabe0f435d35764cccd76449716b34976e4f3ace82674d755f6/dcb9ea24-12f2-4cce-94e0-91d0068c9f35/psid=fcb7c86c6bad3265aa34b7fbdd20cfb181601acb182a09790cef15ae75863809/v2/range/prot/cmFuZ2U9MTAzMTY2NS0yMjc1NjI4/avf/8b4938e2-dc3a-48e6-b305-ed1bf877541c.mp4?pathsig=8c953e4f~7h6-Rl-GdqFb-OYInAs9-6M-Kj4T7taB5jBZPm8LdUI&r=dXMtZWFzdDE%3D&range=1031665-2275628 |
| 나중(지연 가능) | 1007.4 KB | High | 9937ms | vod-adaptive-ak.vimeocdn.com | https://vod-adaptive-ak.vimeocdn.com/exp=1770998439~acl=%2Fdcb9ea24-12f2-4cce-94e0-91d0068c9f35%2Fpsid%3Dfcb7c86c6bad3265aa34b7fbdd20cfb181601acb182a09790cef15ae75863809%2F%2A~hmac=be981724d1a80fabe0f435d35764cccd76449716b34976e4f3ace82674d755f6/dcb9ea24-12f2-4cce-94e0-91d0068c9f35/psid=fcb7c86c6bad3265aa34b7fbdd20cfb181601acb182a09790cef15ae75863809/v2/range/prot/cmFuZ2U9ODcxLTEwMzE2NjQ/avf/8b4938e2-dc3a-48e6-b305-ed1bf877541c.mp4?pathsig=8c953e4f~TbEyOg-xkuaoUsuOruPwaEdFORrCWMHzZppkDkAowG0&r=dXMtZWFzdDE%3D&range=871-1031664 |
| 나중(지연 가능) | 836.4 KB | High | 11897ms | vod-adaptive-ak.vimeocdn.com | https://vod-adaptive-ak.vimeocdn.com/exp=1770998439~acl=%2Fdcb9ea24-12f2-4cce-94e0-91d0068c9f35%2Fpsid%3Dfcb7c86c6bad3265aa34b7fbdd20cfb181601acb182a09790cef15ae75863809%2F%2A~hmac=be981724d1a80fabe0f435d35764cccd76449716b34976e4f3ace82674d755f6/dcb9ea24-12f2-4cce-94e0-91d0068c9f35/psid=fcb7c86c6bad3265aa34b7fbdd20cfb181601acb182a09790cef15ae75863809/v2/range/prot/cmFuZ2U9MjI3NTYyOS0zMTMxMzY4/avf/8b4938e2-dc3a-48e6-b305-ed1bf877541c.mp4?pathsig=8c953e4f~Z89Z83SOck-8N14LYDS2CE9-Z6nGyV4FSBVvQB7BM6Y&r=dXMtZWFzdDE%3D&range=2275629-3131368 |

#### 폰트

| 분류 | 전송량 | 우선순위 | 시작 | 호스트 | URL |
| --- | --- | --- | --- | --- | --- |
| 첫 화면 가능성↑ | 807.3 KB | VeryHigh | 2799ms | vendor-cdn.imweb.me | https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Bold.woff2 |
| 첫 화면 가능성↑ | 802.8 KB | VeryHigh | 2799ms | vendor-cdn.imweb.me | https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-SemiBold.woff2 |
| 첫 화면 가능성↑ | 796.2 KB | VeryHigh | 2800ms | vendor-cdn.imweb.me | https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Medium.woff2 |
| 첫 화면 가능성↑ | 786.6 KB | VeryHigh | 2930ms | vendor-cdn.imweb.me | https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Regular.woff2 |

#### 스크립트

| 분류 | 전송량 | 우선순위 | 시작 | 호스트 | URL |
| --- | --- | --- | --- | --- | --- |
| 나중(지연 가능) | 455.9 KB | Medium | 2685ms | sstatic-g.rmcnmv.naver.net | https://sstatic-g.rmcnmv.naver.net/resources/js/naver_web_player_ugc_min.js |

### 5) 서드파티 도메인별 비용(요청 수/전송량/메인스레드 시간)

| 도메인(entity) | 요청 수 | 전송량 | 메인스레드 시간 |
| --- | --- | --- | --- |
| Google Tag Manager | 11 | 1.40 MB | 1.59 s |
| imweb.me | 132 | 17.38 MB | 777 ms |
| channel.io | 9 | 422.7 KB | 503 ms |
| TikTok | 5 | 286.4 KB | 361 ms |
| Vimeo | 25 | 4.29 MB | 263 ms |
| naver.net | 2 | 466.4 KB | 154 ms |
| Facebook | 3 | 128.6 KB | 116 ms |
| Hotjar | 2 | 63.0 KB | 74 ms |
| Kakao | 8 | 34.5 KB | 52 ms |
| pstatic.net | 1 | 18.4 KB | 36 ms |
| datadoghq-browser-agent.com | 1 | 55.6 KB | 31 ms |
| bigin.io | 3 | 78.4 KB | 25 ms |
| Google Analytics | 8 | 27.4 KB | 21 ms |
| kakao.com | 1 | 0.0 KB | 20 ms |
| keepgrow.com | 4 | 28.6 KB | 15 ms |

### 6) (임웹 제약 가정) 당장 가능한 개선 우선순위

1. **히어로(첫 화면) 이미지 최적화**: LCP 후보가 큰 PNG인 경우가 많습니다. 가능하면 **WebP/AVIF**로 교체 + 해상도/압축 재조정.
2. **추적/광고 스크립트 지연**: 3rd-party JS가 렌더를 막는다면 GTM에서 **동의/인터랙션 후 로드**로 변경.
3. **폰트 정리**: 사용 웨이트 수 최소화 + 가능하면 system font + `font-display: swap`.
4. **영상 로딩 방식**: 첫 화면 영상은 poster 이미지로 대체하고 실제 영상은 **사용자 액션 후 로드**.
5. **이미지 Lazy-load 재점검**: 첫 화면 1장(LCP)만 우선 로드, 나머지는 지연.

## DESKTOP 측정

- 측정 시각: 2026-02-13T15:02:02.721Z
- URL: https://biocom.kr
- Performance 점수: 8
- LCP(시뮬레이션): 9.78 s / LCP(관측): 3.44 s
- FCP(시뮬레이션): 3.80 s / FCP(관측): 3.24 s

### 1) LCP 요소(이번 측정)

- 요소 타입: 이미지(background-image)
- selector: `div#visual_s2025031877141ab5e3f0d > div.owl-carousel > div.owl-item > div.item`
- 화면 텍스트(요약): 당신을 가장 잘 아는 바이오컴이 건강을 약속할게요.
- 리소스 URL: https://cdn.imweb.me/thumbnail/20250318/665faed87f058.png
- 전송량(transfer): 1.40 MB / MIME: image/png

### 2) LCP 구간별 분해(TTFB/로딩지연/다운로드/렌더)

| 구간 | 시간 |
| --- | --- |
| TTFB | 161 ms |
| 로딩 지연(요청 시작까지) | 8.61 s |
| 다운로드(요청 duration) | 88 ms |
| 렌더 지연(다운로드 후 paint까지) | 926 ms |

- 가장 큰 병목: **로딩 지연(요청 시작까지)**
- 참고: PSI는 시뮬레이션/관측 값이 함께 있어 LCP가 과대/과소 추정될 수 있습니다.

### 3) FCP를 막는 상위 10개 리소스(CSS/JS) + 낭비 시간(ms)

| # | 타입 | 낭비(추정) | 전송량 | URL |
| --- | --- | --- | --- | --- |
| 1 | CSS | 761 ms | 62.5 KB | https://vendor-cdn.imweb.me/css/site/site2.css?1769595241 |
| 2 | CSS | 681 ms | 51.5 KB | https://vendor-cdn.imweb.me/minify_css/vendor_blue_10.css?1653367465 |
| 3 | CSS | 641 ms | 51.2 KB | https://vendor-cdn.imweb.me/css/site/site.css?1754031372 |
| 4 | CSS | 490 ms | 38.3 KB | https://fonts.googleapis.com/earlyaccess/nanumgothic.css |
| 5 | CSS | 481 ms | 31.3 KB | https://vendor-cdn.imweb.me/minify_css/vendor_red_10.css?1653367465 |
| 6 | JS | 401 ms | 33.3 KB | https://vendor-cdn.imweb.me/js/jquery.js?1627517460 |
| 7 | JS | 376 ms | 19.2 KB | https://t1.daumcdn.net/kas/static/kp.js |
| 8 | JS | 310 ms | 10.5 KB | https://wcs.naver.net/wcslog.js |
| 9 | JS | 281 ms | 8.9 KB | https://player.vimeo.com/api/player.js |
| 10 | CSS | 281 ms | 21.1 KB | https://vendor-cdn.imweb.me/css/tailwind.css?1768193489 |

### 4) 전송량 Top 20 요청(타입별) + “첫 화면” vs “지연” 추천

#### 이미지

| 분류 | 전송량 | 우선순위 | 시작 | 호스트 | URL |
| --- | --- | --- | --- | --- | --- |
| 나중(지연 가능) | 4.39 MB | Low | 3091ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20241230/a58c8ad232141.png |
| 나중(지연 가능) | 2.51 MB | Low | 2930ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20241230/93f7211f50bf9.png |
| 첫 화면 필수(LCP) | 1.40 MB | High | 3079ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250318/665faed87f058.png |
| 나중(지연 가능) | 1.11 MB | Low | 2931ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250114/691da83b674c3.png |
| 나중(지연 가능) | 863.3 KB | Low | 2929ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250117/14055780a0c07.png |
| 나중(지연 가능) | 743.0 KB | Low | 2929ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250117/734e4303a027e.png |
| 나중(지연 가능) | 688.0 KB | Low | 2930ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250117/9388de0a0cc10.png |
| 나중(지연 가능) | 591.6 KB | Low | 2932ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250124/aed3c9951b922.png |
| 나중(지연 가능) | 455.5 KB | Low | 2929ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250117/133b9fa297af8.png |
| 나중(지연 가능) | 421.0 KB | Low | 7315ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20251201/45c6c1da2654a.png |
| 나중(지연 가능) | 328.3 KB | Low | 2932ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20251201/9afbfce20eec4.png |
| 나중(지연 가능) | 321.3 KB | Low | 7315ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20260213/cd53ebb8f219b.jpg |
| 나중(지연 가능) | 311.6 KB | Low | 7315ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20260213/2d9cd47c95ce1.jpg |
| 나중(지연 가능) | 308.7 KB | Low | 2932ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250114/5092361346535.png |
| 나중(지연 가능) | 287.7 KB | Low | 2931ms | cdn.imweb.me | https://cdn.imweb.me/thumbnail/20250117/762e551d21eac.png |

#### 폰트

| 분류 | 전송량 | 우선순위 | 시작 | 호스트 | URL |
| --- | --- | --- | --- | --- | --- |
| 첫 화면 가능성↑ | 807.3 KB | VeryHigh | 3095ms | vendor-cdn.imweb.me | https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Bold.woff2 |
| 첫 화면 가능성↑ | 802.8 KB | VeryHigh | 3095ms | vendor-cdn.imweb.me | https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-SemiBold.woff2 |
| 첫 화면 가능성↑ | 796.2 KB | VeryHigh | 3096ms | vendor-cdn.imweb.me | https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Medium.woff2 |
| 첫 화면 가능성↑ | 786.6 KB | VeryHigh | 3000ms | vendor-cdn.imweb.me | https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Regular.woff2 |

#### 스크립트

| 분류 | 전송량 | 우선순위 | 시작 | 호스트 | URL |
| --- | --- | --- | --- | --- | --- |
| 나중(지연 가능) | 455.9 KB | Medium | 2928ms | sstatic-g.rmcnmv.naver.net | https://sstatic-g.rmcnmv.naver.net/resources/js/naver_web_player_ugc_min.js |

### 5) 서드파티 도메인별 비용(요청 수/전송량/메인스레드 시간)

| 도메인(entity) | 요청 수 | 전송량 | 메인스레드 시간 |
| --- | --- | --- | --- |
| imweb.me | 138 | 22.90 MB | 1.18 s |
| Google Tag Manager | 11 | 1.40 MB | 1.01 s |
| channel.io | 9 | 418.5 KB | 450 ms |
| TikTok | 5 | 282.7 KB | 305 ms |
| Vimeo | 14 | 699.7 KB | 169 ms |
| naver.net | 2 | 466.4 KB | 140 ms |
| Facebook | 3 | 128.6 KB | 98 ms |
| Hotjar | 3 | 65.6 KB | 66 ms |
| Kakao | 8 | 34.5 KB | 51 ms |
| datadoghq-browser-agent.com | 1 | 55.6 KB | 47 ms |
| pstatic.net | 1 | 18.4 KB | 32 ms |
| bigin.io | 3 | 78.4 KB | 24 ms |
| Google Analytics | 8 | 27.4 KB | 20 ms |
| kakao.com | 1 | 0.0 KB | 17 ms |
| YouTube | 2 | 15.8 KB | 7 ms |

### 6) (임웹 제약 가정) 당장 가능한 개선 우선순위

1. **히어로(첫 화면) 이미지 최적화**: LCP 후보가 큰 PNG인 경우가 많습니다. 가능하면 **WebP/AVIF**로 교체 + 해상도/압축 재조정.
2. **추적/광고 스크립트 지연**: 3rd-party JS가 렌더를 막는다면 GTM에서 **동의/인터랙션 후 로드**로 변경.
3. **폰트 정리**: 사용 웨이트 수 최소화 + 가능하면 system font + `font-display: swap`.
4. **영상 로딩 방식**: 첫 화면 영상은 poster 이미지로 대체하고 실제 영상은 **사용자 액션 후 로드**.
5. **이미지 Lazy-load 재점검**: 첫 화면 1장(LCP)만 우선 로드, 나머지는 지연.

