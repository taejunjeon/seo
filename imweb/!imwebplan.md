# AIBIO 아임웹 탈출 및 자체 홈페이지/예약 결제 개발 검토

작성 시각: 2026-04-26 01:20 KST
기준일: 2026-04-26
대상 사이트: AIBIO 센터 우선
보류 사이트: 바이오컴, 더클린커피는 추후 별도 검토
작성 목적: AIBIO 센터 홈페이지를 아임웹에서 단계적으로 탈출시키기 위해, 현재 확인 가능한 기능 인벤토리와 자체 개발 범위, PG사 토스페이먼츠 직접 연동 가능성, NestJS 기반 통합 백엔드 전략을 검토한다.

## 10초 요약

AIBIO는 아임웹 관리자 전체를 복제할 필요가 없다. 자체 개발 1차 목표는 `홈페이지/랜딩`, `입력폼/상담예약`, `리드 원장`, `유입/인기 페이지 통계`, `예약금 또는 체험권 결제`다. 첨부된 관리자/디자인 화면 기준으로 쇼핑몰·배송·정기구독·노코드 빌더는 이번 범위에서 제외한다. 전사 통합까지 염두에 두면 AIBIO 신규 native API는 NestJS skeleton으로 시작하는 편이 맞고, 기존 Express 7020은 당분간 유지한다.

쉽게 말하면, 아임웹이라는 큰 쇼핑몰 관리 도구를 그대로 다시 만드는 일이 아니다. 우리 센터 운영에 실제로 쓰는 접수대, 상담 장부, 방문 기록, 결제 영수증만 먼저 만드는 일이다.

## Phase-Sprint 요약표

