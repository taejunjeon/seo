# 속도와 리소스 진단

작성 시각: 2026-04-27 21:17 KST
기준일: 2026-04-27
Source: Playwright 네트워크 응답 header
Freshness: 2026-04-27 21:17 KST
Confidence: 70%

## 10초 요약

이 보고서는 PageSpeed API 점수가 아니라 공개 페이지 로딩 중 관측된 리소스 수와 header의 content-length 기준이다. content-length가 없는 리소스는 용량 합계에 반영되지 않는다.

## 페이지별 리소스 요약

| 페이지 | 요청 수 | 확인 용량 KB | 이미지 요청 | 스크립트 요청 | 폰트 요청 |
| --- | --- | --- | --- | --- | --- |
| 홈페이지 | 366 | 28520 | 74 | 145 | 11 |
| 서비스 | 257 | 14354 | 60 | 129 | 11 |
| 종합 대사기능 분석 상품 | 327 | 24318 | 97 | 135 | 13 |
| 바이오밸런스 상품 | 327 | 28110 | 94 | 137 | 13 |
| 건강정보 목록 | 248 | 7905 | 47 | 129 | 10 |
| 건강정보 글 | 287 | 5605 | 23 | 172 | 11 |

## 큰 리소스 예시

### 홈페이지
  - image 4491KB https://cdn.imweb.me/thumbnail/20241230/a58c8ad232141.png
  - image 2569KB https://cdn.imweb.me/thumbnail/20241230/93f7211f50bf9.png
  - image 1547KB https://cdn.imweb.me/thumbnail/20260422/7e840e8a0ce2c.png
  - image 1433KB https://cdn.imweb.me/thumbnail/20250318/665faed87f058.png
  - xhr 1215KB https://vod-adaptive-ak.vimeocdn.com/exp=1777296247~acl=%2Fdcb9ea24-12f2-4cce-94e0-91d0068c9f35%2Fpsid%3D8f8701fe258b225f3181b7999da9e6bb24506cb67885a6986203186b285250e5%2F%2A~hmac=94ffa88835b2542eff69cb0925d128c64e91efa2954942b7230721ec3b5f2279/dcb9ea24-12f2-4cce-94e0-91d0068c9f35/psid=8f8701fe258b225f3181b7999da9e6bb24506cb67885a6986203186b285250e5/v2/range/prot/cmFuZ2U9MTAzMTY2NS0yMjc1NjI4/avf/8b4938e2-dc3a-48e6-b305-ed1bf877541c.mp4?pathsig=8c953e4f~7h6-Rl-GdqFb-OYInAs9-6M-Kj4T7taB5jBZPm8LdUI&r=dXMtZWFzdDE%3D&range=1031665-2275628
  - xhr 1007KB https://vod-adaptive-ak.vimeocdn.com/exp=1777296247~acl=%2Fdcb9ea24-12f2-4cce-94e0-91d0068c9f35%2Fpsid%3D8f8701fe258b225f3181b7999da9e6bb24506cb67885a6986203186b285250e5%2F%2A~hmac=94ffa88835b2542eff69cb0925d128c64e91efa2954942b7230721ec3b5f2279/dcb9ea24-12f2-4cce-94e0-91d0068c9f35/psid=8f8701fe258b225f3181b7999da9e6bb24506cb67885a6986203186b285250e5/v2/range/prot/cmFuZ2U9ODcxLTEwMzE2NjQ/avf/8b4938e2-dc3a-48e6-b305-ed1bf877541c.mp4?pathsig=8c953e4f~TbEyOg-xkuaoUsuOruPwaEdFORrCWMHzZppkDkAowG0&r=dXMtZWFzdDE%3D&range=871-1031664
  - xhr 1007KB https://vod-adaptive-ak.vimeocdn.com/exp=1777296248~acl=%2Fdcb9ea24-12f2-4cce-94e0-91d0068c9f35%2Fpsid%3D46138929e17aa78ccde1cfd62b64abc4bba12b8a1cddacca8dd29833757a2fe5%2F%2A~hmac=3ee55face346687ff123f5880d4544d5f0ac88fee5faf2ae7b9dea6972148c90/dcb9ea24-12f2-4cce-94e0-91d0068c9f35/psid=46138929e17aa78ccde1cfd62b64abc4bba12b8a1cddacca8dd29833757a2fe5/v2/range/prot/cmFuZ2U9ODcxLTEwMzE2NjQ/avf/8b4938e2-dc3a-48e6-b305-ed1bf877541c.mp4?pathsig=8c953e4f~TbEyOg-xkuaoUsuOruPwaEdFORrCWMHzZppkDkAowG0&r=dXMtZWFzdDE%3D&range=871-1031664
  - image 882KB https://cdn.imweb.me/thumbnail/20260422/743b50005288e.png