우리 기준은 문서화·설계·로컬 구현 기준이다. 운영 기준은 실제 AIBIO 운영 반영 기준이다.

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase0 | [[#Phase0-Sprint1]] | 화면/데이터 기준선 고정 | TJ + Codex | 70% / 0% | [[#Phase0-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | 플랫폼 골격 결정 | TJ + Codex | 20% / 0% | [[#Phase1-Sprint2\|이동]] |
| Phase2 | [[#Phase2-Sprint3]] | 공개 홈페이지/랜딩 자체화 | Codex + Claude Code | 20% / 0% | [[#Phase2-Sprint3\|이동]] |
| Phase3 | [[#Phase3-Sprint4]] | 폼/예약/리드 원장 | Codex | 10% / 0% | [[#Phase3-Sprint4\|이동]] |
| Phase4 | [[#Phase4-Sprint5]] | 통계/성장 도구 최소 구현 | Codex + Claude Code | 10% / 0% | [[#Phase4-Sprint5\|이동]] |
| Phase5 | [[#Phase5-Sprint6]] | 예약금/체험권 Toss 결제 | TJ + Codex | 10% / 0% | [[#Phase5-Sprint6\|이동]] |
| Phase6 | [[#Phase6-Sprint7]] | 운영 관리자/RBAC | Codex + Claude Code | 대기 | [[#Phase6-Sprint7\|이동]] |
| Phase7 | [[#Phase7-Sprint8]] | 아임웹 종료 판단 | TJ + Codex | 대기 | [[#Phase7-Sprint8\|이동]] |

## 1. 결론

가능하다. 단, 이번 계획의 범위는 `AIBIO 센터 홈페이지`로 제한한다. 바이오컴과 더클린커피는 상품/주문/배송/정기구독 복잡도가 높으므로 추후 별도 검토한다.

권장 방향은 다음이다.

1. AIBIO 홈페이지/랜딩/SEO/트래킹은 자체 개발로 먼저 탈출한다.
2. 입력폼/상담예약/방문예약/리드 품질 장부를 자체 원장으로 만든다.
3. 결제는 예약금 또는 체험권 1개부터 토스페이먼츠 결제위젯/결제창으로 직접 붙일 수 있다.
4. 전체 쇼핑몰, 배송, 정기구독은 이번 범위에서 제외한다.
5. 초기 1~3개월은 아임웹 입력폼과 기존 운영 흐름을 fallback으로 유지한다.

즉, `AIBIO 센터 홈페이지 탈출`은 바로 추진 가능하고, `전사 커머스 완전 탈출`은 별도 단계 프로젝트로 봐야 한다.

## 2. 현재 상태 요약

### 2-1. 운영 사이트

| 사이트 | 성격 | 이번 계획 처리 |
|---|---|---|
| AIBIO 센터 | 센터 홈페이지/리드/상담예약/방문 전환 | 이번 문서의 실제 대상 |
| 바이오컴 | 건강기능식품/검사권/상담 연계 커머스 | 추후 별도 검토 |
| 더클린커피 | 커피 주문/재구매/정기구독 성격 | 추후 별도 검토 |

### 2-2. 현재 저장소에 이미 있는 자산

| 자산 | 현재 상태 | 의미 |
|---|---|---|
| Next.js 프론트 | `frontend/`, 포트 7010 | 자체 홈페이지/상품/결제 화면을 만들 수 있음 |
| Express 백엔드 | `backend/`, 포트 7020 | 결제 승인, 주문 생성, CRM, webhook 처리 가능 |
| 아임웹 회원/주문/쿠폰 sync | `backend/src/routes/crmLocal.ts`, `imwebapi.md` | 기존 아임웹 데이터를 마이그레이션/대조할 수 있음 |
| Toss 거래/정산 조회 | `backend/src/routes/toss.ts`, `tossapi.md` | 결제 truth와 PG 수수료 확인 경로 있음 |
| Toss store 분기 | `backend/src/tossConfig.ts` | 멀티 스토어 구조 참고 가능, AIBIO Toss 키는 별도 추가 필요 |
| CRM/광고 귀속 | `/crm`, attribution, Meta CAPI, GA4 | 자체 사이트가 되면 전환 추적 품질이 좋아짐 |

현재 코드는 `이미 결제된 Toss 데이터를 조회/정산/대조하는 기능`은 갖고 있다. 하지만 AIBIO 자체 checkout에서 Toss 결제를 요청하고 승인하는 기능은 별도 구현해야 한다.

### 2-3. AIBIO 기능 인벤토리 v0.1

아래 인벤토리는 로컬 문서와 현재 코드에서 확인 가능한 범위다. 라이브 아임웹 관리자 전체 메뉴, 모든 페이지 목록, 실제 폼 CSV export는 아직 직접 받지 않았으므로 `초안`으로 본다.

#### 사이트/도메인/운영 성격

| 항목 | 현재 확인값 | Source | Confidence |
|---|---|---|---|
| 대표 도메인 | `https://aibio.ai` | `aibio/아임웹폼제출API검토.md`, `aibio/채널톡퍼널.md` | 높음 |
| 과거/보조 표기 | `aibio.kr` 표기가 일부 코드에 남아 있음 | `frontend/src/app/ads/landing/page.tsx` | 낮음, 정본 재확인 필요 |
| 플랫폼 | 아임웹 | `aibio/aibio.md` | 높음 |
| 서비스 성격 | 강서구 마곡 바이오해킹/리커버리랩 센터, 오프라인 리드 사업 | `aibio/aibio.md`, `aibio/!aibioroadmap.md` | 중간 |
| 현재 운영 | 쇼핑몰 비노출, 입력폼/상담 접수 중심 | `aibio/aibio.md` | 중간 |
| 주 KPI | 폼 제출 -> 상담 연결 -> 방문 예약 -> 방문 -> 결제 | `aibio/!aibioroadmap.md`, `frontend/src/app/aibio-funnel/page.tsx` | 높음 |

#### 현재 확인된 페이지/랜딩

| URL/경로 | 역할 | 현재 판단 | Source | Confidence |
|---|---|---|---|---|
| `/` | 메인 홈페이지/랜딩 | Pixel/GTM/채널톡/폼 제출 추적 대상 | `aibio/채널톡퍼널.md` | 높음 |
| `/59` | 폼/이벤트 랜딩 후보 | v8.1 폼 제출 테스트 확인 페이지 | `aibio/아임웹폼제출API검토.md` | 높음 |
| `/shop_view?idx=25` | 리커버리랩 이벤트/체험권/패키지 성격 랜딩 | 최근 내부 폼 제출의 주 랜딩으로 기록됨 | `frontend/src/app/aibio-funnel/page.tsx` | 높음 |
| 네이버 플레이스/예약 외부 URL | 일부 광고 소재 랜딩 후보 | Meta/GTM 삽입 불가라 전환 계측에 불리함 | `frontend/src/app/ads/page.tsx` | 중간 |

자체 개발 시 우선 복제할 IA:

1. 홈/브랜드 소개
2. 리커버리랩 프로그램 소개
3. 이벤트/체험권 랜딩
4. 상담예약/방문예약 폼
5. 위치/오시는 길
6. FAQ
7. 후기/전후 사례는 의료·건강 표현 검수 후 적용
8. 결제형 예약금 또는 체험권 checkout

#### 폼/리드 수집

| 항목 | 현재 확인값 | Source | Confidence |
|---|---|---|---|
| 아임웹 입력폼 이름 | `다이어트 페이지 DB` | `aibio/아임웹폼제출API검토.md` | 중간, 관리자 캡처 기준 |
| 관리자 응답 수 | 104 | `aibio/아임웹폼제출API검토.md` | 중간, 캡처 시점 기준 |
| 목록 필드 | 이름, 연락처, 나이, 알게 된 경로, 작성자, IP, 댓글, 작성시각 | `aibio/아임웹폼제출API검토.md` | 중간 |
| 상세 필드 | 이름, 연락처, 나이, 상담 목적, 알게 된 경로, 상담 신청 유형 | `aibio/아임웹폼제출API검토.md` | 중간 |
| 일반 입력폼 API | 공식 API 기준 직접 조회 endpoint 미확인 | `aibio/아임웹폼제출API검토.md` | 높음 |
| 현재 자체 수집 방식 | 아임웹 폼 제출 성공 감지 -> `/api/attribution/form-submit` | `aibio/imwebcode_aibio_latest.md` | 높음 |
| 개인정보 정책 | 이름/전화번호 원문은 광고 플랫폼으로 보내지 않음, 내부는 hash 중심 | `aibio/아임웹폼제출API검토.md` | 높음 |

자체 개발 시 폼 필드 초안:

| 필드 | 필수 | 저장 위치 | 광고 전송 |
|---|---|---|---|
| 이름 | 필수 | 내부 lead DB, 암호화 또는 접근 제한 | 금지 |
| 전화번호 | 필수 | 내부 DB 원문 또는 암호화 + `phone_hash_sha256` | 원문 금지, 필요 시 CAPI 해시만 |
| 나이대 | 선택/필수 검토 | 내부 lead quality | bucket만 가능 |
| 상담 목적 | 필수 | 내부 lead quality | 건강 민감 항목이므로 원문 광고 전송 금지 |
| 알게 된 경로 | 선택 | 내부 분석 | broad bucket만 가능 |
| 상담 신청 유형 | 필수 | 상담 운영 | broad bucket만 가능 |
| 개인정보/마케팅 동의 | 필수 | consent log | 전송하지 않음 |
| UTM/fbclid/fbc/fbp/client_id | 자동 | attribution ledger | 허용 범위 내 전환 매칭 |

#### CTA/상담 채널

| 채널/CTA | 현재 상태 | 자체 개발 시 처리 |
|---|---|---|
| 아임웹 입력폼 제출 | 현재 핵심 Lead | 자체 폼으로 이관하되 아임웹 fallback 유지 |
| 채널톡 열기 | `aibio_channeltalk_open` 이벤트 수신 확인, Lead는 아님 | 상담 의도/리타겟팅 신호로 유지 |
| 카카오톡 클릭 | GTM 마이크로 이벤트 후보/운영 기록 존재 | 즉시 상담 CTA로 유지 |
| 전화 클릭 | 문서상 목표에는 있으나 구현 세부 확인 부족 | 모바일 고정 CTA로 추가 검토 |
| 네이버 예약 | 외부 플랫폼이라 픽셀/GTM 제약 | 가능하면 자체 예약 폼으로 흡수 |
| 체험권/예약금 결제 | `aibio_ticket_checkout` 이벤트 후보 | Toss 단일 checkout으로 MVP 구현 후보 |

#### 계측/광고 자산

| 항목 | 현재 확인값 | Source | Confidence |
|---|---|---|---|
| GA4 Measurement ID | `G-PQWB91F4VQ` | `aibio/imwebcode_aibio_latest.md`, `aibio/aibio.md` | 높음 |
| GTM 정본 후보 | `GTM-T8FLZNT` | `aibio/gtm.md`, `aibio/채널톡퍼널.md`, 최신 삽입 코드 | 높음 |
| 과거 GTM 후보 | `GTM-NM988QL` | `aibio/aibio.md` | 낮음, 과거 문서로 분리 |
| Meta Pixel ID 정본 후보 | `1068377347547682` | `aibio/gtm.md`, `aibio/채널톡퍼널.md`, `frontend/src/app/aibio-funnel/page.tsx` | 높음 |
| 과거 Pixel 오기 후보 | `1068377547682` | `aibio/aibio.md` | 낮음, 오기/과거값 후보 |
| Meta 광고 계정 | `act_377604674894011` | `aibio/!aibioroadmap.md`, `frontend/src/app/aibio-funnel/page.tsx` | 높음 |
| Google Ads 전환 ID | `AW-10976547519` | `aibio/imwebcode_aibio_latest.md`, `aibio/aibio.md` | 높음 |
| Naver WCS | `b0e4d2f69a88f8` | `aibio/imwebcode_aibio_latest.md` | 중간 |
| Beusable RUM | `b230307e145743u179` | `aibio/imwebcode_aibio_latest.md` | 중간 |

현재 이벤트 인벤토리:

| 이벤트 | 의미 | 현재 상태 | 자체 사이트 처리 |
|---|---|---|---|
| `PageView` | 페이지 조회 | Meta Pixel 직접 삽입 | 유지, 중복 제거 필요 |
| `aibio_form_submit` | 아임웹 폼 제출 성공 | 내부 원장/GTM/GA4/Meta Lead 연결 | 자체 폼 submit 서버 이벤트로 승격 |
| `generate_lead` | GA4 리드 | GTM에서 발화 | 유지 |
| `Lead` | Meta 표준 리드 | GTM에서 발화 | CAPI mirror 후보 |
| `aibio_kakao_click` | 카카오 상담 클릭 | GTM 마이크로 이벤트 | 유지 |
| `aibio_channeltalk_open` | 채널톡 열기 | Events Manager 수신 확인 | 리타겟팅/의도 신호로 유지 |
| `aibio_ticket_checkout` | 체험권/결제 의도 | GTM 후보 | Toss checkout 시작 이벤트로 연결 |
| `aibio_engaged_60s` | 60초 체류 | GTM 게시 | 유지 |
| `aibio_scroll_90` | 90% 스크롤 | GTM 게시 | 유지 |

#### AIBIO CRM/Supabase 원장

| 테이블/영역 | 확인 건수 | 목적 | Source | Confidence |
|---|---:|---|---|---|
| `customers` | 1,074 | 고객/phone 조인 키 | `aibio/aibio_sync_design.md` | 중간 |
| `payments` | 1,018 | 결제/매출 | `aibio/aibio_sync_design.md` | 중간 |
| `packages` | 43 | 패키지/프로그램 | `aibio/aibio_sync_design.md` | 중간 |
| `products` | 42 | 상품/서비스 카탈로그 | `aibio/aibio_sync_design.md` | 중간 |
| `product_usage` | 11,092 | 실제 이용/방문 리텐션 | `aibio/aibio_sync_design.md` | 중간 |
| `reservations` | 356 | 예약 | `aibio/aibio_sync_design.md` | 중간 |
| `marketing_leads` | 465 | 리드->전환 퍼널 | `aibio/aibio_sync_design.md` | 중간 |
| `payment_details` | 14 | 구매 유형 보조 | `aibio/aibio_sync_design.md` | 낮음~중간 |

현재 백엔드에는 `POST /api/aibio/sync-customers`, `/sync-payments`, `/sync-all`, `GET /api/aibio/stats`가 있다. 즉 AIBIO 센터 데이터는 이미 기존 SEO/CRM 로컬 DB로 일부 흡수하는 흐름이 시작되어 있다.

#### 광고/방문/결제 스냅샷

| 지표 | 값 | Source | 기준/주의 |
|---|---:|---|---|
| 최근 30일 Meta 광고비 | 2,667,987원 | `frontend/src/app/aibio-funnel/page.tsx` snapshot | 2026-03-26~2026-04-24 snapshot |
| 최근 30일 Meta Lead | 13건 | 동일 | 캠페인 attribution 기준 |
| 최근 30일 운영 폼 제출 | 34건 | 동일 | VM attribution 원장, 테스트 13건 제외 |
| Meta/Instagram 제출 | 31건 | 동일 | 운영 폼의 91.2% |
| CRM 첫 방문일 기록 | 13명 | 동일 | 동기간 first_visit_date 기준 |
| 결제 고객 | 2명 | 동일 | 동기간 결제 고객, 환불 제외 |
| 결제 매출 | 1,874,300원 | 동일 | local CRM payment_date 기준 |
| 별도 센터 대시보드 방문 | 222명 | 동일 | Supabase 직접 조인 전까지 중간 신뢰 |
| 별도 센터 대시보드 결제 고객 | 6명 | 동일 | 화면 기준, 정의 재확인 필요 |
| 별도 센터 대시보드 매출 | 2,016,000원 | 동일 | `aibio_revenue_reconciliation.md`에서 불일치 이슈 기록 |

위 숫자는 의사결정용 기준선이 아니라, 자체 홈페이지 이관 시 어떤 데이터를 반드시 보존해야 하는지 보여주는 inventory다. 실제 KPI 확정 전에는 AIBIO Supabase, VM attribution ledger, Meta API를 같은 window로 재조회해야 한다.

### 2-4. 첨부 관리자/디자인 화면 반영

상세 판독 메모는 `imweb/aibio-admin-screenshots.md`에 저장했다. 원본 이미지 바이너리는 현재 로컬 파일시스템에 자동 저장되지 않았으므로, 대화 첨부 화면에서 읽은 내용을 개인정보 없이 정리했다.

첨부 화면 기준으로 확인한 핵심은 아래다.

| 영역 | 확인 내용 | 자체 개발 판단 |
|---|---|---|
| 대시보드 | 기본설정, 판매하기, 성장하기, 추천작업, 오늘의 할 일, 방문자 통계, 콘텐츠 반응이 있음 | 전체 대시보드 복제보다 리드/예약/결제/유입 요약만 필요 |
| 콘텐츠 반응 | 상품 구매평/상품 문의는 비어 있고, 입력폼 참여 기록이 보임 | 상품 리뷰/문의보다 입력폼 응답 관리가 우선 |
| 매출 상승 도구 | A/B 테스트, 소셜러, 최근 본 상품, 카카오 채널, 구매 추천, 무료배송 안내가 있음 | A/B 테스트와 카카오 CTA만 선별 적용. 추천/무료배송은 제외 |
| 통계 | 인기 페이지, 유입 사이트, 방문자 그래프가 있음 | GA4/서버 이벤트로 인기 페이지와 유입 도메인만 먼저 대체 |
| 인기 페이지 | `/shop_view`, `/main`, `/bio_pulse_M`, `/56`, `/59`가 주요 페이지로 보임 | 자체 사이트 라우팅/301 redirect의 우선 후보 |
| 유입 | Instagram, Facebook, Direct, Naver, Google, Threads, Naver Place, Kakao Auth가 보임 | 광고/소셜/검색/네이버 플레이스 유입 보존 필요 |
| 쿠폰 | `첫방문 AIBIKE 1회 무료` 성격의 혜택이 1개 보임 | 전체 쿠폰 엔진 대신 첫방문 혜택/오퍼 코드만 구현 |
| 고객 | 전체 사용자 156명, 그룹과 운영자 권한이 보임 | 회원몰보다 리드 그룹/RBAC가 중요. 개인정보 원문은 문서에 저장하지 않음 |
| 디자인 모드 | YouTube/카카오 CTA, 로그인/회원가입/장바구니, 프로그램 메뉴, hero 섹션 확인 | IA와 섹션 컴포넌트만 구현. 노코드 빌더는 제외 |
| 위젯/섹션 | 이미지, 텍스트, 버튼, 지도, 코드, 입력폼, 예약, 쇼핑 등 위젯이 있음 | 필요한 React 컴포넌트만 직접 구현 |

## 3. 아임웹 기능 복제 범위

### 3-1. 바로 복제 가능한 기능

| 기능 | 자체 개발 가능성 | 설명 |
|---|---|---|
| 브랜드 홈페이지 | 높음 | Next.js로 정적/동적 페이지 구성 가능 |
| 랜딩페이지 | 높음 | 광고별/키워드별 랜딩, A/B 테스트 가능 |
| SEO 메타/OG/schema | 높음 | 아임웹보다 세밀하게 제어 가능 |
| 상담/문의 폼 | 높음 | DB 저장, 알림톡, CRM 후보군 연결 가능 |
| 상담예약/방문예약 | 높음 | AIBIO에 특히 적합 |
| 이벤트/프로모션 페이지 | 높음 | CRM/광고 귀속과 직접 연결 가능 |
| 블로그/칼럼 CMS | 중간 | 간단 CMS 또는 MDX/관리자 필요 |
| 프로그램/체험권 상세 페이지 | 높음 | 직접 구성 가능 |
| 예약금/체험권 단일 결제 | 높음 | Toss 결제위젯으로 구현 가능 |
| 결제완료 트래킹 | 높음 | GA4/CAPI/attribution ledger에 직접 기록 가능 |

### 3-2. 단계적으로 복제 가능한 기능

| 기능 | 난이도 | 이유 |
|---|---:|---|
| 체험권/패키지 카탈로그 | 중간 | 프로그램별 가격/옵션/노출 정책 모델링 필요 |
| 장바구니/복수 상품 구매 | 중간 | AIBIO MVP에는 불필요하나 추후 패키지 판매 시 검토 |
| 회원가입/로그인 | 중간 | 카카오/네이버 소셜 로그인, 동의, 탈퇴 처리 필요 |
| 결제 관리자 | 중간~높음 | 결제/취소/환불/메모/상담 이력까지 필요 |
| 쿠폰/포인트 | 중간~높음 | AIBIO MVP에는 불필요, 정책 예외가 많고 회계/CRM 영향 큼 |
| 리뷰/Q&A | 중간 | 운영 UI와 신고/노출 정책 필요 |

### 3-3. 초기에는 복제하지 말아야 할 기능

| 기능 | 판단 |
|---|---|
| 노코드 디자인 빌더 | 만들 필요 없음. 우리는 내부 운영 사이트를 만들면 됨 |
| 범용 템플릿/앱스토어 | 불필요 |
| 아임웹 수준의 전체 쇼핑몰 관리자 | 초기 범위 과대 |
| 배송/송장/택배사 연동 | AIBIO 센터 홈페이지 MVP와 무관 |
| 교환/반품 | 물류형 커머스 범위라 제외 |
| 정기구독 | 빌링키, 결제 실패 재시도, 해지/일시정지, 회차 관리가 필요해 제외 |
| 다국어/글로벌 판매 전체 | 추후 필요 시 별도 |
| 모든 PG/간편결제 동시 지원 | 우선 Toss 중심으로 시작 |
| 복잡한 포인트/등급 정책 전체 복제 | 현재는 리드/예약/메시지 실험이 먼저 |

## 4. 토스페이먼츠 PG 연동 가능 여부

### 4-1. 답

붙일 수 있다.

공식 문서 기준 토스페이먼츠는 결제위젯 SDK와 Payment API를 제공한다. 결제 흐름은 대략 다음 구조다.

```text
고객 checkout
  -> Toss Payments 결제위젯/결제창 호출
  -> successUrl로 paymentKey/orderId/amount 수신
  -> 자체 백엔드가 금액/주문 검증
  -> POST /v1/payments/confirm 호출
  -> Payment 객체 저장
  -> 주문 confirmed 처리
  -> GA4/CAPI/CRM attribution 기록
```

필수 조건:

- AIBIO용 Toss 계약/MID/API 키가 있어야 한다.
- 브라우저에는 client key만 노출한다.
- secret key는 서버에서만 사용한다.
- 결제 승인 전 주문 금액과 successUrl의 amount를 반드시 대조한다.
- 승인/취소/가상계좌 상태는 webhook 또는 조회 API로 후속 검증한다.

### 4-2. 현재 코드와의 차이

| 영역 | 현재 구현 | 자체 결제에 추가 필요 |
|---|---|---|
| Toss 거래 조회 | 있음: `/api/toss/transactions` | 유지 |
| Toss 정산 조회 | 있음: `/api/toss/settlements` | 유지 |
| orderId 결제 조회 | 있음: `/api/toss/payments/orders/:orderId` | 유지 |
| 결제 요청 UI | 없음 | `@tosspayments/tosspayments-sdk` 또는 JS SDK 연동 |
| 결제 승인 API | 조회 문서에는 정리돼 있으나 라우트 없음 | `POST /api/payments/toss/confirm` 필요 |
| 결제 webhook | 없음 | `POST /api/payments/toss/webhook` 필요 |
| 자체 결제 테이블 | 일부 로컬 캐시 중심 | `orders`, `order_items`, `payments`, `payment_events` 필요 |
| 환불/부분취소 운영 UI | 일부 환불 감지/광고 전송 있음 | 결제 관리자와 연결 필요 |

### 4-3. AIBIO Toss 전략

| 범위 | 추천 방식 | 비고 |
|---|---|---|
| MVP | 예약금 또는 체험권 단일 결제 | 홈페이지 탈출과 같이 바로 붙이기 좋음 |
| 2차 | 프로그램별 체험권/패키지 2~3개 | 옵션/재고/배송 없이 단순 결제만 |
| 제외 | 전체 쇼핑몰/배송/정기구독 | AIBIO 홈페이지 자체화 목적과 다름 |

AIBIO는 오프라인 센터 리드 사업이므로 처음부터 쇼핑몰 기능을 복제할 이유가 약하다. 예약금/체험권 결제 성공률, 환불/취소, 광고 귀속, 상담 전환까지 닫히는지 먼저 검증한다.

## 5. 자체 개발 권장 아키텍처

```text
Next.js 자체 사이트
  ├─ 브랜드/프로그램/위치/콘텐츠 페이지
  ├─ 상담예약/방문예약
  ├─ 예약금/체험권 checkout
  ├─ payment success/fail
  └─ GA4/Meta/TikTok/CRM 이벤트

Backend API
  ├─ lead/reservation/visit API
  ├─ ticket/order API
  ├─ Toss confirm/cancel/webhook API
  ├─ customer/consent API
  ├─ CRM segment/message API
  ├─ attribution ledger API
  └─ admin API

DB
  ├─ members/identities/consents
  ├─ leads/reservations/visits
  ├─ tickets/orders/order_items
  ├─ payments/payment_events/refunds
  └─ crm_campaigns/segments

외부
  ├─ Toss Payments
  ├─ Aligo/ChannelTalk/Kakao
  ├─ GA4/Meta CAPI/TikTok
  └─ 기존 아임웹 API read-only bridge
```

### 5-1. NestJS 적용 검토

개발팀 의견은 방향이 맞다. 전사 프로그램을 목표로 한다면 `서비스별 Next.js + 독립 DB + 독립 인증`을 늘리는 방식은 피해야 한다. 인증, 사용자, 권한, API 규격, UI shell을 처음부터 공유하지 않으면 나중에 합치는 비용이 커진다.

다만 현재 SEO 저장소는 핵심 API를 Next.js API Routes에 흩뿌린 구조가 아니라 이미 `Express API 7020`에 모아 둔 상태다. 그래서 문제는 `Next.js API Routes vs NestJS`라기보다, `현재 Express 라우터를 계속 키울지, AIBIO 자체화 시점부터 NestJS 모듈형 백엔드로 갈지`다.

#### 판단

| 선택지 | 판단 | 이유 |
|---|---|---|
| 기존 Express 유지 | AIBIO 빠른 MVP에는 가장 빠름 | 이미 routes/services/env/local DB 패턴이 있고, 현재 대시보드가 붙어 있음 |
| Next.js API Routes 중심 | 비권장 | 결제/webhook/RBAC/운영 API가 커지면 권한 체크와 공통 정책이 분산되기 쉬움 |
| NestJS 신규 백엔드 | 전사 통합 플랫폼이면 권장 | 모듈, Guard, Decorator, DI, OpenAPI, 테스트 구조가 장기 운영에 유리 |
| 즉시 전체 Express -> NestJS 마이그레이션 | 비권장 | 범위가 크고 현재 운영 기능을 건드릴 위험이 큼 |

권장안:

```text
하나의 프론트엔드 (Next.js)
  ├─ AIBIO 공개 홈페이지
  ├─ AIBIO 예약/결제 페이지
  ├─ 운영 CRM/Admin shell
  └─ 추후 바이오컴/커피 모듈

하나의 백엔드 (NestJS, 신규 native API)
  ├─ AuthModule       # JWT/SSO/session
  ├─ UsersModule      # 사용자/조직/사이트 권한
  ├─ RbacModule       # @Roles, @SiteAccess, global guard
  ├─ AibioModule      # lead/reservation/visit/payment
  ├─ PaymentsModule   # Toss confirm/webhook/cancel/reconcile
  ├─ AttributionModule# UTM/fbclid/fbc/fbp/GA client id
  ├─ IntegrationsModule # Meta/GA4/ChannelTalk/Aligo
  └─ AuditModule      # 감사로그/PII 접근 로그

기존 Express 7020
  └─ 당분간 SEO dashboard, 기존 CRM, 기존 sync API 유지
```

이렇게 하면 AIBIO 신규 자체화는 NestJS로 시작하면서, 기존 Express 기능을 한 번에 갈아엎지 않아도 된다.

#### NestJS가 맞는 이유

| 요구 | NestJS 적합성 |
|---|---|
| 전사 통합 인증 | `AuthGuard`를 global guard로 등록하고 `@Public()`만 예외 처리 가능 |
| RBAC | `@Roles('admin', 'manager')` 같은 decorator + guard 구조가 자연스러움 |
| 사이트별 권한 | `@SiteAccess('aibio')` 같은 custom decorator 설계 가능 |
| 결제/webhook | controller/service/module 분리가 명확하고 테스트하기 좋음 |
| OpenAPI | `@nestjs/swagger`로 운영팀/프론트 API 계약 관리 가능 |
| 도메인 모듈화 | AIBIO, Payments, CRM, Attribution을 모듈 단위로 분리 가능 |
| 테스트 | provider 단위 unit test와 controller e2e test 구조가 안정적 |

#### 주의할 점

NestJS를 쓴다고 자동으로 통합 플랫폼이 되는 것은 아니다. 반드시 아래 규칙을 같이 정해야 한다.

- 단일 사용자/조직/역할 모델
- 단일 site key: `aibio`, 추후 `biocom`, `thecleancoffee`
- 단일 audit log
- 단일 API 에러 포맷
- 단일 OpenAPI spec
- 단일 디자인 시스템과 admin layout
- 프론트에서는 business-critical mutation을 Next.js API Route로 만들지 않기
- 공개 페이지 렌더링은 Next.js, 권한/결제/원장 쓰기는 NestJS

#### AIBIO MVP 기준 결정

| 조건 | 선택 |
|---|---|
| 2~4주 안에 랜딩/폼/계측만 자체화 | 기존 Express API 사용 가능 |
| 예약금/체험권 Toss 결제까지 자체화 | NestJS `PaymentsModule`로 시작 권장 |
| 운영자 로그인/RBAC/Admin까지 포함 | NestJS 권장 |
| 전사 프로그램의 첫 서비스로 삼음 | NestJS 강력 권장 |

현재 요청의 목적이 `아임웹 탈출 + 전사 통합 가능성`이라면, AIBIO부터 NestJS 신규 백엔드 skeleton을 만드는 편이 장기적으로 맞다. 단, 기존 SEO Express를 즉시 제거하지 않고 병행한다.

## 6. 개발 Phase

아래 Phase는 첨부된 아임웹 관리자/디자인 화면을 기준으로 다시 정한 순서다. 핵심은 `작게 탈출하고, 운영 누락을 막고, 나중에 전사 통합이 가능하게 만드는 것`이다.

### Phase0-Sprint1

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 화면/데이터 기준선 고정
**목표**: 아임웹에서 실제로 쓰는 기능과 안 쓰는 기능을 분리한다.
**왜 지금 해야 하는가**: 기준선 없이 개발하면 아임웹 관리자 전체를 복제하는 방향으로 새기 쉽다.
**산출물**: 화면 판독 메모, 페이지/폼/CTA/유입/쿠폰/고객 그룹 inventory, 제외 기능 목록
**완료 기준**: AIBIO 주요 URL, 입력폼, CTA, 유입 도메인, 인기 페이지, 쿠폰/오퍼, 고객 그룹이 source와 confidence를 가진다.

#### 역할 구분

- TJ: 아임웹 관리자 export, 입력폼 CSV, 실제 URL/CTA 정본 제공 — 2FA 로그인 필요
- Codex: 첨부 화면 판독, 로컬 문서/코드와 대조, inventory 문서화
- Claude Code: 해당 없음

#### 실행 단계

1. [x] [Codex] 첨부 화면 Image #1~#10 판독 메모 작성 — `imweb/aibio-admin-screenshots.md`
2. [Codex] 기존 로컬 문서와 route 후보 대조 — `/shop_view`, `/main`, `/bio_pulse_M`, `/56`, `/59`
3. [TJ] 아임웹 입력폼 CSV와 페이지 목록 export 제공 — 2FA 필요. 의존성: 부분병렬
4. [Codex] CSV 수령 후 개인정보 제거 기준과 리드 필드 정본 확정

**다음 Phase에 주는 가치**: 자체 홈페이지가 어떤 페이지와 폼부터 가져와야 하는지 확정된다.

### Phase1-Sprint2

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 플랫폼 골격 결정
**목표**: AIBIO 신규 기능을 기존 Express에 붙일지, NestJS 신규 backend로 시작할지 결정한다.
**왜 지금 해야 하는가**: 폼/결제/운영자 권한을 만든 뒤 백엔드를 바꾸면 다시 만드는 비용이 커진다.
**산출물**: Next.js 공개 사이트, NestJS native API skeleton 여부 결정, 인증/RBAC/API 에러 포맷 초안
**완료 기준**: `site=aibio`, 사용자/역할, lead/reservation/payment API 경계가 문서와 코드 구조에서 일치한다.

#### 역할 구분

- TJ: 전사 통합 플랫폼으로 볼지, AIBIO 단독 MVP로 볼지 승인
- Codex: NestJS vs Express 적용안, 모듈 경계, API 계약, 테스트 구조 설계
- Claude Code: admin shell과 공개 사이트 UI 구조 검토

#### 실행 단계

1. [Codex] NestJS skeleton 초안 작성 — `AuthModule`, `UsersModule`, `RbacModule`, `AibioModule`, `PaymentsModule`, `AttributionModule`
2. [Codex] 기존 Express 7020 유지 범위와 신규 NestJS 담당 범위 분리
3. [TJ] `AIBIO부터 전사 플랫폼의 첫 모듈로 시작` 여부 승인
4. [Codex] 승인 결과에 따라 API path와 환경변수 이름 확정. 의존성: 선행필수

**다음 Phase에 주는 가치**: 공개 홈페이지와 폼 API가 나중에 권한/결제/CRM과 충돌하지 않는다.

### Phase2-Sprint3

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 공개 홈페이지/랜딩 자체화
**목표**: 아임웹 디자인 모드에서 실제로 쓰는 공개 페이지와 랜딩을 Next.js로 만든다.
**왜 지금 해야 하는가**: AIBIO는 쇼핑몰보다 유입과 상담예약이 먼저다. 홈페이지를 먼저 빼야 광고/SEO/속도/전환을 직접 제어할 수 있다.
**산출물**: 홈, 프로그램, 후기/사례, 기기 설명, 바이오해킹 소개, 위치, FAQ, 이벤트/체험권 랜딩
**완료 기준**: 모바일/PC에서 hero, 메뉴, CTA, 지도, 폼 진입이 깨지지 않고 Playwright screenshot으로 확인된다.

#### 역할 구분

- TJ: 문구/이미지 사용 가능 범위, 의료·건강 표현 승인
- Codex: Next.js 구현, 라우팅, SEO, analytics hook, Playwright 검증
- Claude Code: 시각적 톤, 섹션 구성, UX 문구 리뷰

#### 실행 단계

1. [Codex] 현재 메뉴 IA 반영 — `대사&붓기케어`, `대사&식욕조절`, `변화 후기`, `기기 설명`, `바이오해킹이란?`
2. [Codex] 아임웹 인기 페이지 기준 route/redirect 초안 작성 — `/shop_view`, `/main`, `/bio_pulse_M`, `/56`, `/59`
3. [Claude Code] hero/section 디자인 후보 리뷰. 의존성: 병렬가능
4. [TJ] before/after 이미지와 후기 표현 사용 승인 — 의료·건강 표현 리스크
5. [Codex] Playwright PC/mobile screenshot 검증. 의존성: 부분병렬

**다음 Phase에 주는 가치**: 광고 랜딩과 상담 CTA를 자체 폼/원장에 연결할 수 있다.

### Phase3-Sprint4

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 폼/예약/리드 원장
**목표**: 아임웹 입력폼 의존을 줄이고, 폼 제출 이후 상담/방문/결제까지 한 기록 장부로 본다.
**왜 지금 해야 하는가**: 현재 콘텐츠 반응 화면에서 실제로 보이는 핵심 데이터는 상품 문의가 아니라 입력폼 참여다.
**산출물**: 자체 lead form, consent log, UTM/fbclid/fbc/fbp 저장, 상담 상태, 예약 상태, fallback 대조표
**완료 기준**: 자체 폼과 아임웹 폼을 30일 병행해 누락/중복률을 계산할 수 있다.

#### 역할 구분

- TJ: 폼 필드 정본과 상담 상태 정의 승인
- Codex: lead/reservation API, attribution join, 개인정보 저장 정책, 중복 제거 로직
- Claude Code: 폼 UX, 모바일 CTA, 운영자 입력 화면

#### 실행 단계

1. [Codex] lead schema 초안 확정 — 이름, 전화번호, 나이대, 상담 목적, 유입 경로, 동의, UTM
2. [Codex] phone hash 기반 attribution join 구현
3. [Claude Code] 모바일 고정 CTA와 폼 화면 구성. 의존성: 병렬가능
4. [TJ] 실제 상담원이 쓰는 상태값 승인
5. [Codex] 자체 폼과 아임웹 fallback 누락/중복 대시보드 구현. 의존성: 부분병렬

**다음 Phase에 주는 가치**: 방문/결제 전환 품질을 광고비와 연결할 수 있다.

### Phase4-Sprint5

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 통계/성장 도구 최소 구현
**목표**: 아임웹 통계와 매출 상승 도구 중 AIBIO에 필요한 것만 만든다.
**왜 지금 해야 하는가**: 아임웹 화면에는 많은 커머스 기능이 있지만 AIBIO에는 인기 페이지, 유입, A/B 테스트, 카카오 CTA 정도가 중요하다.
**산출물**: 인기 페이지, 유입 도메인, CTA 클릭, 폼 전환, 랜딩 A/B 테스트, 첫방문 오퍼 코드
**완료 기준**: Instagram/Facebook/Naver/Google/Direct 유입과 `/shop_view`, `/main`, `/bio_pulse_M`, `/56`, `/59` 전환을 자체 대시보드에서 볼 수 있다.

#### 역할 구분

- TJ: 어떤 지표를 매주 볼지 결정
- Codex: 서버 이벤트, GA4/Meta 대조, 대시보드 데이터 집계
- Claude Code: 대시보드 UI와 실험 결과 시각화

#### 실행 단계

1. [Codex] 아임웹 통계 대체 지표 1차 정의 — 방문자, 인기 페이지, 유입 도메인, 폼 전환, 결제 전환
2. [Codex] GA4/서버 이벤트/attribution ledger 조인 기준 작성
3. [Claude Code] 운영자용 간단 통계 화면 설계. 의존성: 병렬가능
4. [TJ] 첫방문 오퍼 정책 승인 — 쿠폰 전체가 아니라 혜택 코드 1개부터
5. [Codex] 랜딩 A/B 테스트 최소 기능 설계. 의존성: 부분병렬

**다음 Phase에 주는 가치**: 결제를 붙이기 전에 어떤 랜딩과 CTA가 방문을 만드는지 알 수 있다.

### Phase5-Sprint6

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 예약금/체험권 Toss 결제
**목표**: PG 직접 연동을 예약금 또는 체험권 1개로 작게 검증한다.
**왜 지금 해야 하는가**: 결제까지 자체화하면 광고 클릭부터 실제 매출까지 서버에서 닫을 수 있다.
**산출물**: order draft, Toss payment widget, confirm API, webhook, refund/cancel 기록, daily reconcile
**완료 기준**: test key와 소액 live에서 결제 성공, 실패, webhook, 환불 기록이 모두 남는다.

#### 역할 구분

- TJ: AIBIO Toss MID/API key 발급, 실결제 테스트 승인 — 외부 계정/실결제 필요
- Codex: 결제 API, 금액 검증, webhook, idempotency, reconcile 구현
- Claude Code: checkout/success/fail UI

#### 실행 단계

1. [Codex] test key 기준 order/payment schema와 confirm API 작성
2. [Claude Code] checkout/success/fail 화면 구현. 의존성: 병렬가능
3. [TJ] AIBIO Toss 계약/MID/API key 확인 — 2FA 또는 관리자 권한 필요
4. [Codex] live key 환경변수 연결과 소액 결제 검증. 의존성: 선행필수
5. [Codex] Toss 거래/정산 조회와 자체 payments daily reconcile

**다음 Phase에 주는 가치**: 아임웹 결제 fallback을 줄일지 판단할 수 있다.

### Phase6-Sprint7

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 운영 관리자/RBAC
**목표**: 리드, 예약, 방문, 결제, 담당자 권한을 자체 관리자에서 처리한다.
**왜 지금 해야 하는가**: 첨부 고객 목록 화면에는 개인정보와 운영 그룹이 보인다. 자체화하면 접근권한과 감사로그가 필수다.
**산출물**: operator login, role, site access, lead/reservation/payment admin, audit log
**완료 기준**: 관리자는 자기 권한에 맞는 고객/리드만 보고, 개인정보 접근 기록이 남는다.

#### 역할 구분

- TJ: 운영자 역할과 접근 범위 승인
- Codex: Auth/RBAC/audit API, 개인정보 마스킹, 권한 테스트
- Claude Code: admin shell, 리스트/상세/필터 UI

#### 실행 단계

1. [Codex] 역할 정의 — admin, manager, marketer, viewer
2. [Codex] `@Roles`, `@SiteAccess('aibio')` guard 적용 범위 설계
3. [Claude Code] 운영자 리스트/상세 화면 설계. 의존성: 병렬가능
4. [TJ] 실제 운영진 계정과 역할 확정 — 개인정보 접근 승인
5. [Codex] audit log와 권한 회귀 테스트 작성. 의존성: 부분병렬

**다음 Phase에 주는 가치**: 아임웹 관리자 없이도 상담 운영이 가능해진다.

### Phase7-Sprint8

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 아임웹 종료 판단
**목표**: AIBIO에 한해 아임웹을 종료할지 fallback으로 유지할지 판단한다.
**왜 지금 해야 하는가**: 자체 사이트가 만들어져도 누락/중복/환불/SEO 리스크가 남으면 바로 끄면 안 된다.
**산출물**: 30일 병행 리포트, URL redirect map, Search Console 점검, fallback 종료 기준
**완료 기준**: 자체 폼/예약/결제 성공률과 아임웹 fallback 누락률을 숫자로 보고 Go/No-Go를 결정한다.

#### 역할 구분

- TJ: 아임웹 종료 또는 유지 최종 판단
- Codex: 30일 병행 리포트, redirect, sitemap, canonical, Search Console 체크리스트
- Claude Code: 종료 후 안내/에러/fallback 화면 UX

#### 실행 단계

1. [Codex] 자체 사이트와 아임웹 fallback 30일 병행 지표 정의
2. [Codex] 기존 URL별 301 redirect map 작성
3. [Claude Code] fallback/maintenance 화면 작성. 의존성: 병렬가능
4. [TJ] 30일 리포트 확인 후 종료/유지 승인
5. [Codex] 승인 후 redirect와 sitemap 운영 반영. 의존성: 선행필수

**다음 Phase에 주는 가치**: AIBIO를 성공 사례로 만든 뒤 바이오컴/더클린커피 검토로 넘어갈 수 있다.

## 7. 자체 개발의 장점

| 장점 | 설명 |
|---|---|
| 전환 추적 정확도 | payment success, Toss confirm, CAPI를 같은 서버에서 닫을 수 있음 |
| CRM 연결 | 리드/상담/예약/방문/결제를 직접 세그먼트화 가능 |
| UX 자유도 | 검사/상담/센터 방문처럼 아임웹 기본 쇼핑몰과 맞지 않는 흐름을 직접 설계 가능 |
| 속도/SEO 제어 | Next.js 기반 메타, schema, sitemap, 성능 최적화 가능 |
| 데이터 소유 | 고객/리드/예약/결제/귀속 원장을 자체 기준으로 통합 가능 |
| 실험 | 가격/CTA/랜딩/메시지를 실험 장부와 바로 연결 가능 |

## 8. 리스크

| 리스크 | 대응 |
|---|---|
| 결제 사고 | Toss test key, 소액 live, webhook, idempotency, daily reconcile |
| 리드/예약 누락 | 초기에는 아임웹 입력폼 병행, 자체 폼과 중복/누락 대조 |
| 결제/방문 상태 불일치 | 예약금/체험권만 먼저 운영하고 Toss 거래/정산과 daily reconcile |
| 환불/부분취소 복잡도 | MVP에서는 수동 처리, 이후 관리자 구현 |
| 개인정보/보안 | secret key 서버 보관, PII 최소화, 접근권한, 감사로그 |
| 운영자 교육 | `/crm` 또는 별도 admin에 리드/예약/결제 상태를 단순하게 노출 |
| SEO 이전 | URL 매핑, 301 redirect, sitemap, canonical, Search Console |
| 아임웹 데이터 API 한계 | 레거시 API와 신규 Open API/OAuth 권한을 병행 검증 |
| 쇼핑몰/정기구독 | 이번 범위 제외 |

## 9. 데이터 모델 초안

초기에는 로컬/개발 DB에서 검증하고, 운영 DB 스키마 변경은 승인 후 진행한다. 아래 모델은 AIBIO 예약금/체험권 결제용 초안이며, 범용 쇼핑몰 모델이 아니다.

```sql
sites (
  site TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  toss_store TEXT,
  ga4_measurement_id TEXT,
  meta_pixel_id TEXT
)

leads (
  lead_id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  customer_name TEXT,
  customer_phone_hash TEXT NOT NULL,
  age_range TEXT,
  purpose TEXT,
  acquisition_channel TEXT,
  status TEXT NOT NULL,
  utm_json TEXT,
  consent_json TEXT,
  source TEXT NOT NULL,
  created_at TEXT
)

reservations (
  reservation_id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  lead_id TEXT,
  customer_phone_hash TEXT NOT NULL,
  reserved_at TEXT,
  visit_status TEXT NOT NULL,
  memo TEXT,
  created_at TEXT
)

tickets (
  ticket_id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL,
  price INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'native'
)

orders (
  order_id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  member_id TEXT,
  customer_phone_hash TEXT,
  customer_email_hash TEXT,
  status TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  discount_amount INTEGER DEFAULT 0,
  reservation_id TEXT,
  source_channel TEXT,
  utm_json TEXT,
  created_at TEXT,
  confirmed_at TEXT
)

order_items (
  order_item_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  ticket_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  item_amount INTEGER NOT NULL
)

payments (
  payment_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  payment_key TEXT,
  toss_order_id TEXT,
  method TEXT,
  status TEXT NOT NULL,
  requested_amount INTEGER NOT NULL,
  approved_amount INTEGER,
  approved_at TEXT,
  raw_json TEXT
)

payment_events (
  event_id TEXT PRIMARY KEY,
  payment_id TEXT,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  idempotency_key TEXT,
  raw_json TEXT,
  received_at TEXT
)
```

## 10. Toss 연동 구현 세부안

### 프론트

- 예약금/체험권 checkout 페이지에서 주문 draft 생성
- 백엔드에서 받은 `orderId`, `amount`, `orderName`, `customerKey`로 Toss 결제위젯 호출
- `successUrl`, `failUrl`은 자체 도메인으로 설정
- success 페이지에서 백엔드 confirm API 호출 또는 서버 route handler에서 confirm

### 백엔드

필수 API:

| Method | Path | 역할 |
|---|---|---|
| `POST` | `/api/aibio/orders` | 예약금/체험권 주문 draft 생성 |
| `POST` | `/api/payments/toss/confirm` | `paymentKey/orderId/amount` 검증 후 Toss 승인 |
| `POST` | `/api/payments/toss/webhook` | 결제 상태 변경 수신 |
| `POST` | `/api/payments/toss/cancel` | 관리자 취소/부분취소 |
| `GET` | `/api/aibio/orders/:id` | 예약금/체험권 결제 상태 조회 |

필수 방어:

- successUrl의 amount와 DB order amount 불일치 시 승인 중단
- confirm API는 idempotency key 사용
- Toss secret key는 서버 환경변수만 사용
- webhook은 event id/paymentKey/orderId 기준 중복 처리
- 매일 `payments` vs Toss transactions/settlements reconcile

## 11. 아임웹 병행 전략

완전 탈출 전까지는 아임웹을 다음 용도로 유지한다.

| 용도 | 이유 |
|---|---|
| 기존 페이지/폼 fallback | 자체 사이트 초기 장애나 누락 시 리드 손실 방지 |
| 기존 입력폼 export 참조 | 자체 폼과 누락/중복 대조 필요 |
| 기존 운영 콘텐츠 참조 | 프로그램 설명, 위치, FAQ, 이벤트 문구 정본 확인 |
| 장애 fallback checkout | 자체 Toss checkout 장애 시 예약금/체험권 결제 손실 방지 |

단, 자체 폼/예약/checkout에서 발생한 리드와 결제는 아임웹에 자동 생성되지 않을 수 있다. 따라서 초기에는 자체 관리자 또는 운영 DB/스프레드시트 등 별도 처리 플로우를 정해야 한다.

## 12. AIBIO 권장 MVP

### AIBIO 센터

우선순위: 1순위

MVP:

- 자체 홈페이지
- 상담예약/방문예약
- 리드 저장
- 채널톡/알림톡 후속
- 예약금 또는 체험권 Toss 결제
- Meta/Google 광고 전환 직접 기록

하지 않을 것:

- 전체 쇼핑몰
- 복잡한 회원등급/포인트
- 배송/송장/정기구독
- 바이오컴/더클린커피 상품 판매 이관

### 바이오컴/더클린커피

이번 문서에서는 검토하지 않는다. 두 사이트는 추후 아래 자료를 따로 확인한 뒤 별도 문서로 판단한다.

- 상품/옵션/재고
- 주문/배송/교환/반품
- 쿠폰/포인트/회원등급
- 정기구독
- PlayAuto/택배/정산 플로우
- 기존 아임웹 주문과 Toss 결제 reconcile

## 13. Go/No-Go 기준

### Go

- AIBIO 자체 사이트에서 광고/CRM/결제 추적 품질을 높이는 것이 주요 목적이다.
- 커머스보다 리드/예약이 중요한 AIBIO부터 시작한다.
- Toss 결제는 체험권/예약금 단일 결제부터 검증한다.
- 아임웹은 당분간 fallback 및 기존 입력폼 export 참조로 유지한다.
- 전사 통합 플랫폼을 목표로 한다면 AIBIO 신규 native API부터 NestJS로 시작한다.

### No-Go 또는 보류

- “아임웹 기능을 전부 똑같이 만들자”가 목표라면 보류한다.
- 주문/배송/교환/반품/정기구독을 한 번에 자체화하려면 범위가 너무 크다.
- 운영자가 자체 관리자만으로 CS 처리할 준비가 없으면 결제 전체 이관은 위험하다.
- 바이오컴/더클린커피까지 같은 일정에 묶으면 보류한다.

## 14. 프론트엔드 AI 에이전트 선택

결론부터 말하면, AIBIO 자체 개발의 기본 실행자는 `Codex + GPT-5.5`가 맞다. 이유는 이 저장소를 직접 읽고 수정하고, 테스트와 Playwright 검증까지 한 흐름으로 닫을 수 있기 때문이다.

다만 순수 화면미, 랜딩 문구, 대시보드 마감은 `Claude Opus 4.7`을 보조 리뷰어로 붙이는 전략이 좋다. Anthropic 공식 발표에는 Opus 4.7이 대시보드와 데이터가 많은 UI에서 강하다는 사용자 평가가 있고, Vercel/Bolt/Replit 계열 평가도 앱 제작과 한 번에 화면을 만드는 작업 개선을 언급한다. 반대로 OpenAI 공식 발표 기준 GPT-5.5는 Codex 안에서 장기 작업, 도구 사용, 검증 루프, 대규모 코드베이스 유지에 강하다.

| 기준 | GPT-5.5 in Codex | Claude Opus 4.7 | AIBIO 판단 |
|---|---|---|---|
| 저장소 직접 작업 | 강함. Codex 환경에서 파일 수정, 명령 실행, 검증까지 한 흐름 | Claude Code 환경 의존 | 기본 구현은 GPT-5.5 |
| 장기 agentic coding | OpenAI 발표 기준 Terminal-Bench 2.0 82.7%, OSWorld-Verified 78.7% | OpenAI 표 기준 Terminal-Bench 69.4%, OSWorld 78.0% | 통합 개발은 GPT-5.5 우선 |
| SWE-Bench Pro | OpenAI 발표 기준 58.6% | OpenAI 발표 표 기준 64.3% | 이슈 해결형 코딩은 Claude도 강함 |
| UI 감각/대시보드 | 직접 수치화된 frontend 전용 공개 벤치마크는 부족 | Anthropic 발표에서 dashboard/data-rich UI 강점 언급 | 시각 리뷰는 Claude 병행 가치 있음 |
| 이 프로젝트 적합성 | AGENTS/docurule, NestJS, Toss, attribution, Playwright 검증까지 연결 가능 | 화면 마감과 대안 제안에 유리 | Codex 구현 + Claude 리뷰가 현실적 |

운영 방식:

1. `Codex + GPT-5.5`: 기본 구현, 리팩토링, API 연결, 테스트, Playwright 검증
2. `Claude Opus 4.7`: 첫 화면/랜딩/대시보드 디자인 리뷰, 카피 대안, 시각적 밀도 점검
3. 최종 판단: 같은 요구사항으로 AIBIO 홈 1개 화면을 각각 만들게 한 뒤, PC/모바일 화면 캡처, Lighthouse, 전환 CTA 가시성, 코드 유지보수성으로 비교한다.

지금 당장 결론은 `Codex에서 GPT-5.5로 진행`이다. Claude 4.7 Opus는 대체자가 아니라 디자인 리뷰와 대안 생성 역할로 붙이는 것이 낫다.

## 15. 다음 액션

1. AIBIO 기능 인벤토리 보강
   - 아임웹 관리자 페이지 목록 export 또는 sitemap
   - 입력폼 CSV export 샘플
   - CTA 링크 전체 목록
   - 네이버 예약/플레이스 사용 여부
   - 현재 삽입 코드 정본 재확인
2. AIBIO 자체 홈페이지 MVP IA 작성
   - 홈, 프로그램, 이벤트/체험권, 예약, 위치, FAQ, 후기/사례
3. NestJS skeleton 여부 결정
   - `apps/api` 신규 NestJS 모듈형 백엔드로 갈지
   - 기존 Express 7020에 AIBIO MVP를 붙일지
4. Toss 단일 checkout 기술 스파이크
   - test key
   - order draft
   - payment widget
   - confirm
   - webhook
5. AIBIO 아임웹 기존 URL -> 자체 URL 301 redirect 계획 수립
6. 바이오컴/더클린커피는 별도 검토 일정으로 분리

## 16. 근거와 참고

### 로컬 자료

- `AGENTS.md`
- `docurule.md`
- `imweb/aibio-admin-screenshots.md`
- `imwebapi.md`
- `tossapi.md`
- `tosskey.md`
- `localdb.md`
- `backend/src/routes/crmLocal.ts`
- `backend/src/routes/toss.ts`
- `backend/src/tossConfig.ts`
- `backend/src/env.ts`
- `aibio/!aibioroadmap.md`
- `aibio/아임웹폼제출API검토.md`
- `aibio/imwebcode_aibio_latest.md`
- `aibio/채널톡퍼널.md`
- `aibio/aibio_sync_design.md`
- `aibio/gtm.md`
- `frontend/src/app/aibio-funnel/page.tsx`
- `frontend/src/app/crm/*`
- `frontend/src/app/acquisition-analysis/page.tsx`

### 공식 자료

- Toss Payments 결제위젯: https://docs.tosspayments.com/en/integration-widget
- Toss Payments Payment APIs: https://docs.tosspayments.com/en/api-guide
- Toss Payments Core API: https://docs.tosspayments.com/reference
- Toss Payments API 키: https://docs.tosspayments.com/reference/using-api/api-keys
- Toss Payments 웹훅 이벤트: https://docs.tosspayments.com/reference/using-api/webhook-events
- Imweb Developers: https://developers-docs.imweb.me/
- Imweb 주문 이해하기: https://developers-docs.imweb.me/guide/%EC%A3%BC%EB%AC%B8-%EC%9D%B4%ED%95%B4%ED%95%98%EA%B8%B0
- Imweb 주의 및 제한사항: https://developers-docs.imweb.me/guide/%EC%A3%BC%EC%9D%98-%EB%B0%8F-%EC%A0%9C%ED%95%9C%EC%82%AC%ED%95%AD
- Imweb 웹훅 연동 가이드: https://developers-docs.imweb.me/guide/%EA%B0%9C%EB%B0%9C-%EA%B0%80%EC%9D%B4%EB%93%9C-%ED%99%95%EC%9D%B8%ED%95%98%EA%B8%B0/%EC%9B%B9%ED%9B%85-%EC%97%B0%EB%8F%99-%EA%B0%80%EC%9D%B4%EB%93%9C
- NestJS Modules: https://docs.nestjs.com/modules
- NestJS Guards: https://docs.nestjs.com/guards
- NestJS Authentication: https://docs.nestjs.com/security/authentication
- NestJS Authorization: https://docs.nestjs.com/security/authorization
- Next.js Authentication: https://nextjs.org/docs/app/building-your-application/authentication
- OpenAI GPT-5.5 announcement: https://openai.com/index/introducing-gpt-5-5/
- Anthropic Claude Opus 4.7 announcement: https://www.anthropic.com/news/claude-opus-4-7

## 17. 데이터 정확성 기록

| 항목 | Source | 기준 시각/문서일 | Window | Site | Freshness | Confidence |
|---|---|---|---|---|---|---|
| 프론트 포트 7010 | `AGENTS.md` | 2026-04-26 확인 | 현재 설정 | all | 높음 | 높음 |
| 백엔드 포트 7020 | `AGENTS.md` | 2026-04-26 확인 | 현재 설정 | all | 높음 | 높음 |
| AIBIO 도메인 `aibio.ai` | AIBIO 로컬 문서 | 2026-04-26 확인 | 현재 운영 후보 | aibio | 높음 | 높음 |
| AIBIO 입력폼 `다이어트 페이지 DB`, 응답 104 | `aibio/아임웹폼제출API검토.md` | 2026-04-25 문서 | 관리자 캡처 시점 | aibio | 중간 | 중간, CSV export 필요 |
| AIBIO GA4/GTM/Pixel 정본 후보 | `aibio/gtm.md`, `aibio/imwebcode_aibio_latest.md` | 2026-04-26 확인 | 현재 삽입 코드 | aibio | 높음 | 중상, 운영 화면 재확인 권장 |
| AIBIO Supabase sync 대상 건수 | `aibio/aibio_sync_design.md` | 2026-04-24 문서 | 문서 작성 당시 | aibio | 중간 | 중간, API 재조회 필요 |
| AIBIO 최근 30일 광고/폼/방문 스냅샷 | `frontend/src/app/aibio-funnel/page.tsx` | 2026-04-26 확인 | 2026-03-26~2026-04-24 등 snapshot | aibio | 중간 | 중간, live API 재조회 필요 |
| Toss 거래/정산 조회 라우트 | `backend/src/routes/toss.ts` | 2026-04-26 확인 | 로컬 코드 기준 | biocom/coffee 중심 | 높음 | 높음 |
| Toss 직접 결제 가능성 | Toss 공식 문서 | 2026-04-26 조회 | 현재 공식 문서 | aibio 포함 가능 | 높음 | 높음 |
| NestJS RBAC/Guard 적합성 | NestJS 공식 문서 | 2026-04-26 조회 | 현재 공식 문서 | all | 높음 | 높음 |
| Imweb 신규 주문 API 범위 | Imweb Developers 공식 문서 | 2026-04-26 조회 | 주문관리시스템 v2 | all | 높음 | 높음 |
| 첨부 관리자/디자인 화면 | TJ님 대화 첨부 Image #1~#10, `imweb/aibio-admin-screenshots.md` | 2026-04-26 판독 | 화면 캡처 시점 | aibio | 중간 | 중간, 원본 파일 export 필요 |
| GPT-5.5 vs Claude Opus 4.7 | OpenAI/Anthropic 공식 발표 | 2026-04-26 조회 | 2026-04 발표 자료 | all | 높음 | 중간, AIBIO 내부 비교 테스트 필요 |