### 서비스
  - image 906KB https://cdn.imweb.me/thumbnail/20250825/251961bc984e2.png
  - font 807KB https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Bold.woff2
  - font 796KB https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Medium.woff2
  - font 786KB https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Regular.woff2
  - image 739KB https://cdn.imweb.me/thumbnail/20250825/141683df3395d.png
  - script 694KB https://vendor-cdn.imweb.me/js/jquery-ui.design.js?1627517437
  - image 665KB https://cdn.imweb.me/thumbnail/20260107/6728799f7b5da.png
  - image 634KB https://cdn.imweb.me/thumbnail/20250825/58a0d593f693d.png

### 종합 대사기능 분석 상품
  - image 3103KB https://cdn.imweb.me/upload/S20190715619285c855898/bf3a1c3d775be.jpg
  - image 3017KB https://cdn.imweb.me/upload/S20190715619285c855898/da68492e1e418.jpg
  - image 1850KB https://cdn.imweb.me/upload/S20190715619285c855898/1f37cf950a39e.jpg
  - image 1354KB https://cdn.imweb.me/upload/S20190715619285c855898/2f7d13466522d.jpg
  - image 1146KB https://cdn-optimized.imweb.me/upload/S20190715619285c855898/20b2774e84212.jpeg
  - image 838KB https://cdn-optimized.imweb.me/upload/S20190715619285c855898/e03deb45c264b.jpeg
  - image 830KB https://cdn-optimized.imweb.me/upload/S20190715619285c855898/964cb0c6ca4cf.jpg
  - font 807KB https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Bold.woff2

### 바이오밸런스 상품
  - image 3415KB https://cdn.imweb.me/upload/S20190715619285c855898/18b0530538b1f.jpg
  - image 2522KB https://cdn.imweb.me/upload/S20190715619285c855898/37f42434ef0cf.jpg
  - image 2123KB https://cdn.imweb.me/upload/S20190715619285c855898/573a6b8163824.jpg
  - image 1765KB https://cdn.imweb.me/upload/S20190715619285c855898/edbca4ca2bba5.jpg
  - image 971KB https://cdn.imweb.me/upload/S20190715619285c855898/bcf8e6af832a8.png
  - font 807KB https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Bold.woff2
  - font 796KB https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Medium.woff2
  - image 795KB https://cdn-optimized.imweb.me/upload/S20190715619285c855898/2a06c1f818671.jpg

### 건강정보 목록
  - font 807KB https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Bold.woff2
  - font 796KB https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Medium.woff2
  - font 786KB https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Regular.woff2
  - script 694KB https://vendor-cdn.imweb.me/js/jquery-ui.design.js?1627517437
  - script 456KB https://sstatic-g.rmcnmv.naver.net/resources/js/naver_web_player_ugc_min.js
  - image 349KB https://cdn.imweb.me/thumbnail/20260413/98bade9faeaeb.jpg
  - script 173KB https://www.googletagmanager.com/gtag/js?id=G-WJFXN5E2Q1&cx=c&gtm=4e64m2h1
  - script 169KB https://www.googletagmanager.com/gtm.js?id=GTM-W2Z6PHN

### 건강정보 글
  - font 807KB https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Bold.woff2
  - font 796KB https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Medium.woff2
  - font 786KB https://vendor-cdn.imweb.me/fonts/pretendard/web/static/woff2/Pretendard-Regular.woff2
  - script 694KB https://vendor-cdn.imweb.me/js/jquery-ui.design.js?1627517437
  - script 456KB https://sstatic-g.rmcnmv.naver.net/resources/js/naver_web_player_ugc_min.js
  - image 248KB https://cdn.imweb.me/upload/S20190715619285c855898/45ca5129e04bb.png
  - script 173KB https://www.googletagmanager.com/gtag/js?id=G-WJFXN5E2Q1&cx=c&gtm=4e64m2
  - script 169KB https://www.googletagmanager.com/gtm.js?id=GTM-W2Z6PHN
