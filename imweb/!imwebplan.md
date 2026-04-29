# AIBIO 아임웹 탈출 및 자체 홈페이지/예약 결제 개발 검토

작성 시각: 2026-04-26 23:55 KST
최근 업데이트: 2026-04-28 23:43 KST (바이오컴 SEO/canonical 제약과 아임웹 탈출 우선순위 판단 메모 추가)
기준일: 2026-04-28
대상 사이트: AIBIO 센터 우선
보류 사이트: 바이오컴은 2026-04-28 SEO/canonical 제약 메모만 추가, 더클린커피는 추후 별도 검토
작성 목적: AIBIO 센터 홈페이지를 아임웹에서 단계적으로 탈출시키기 위해, 현재 확인 가능한 기능 인벤토리와 자체 개발 범위, PG사 토스페이먼츠 직접 연동 가능성, NestJS 기반 통합 백엔드 전략을 검토한다.
문서 작성 규칙: `docurule.md` v4 기준. 실행 단계는 `무엇/왜/어떻게/산출물/검증/담당`을 모두 적고, TJ 승인 요청은 추천안·대안·자신감·YES/NO 답변 형식으로 제시한다.
연결 문서: [[contactdashboard]] — 접수 폼별 컨택 여부, 고객 반응, 다음 액션, 예약/방문/결제 연결을 관리하는 상담 운영 대시보드 정본 설계.

## 다음 할일

| 순서 | 담당 | 할일 | 구체 내용 |
|---:|---|---|---|
| 1 | Codex | 완료: 첫 실험 랜딩을 자체 route로 만든다 | 무엇: `/shop_view?idx=25` 성격의 이벤트/체험권 랜딩을 Next.js route로 만들었다. 왜: 전체 홈페이지를 한 번에 옮기지 않고 고유입 랜딩 1개에서 리드 원장을 검증하기 위해서다. 어떻게: `frontend/src/app/shop_view/page.tsx`, `RecoveryLabOfferLanding.tsx`, 공용 `AibioNativeLeadForm.tsx`를 추가했다. 산출물/검증: PC·모바일 screenshot, Playwright 통과, local backend 저장 smoke 통과. |
| 2 | Codex | 완료: 운영자 고객/리드 리스트를 실제 API에 연결한다 | 무엇: `/aibio-native/admin`에서 자체 리드, 유입, 상태, 담당자, 메모, 예약일, 방문일을 본다. 왜: 상담원이 실제로 쓸 수 있어야 아임웹 탈출 검토가 가능하기 때문이다. 어떻게: `GET /api/aibio/native-leads`, funnel, fallback comparison API를 연결했다. 산출물/검증: Playwright payload 검증, local PATCH smoke 통과. |
| 2.1 | Codex + Claude Code | 신규: 접수 폼 컨택 관리 대시보드 설계를 구현한다 | 무엇: 상담원이 고객에게 컨택했는지, 고객 반응이 어땠는지, 다음 액션이 무엇인지 기록하는 운영 화면을 만든다. 왜: 상태와 메모만으로는 실제 상담 처리 품질과 광고 리드 품질을 판단할 수 없기 때문이다. 어떻게: `imweb/contactdashboard.md`를 정본으로 두고 백엔드는 컨택 이벤트 불변 로그/API/감사로그를 설계하며, 프론트는 Claude Code가 리스트+상세 패널+타임라인으로 구현한다. 산출물/검증: 컨택 기록 저장, 고객 반응 저장, 원문 연락처 조회 audit, 첫 컨택률/예약률 리포트. |
| 3 | Codex | 완료: 상세페이지 편집 관리자 초안을 만든다 | 무엇: `/aibio-native/admin/content`에서 첫 실험 랜딩의 히어로 문구, CTA, 이미지 URL/업로드, 카드, 흐름, 폼 문구를 수정한다. 왜: 개발자나 디자이너가 코드 수정 없이 이미지와 상세페이지 내용을 바꿀 수 있어야 하기 때문이다. 어떻게: DB 스키마 변경 없이 `backend/data/aibio-native-content.json` 파일 저장 API를 만들었다. 산출물/검증: content GET/PATCH API, 이미지 업로드 API, Playwright 저장 테스트. |
| 4 | Codex | 완료: 입력폼 엑셀 분석 관리자 초안을 만든다 | 무엇: `/aibio-native/admin/forms`에서 아임웹 입력폼 엑셀을 업로드하면 행수, 컬럼, 동의, 중복 연락처 hash, 상담 목적/경로/유형 집계를 본다. 왜: 30일 병행 전 기존 입력폼 구조를 자체 원장 필드에 맞춰야 하기 때문이다. 어떻게: `POST /api/aibio/admin/form-export/analyze`가 원문 PII를 반환하지 않고 집계만 반환한다. 산출물/검증: `imweb/aibio-form-export-analysis-20260426.md`, Playwright 업로드 테스트. |
| 5 | Codex | 완료: 관리자 권한 명부 초안을 만든다 | 무엇: `/aibio-native/admin/access`에서 owner/manager/marketer/designer/viewer 역할과 운영자 명부를 지정한다. 왜: 새 AIBIO 센터 홈페이지에는 고객 목록, 원문 연락처, 상세페이지 편집 권한을 분리해야 하기 때문이다. 어떻게: 정식 로그인 전 단계로 `AIBIO_NATIVE_ADMIN_TOKEN` 보호 + 파일 기반 operator 명부를 구현했다. 산출물/검증: access GET/PUT API와 권한 기준표 화면. |
| 6 | Codex | 완료: NestJS 적용 범위 skeleton 문서를 만든다 | 무엇: 현재 Express 7020 API를 유지할 것과 NestJS 신규 후보로 갈 것을 나눴다. 왜: 전사 플랫폼으로 확장하려면 인증/RBAC/결제/감사로그 경계가 먼저 필요하기 때문이다. 어떻게: `backend/src/routes/aibio.ts`, `toss.ts`, `attribution.ts` route를 module별로 분류하고 `imweb/aibio-nestjs-skeleton.md`에 저장했다. 산출물/검증: 모든 주요 API가 Express 유지 또는 NestJS 목표 module로 분류됨. |
| 7 | Codex | 진행: 자체 폼 v1.1 필드 보강안을 만든다 | 무엇: 아임웹 입력폼처럼 상담 목적 다중 선택과 상담 신청 유형을 자체 폼에 반영할 방식을 정한다. 왜: 기존 export는 상담 목적이 다중 선택이고 문자/전화/카톡 선호가 있어 현재 단일 선택 폼보다 정보량이 많다. 어떻게: DB 스키마 변경이 필요한 `preferredContactType`은 승인 포인트로 남기고, 우선 UI/문서 추천안을 만든다. 산출물/검증: 추천안 A/B와 영향도 표. |
| 8 | TJ + 팀 | 2~3일 뒤 팀 리뷰와 사용법 설명 일정을 잡는다 | 무엇: 상담원/디자이너/개발자에게 `/aibio-native/admin`, `/forms`, `/content`, `/access` 사용법을 설명한다. 왜: 병행 운영은 어느 정도 작동하는 솔루션을 팀이 이해한 뒤 시작해야 하기 때문이다. 어떻게: 리뷰 날짜, 참석자, 체크할 기능, 피드백 수집 방식을 정한다. 산출물/검증: 리뷰 결과와 수정 요청 목록. |
| 9 | TJ + Codex | 팀 리뷰 이후 30일 병행 운영 시작일과 Go/No-Go 기준을 확정한다 | 무엇: 자체 폼과 아임웹 폼을 같이 받을 시작일, 종료 후보일, 누락률 기준을 정한다. 왜: 감으로 아임웹을 종료하면 리드 누락 리스크가 생긴다. 어떻게: 시작 전 기능 설명을 끝내고, 정상 저장률 99% 이상·누락률 3% 이하·상태 입력률 80% 이상 기준으로 매주 확인한다. 산출물/검증: 운영 리포트에 기준일·window·source 기록. |
| 10 | TJ | 첫 실험 랜딩 노출 방식을 승인한다 | 무엇: 자체 `/shop_view?idx=25` route를 광고 URL 일부로 쓸지, 내부 테스트만 할지, 아임웹 페이지에서 링크로만 보낼지 결정한다. 왜: 전체 홈페이지 전환 전에 리스크를 작게 두고 실운영 리드를 모아야 하기 때문이다. 어떻게: 광고 URL 일부 교체, 내부 테스트 URL 공유, 아임웹 CTA 링크 추가 중 하나를 고른다. 산출물/검증: 어떤 유입이 자체 랜딩으로 들어오는지 문서에 남는다. |
| 11 | TJ + Codex | 신규: 바이오컴 아임웹 탈출 우선순위는 별도 SEO 지표로 판단한다 | 무엇: 바이오컴에서 canonical 수동 변경과 301 redirect가 아임웹에서 지원되지 않는 것을 확인했다. 왜: 이 제약만으로 즉시 자체 구축을 시작하면 커머스, 주문, 배송, 회원, SEO를 한 번에 옮기는 대형 프로젝트가 된다. 판단: canonical 자동 삽입이 유지되고 robots.txt가 정상 적용됐으므로 지금은 SEO/AEO 시범 개선과 GSC 추적을 먼저 한다. 산출물: `seo/!seoplan.md`의 「다음 가장 파급력 있는 할 일」. |

## 2026-04-28 바이오컴 SEO 별도 메모

결론부터 말하면, 바이오컴의 canonical 수동 변경과 301 redirect 미지원은 불편한 제약이지만 이 사안 하나만으로 아임웹 탈출을 최우선 프로젝트로 올릴 정도는 아니다. 아임웹이 canonical tag를 자동 삽입하고 있고, 2026-04-28 기준 robots.txt의 sitemap 줄도 `Sitemap: https://biocom.kr/sitemap.xml` 한 줄로 정상 적용됐다.

지금 바이오컴에서 더 큰 병목은 `대표 URL을 사람이 직접 고정할 수 없음`보다 `검색엔진과 AI가 읽을 수 있는 본문 텍스트와 구조화 데이터가 부족함`이다. 따라서 다음 순서는 자체 구축 착수가 아니라, 시범 상품/검사권 4개에 보이는 본문 텍스트와 JSON-LD를 붙이고 GSC에서 Google 선택 canonical을 확인하는 것이다.

바이오컴 자체 구축 우선순위를 올리는 신호는 아래와 같다.

| 신호 | 의미 | 판단 |
|---|---|---|
| 핵심 상품 3개 이상에서 Google 선택 canonical이 의도와 다름 | 아임웹 자동 canonical이 검색 성과를 흔드는 상태 | 자체 구축 또는 별도 랜딩 우선순위 상승 |
| 같은 상품의 노출이 `/shop_view`와 메뉴 URL로 계속 나뉨 | GSC 리포트와 순위 신호가 분산됨 | 대표 URL 전략 재검토 |
| JSON-LD, FAQ, 본문 텍스트, 속도 개선이 아임웹에서 계속 막힘 | SEO/AEO 성장 작업 자체가 플랫폼에 막힘 | 자체 구축 검토를 P1로 상승 |
| 주문/결제/회원/정기구독까지 직접 통제해야 함 | SEO 문제가 아니라 커머스 플랫폼 전환 문제 | 별도 전사 프로젝트로 분리 |

즉, AIBIO는 리드/예약 중심이라 자체화 실험을 계속 진행할 가치가 높다. 바이오컴은 커머스 복잡도가 크므로 `SEO/AEO 시범 개선 -> GSC 7/14/28일 추적 -> 제약 누적 여부 판단` 순서가 맞다.

## 현재 확인 가능한 URL

| 구분 | URL | 용도 | 상태 |
|---|---|---|---|
| 공개 MVP | `http://localhost:7010/aibio-native` | 자체 홈페이지/상담폼 MVP | 로컬 |
| 첫 실험 랜딩 | `http://localhost:7010/shop_view?idx=25` | `/shop_view?idx=25` 성격의 랜딩 + 자체 상담폼 | 로컬 |
| 고객/리드 관리자 | `http://localhost:7010/aibio-native/admin` | 고객 목록, 리드 상태, 담당자, 메모, 예약/방문일, 원문 연락처 조회 | 로컬 |
| 입력폼 분석 | `http://localhost:7010/aibio-native/admin/forms` | 아임웹 입력폼 엑셀 업로드와 집계/필드 매핑 확인 | 로컬 |
| 상세페이지 편집 | `http://localhost:7010/aibio-native/admin/content` | 랜딩 문구, CTA, 이미지 URL/업로드 편집 | 로컬 |
| 관리자 권한 | `http://localhost:7010/aibio-native/admin/access` | 운영자 명부와 역할 권한 초안 | 로컬 |
| 컨택 관리 설계 | `obsidian://open?vault=seo&file=imweb%2Fcontactdashboard` | 접수 폼 컨택 여부, 고객 반응, 다음 액션, 예약/방문/결제 연결 설계 | 문서 |
| Backend health | `http://localhost:7020/health` | 백엔드 설정/상태 확인 | 로컬 |

## 10초 요약

AIBIO는 아임웹 관리자 전체를 복제할 필요가 없다. 2026-04-26 23:55 KST 기준 1순위는 홈페이지 전체 완성이 아니라 `자체 리드/예약 원장 + 운영자가 바꿀 수 있는 최소 CMS`다. 공개 폼과 `/shop_view?idx=25` 첫 실험 랜딩은 로컬 SQLite 원장 저장까지 연결했고, 운영자 화면에서 고객/리드 목록, 담당자/메모/예약일/방문일, 원문 연락처 조회, 입력폼 엑셀 분석, 상세페이지 문구/이미지 편집, 관리자 권한 명부 초안까지 볼 수 있다. NestJS는 즉시 전체 이관이 아니라 `현재 Express 리드 원장 유지 + 신규 인증/RBAC/감사로그/결제 NestJS-first`로 경계를 잡았다. 30일 병행 운영은 지금 시작하지 않는다. 2~3일 뒤 팀 리뷰와 기능/사용법 설명을 거친 뒤 시작일을 잡는 것이 맞다.

쉽게 말하면, 아임웹이라는 큰 쇼핑몰 관리 도구를 그대로 다시 만드는 일이 아니다. 우리 센터 운영에 실제로 쓰는 접수대, 상담 장부, 방문 기록, 결제 영수증만 먼저 만드는 일이다. 첫 실험 랜딩은 `/shop_view?idx=25` 성격의 이벤트/체험권 랜딩으로 잡는다.

## Phase-Sprint 요약표

우리 기준은 문서화·설계·로컬 구현 기준이다. 운영 기준은 실제 AIBIO 운영 반영 기준이다.

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase0 | [[#Phase0-Sprint1]] | 화면/데이터 기준선 고정 | TJ + Codex | 70% / 0% | [[#Phase0-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | 플랫폼 골격 결정 | TJ + Codex | 55% / 0% | [[#Phase1-Sprint2\|이동]] |
| Phase2 | [[#Phase2-Sprint3]] | 공개 홈페이지/랜딩 자체화 | Codex + Claude Code | 72% / 0% | [[#Phase2-Sprint3\|이동]] |
| Phase3 | [[#Phase3-Sprint4]] | 폼/예약/리드 원장 | Codex + Claude Code | 84% / 0% | [[#Phase3-Sprint4\|이동]] |
| Phase4 | [[#Phase4-Sprint5]] | 통계/성장 도구 최소 구현 | Codex + Claude Code | 20% / 0% | [[#Phase4-Sprint5\|이동]] |
| Phase5 | [[#Phase5-Sprint6]] | 예약금/체험권 Toss 결제 | TJ + Codex | 10% / 0% | [[#Phase5-Sprint6\|이동]] |
| Phase6 | [[#Phase6-Sprint7]] | 운영 관리자/RBAC | Codex + Claude Code | 58% / 0% | [[#Phase6-Sprint7\|이동]] |
| Phase7 | [[#Phase7-Sprint8]] | 아임웹 종료 판단 | TJ + Codex | 대기 | [[#Phase7-Sprint8\|이동]] |

## 1. 결론

가능하다. 단, 이번 계획의 범위는 `AIBIO 센터 홈페이지`로 제한한다. 바이오컴과 더클린커피는 상품/주문/배송/정기구독 복잡도가 높으므로 추후 별도 검토한다.

권장 방향은 다음이다.

1. 입력폼/상담예약/방문예약/리드 품질 장부를 자체 원장으로 먼저 만든다.
2. AIBIO 홈페이지/랜딩/SEO/트래킹은 고유입 랜딩 1개부터 자체화한다.
3. 첫 실험 랜딩은 `/shop_view?idx=25` 성격의 이벤트/체험권 랜딩으로 둔다.
4. 디자인 모드 전체 복제 전에도 운영자/디자이너가 상세페이지 문구와 이미지를 바꿀 수 있는 최소 CMS는 필요하다.
5. 결제는 예약금 또는 체험권 1개부터 토스페이먼츠 결제위젯/결제창으로 직접 붙일 수 있다.
6. 전체 쇼핑몰, 배송, 정기구독은 이번 범위에서 제외한다.
7. 30일 병행 운영은 기능이 어느 정도 작동하고 팀 리뷰/사용법 설명을 마친 뒤 시작한다.

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
| 아임웹 입력폼 이름 | `다이어트 페이지 DB` | `imweb/aibio-form-export-analysis-20260426.md` | 높음, 2026-04-26 엑셀 기준 |
| 관리자 응답 수 | 데이터 행 106 | `다이어트 페이지 DB_2026_04_26_KR.xlsx` | 높음, 같은 사본 5개 확인 |
| 목록 필드 | 아이디, 작성자, IP 주소, 응답시간, 동의, 이름, 연락처, 나이, 상담 목적, 알게 된 경로, 상담 신청 유형 | `imweb/aibio-form-export-analysis-20260426.md` | 높음 |
| 상세 필드 | 이름, 연락처, 나이, 상담 목적 다중 선택, 알게 된 경로, 상담 신청 유형 | `imweb/aibio-form-export-analysis-20260426.md` | 높음 |
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

엑셀 반영 메모:

- 상담 목적은 기존 아임웹 폼에서 다중 선택이다. 자체 폼 v1.1은 `purpose[]` 또는 comma-separated 저장 중 하나로 보강해야 한다.
- 상담 신청 유형은 문자/전화/카톡 선호를 담는다. 현재 자체 폼의 `연락 희망 시간`과 별도 개념이므로 `preferredContactType` 신규 필드가 필요하다.
- 나이 컬럼은 `30대` 같은 bucket과 생년월일형 값이 섞여 있다. 관리자 분석에서는 나이대 정규화 confidence를 함께 표시해야 한다.
- 원문 이름, 연락처, IP 주소는 문서에 남기지 않는다. `/aibio-native/admin/forms` 분석 화면도 raw PII를 반환하지 않는다.

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

현재 요청의 목적이 `아임웹 탈출 + 전사 통합 가능성`이라면, AIBIO부터 NestJS 신규 백엔드 skeleton을 만드는 편이 장기적으로 맞다. 단, 기존 SEO Express를 즉시 제거하지 않고 병행한다. 상세 module boundary와 API 분류표는 `imweb/aibio-nestjs-skeleton.md`를 정본으로 둔다.

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

1. [x] [Codex] 아임웹 관리자/디자인 화면 10장을 판독했다 — 무엇: Image #1~#10에서 메뉴, 통계, 고객, 쿠폰, 디자인 요소, CTA를 뽑았다. 왜: 실제로 쓰는 기능과 복제하지 않을 기능을 분리하기 위해서다. 어떻게: 첨부 화면을 항목별로 읽고 `imweb/aibio-admin-screenshots.md`에 source/confidence를 붙였다. 산출물: 화면 판독 메모. 검증: 문서에 각 이미지 번호와 관찰 항목이 남아 있다.
2. [Codex] AIBIO 첫 실험 랜딩 후보를 비교한다 — 무엇: `/shop_view?idx=25`, `/59`, `/main`, `/bio_pulse_M`, `/56`의 역할, 유입량, 폼 연결 여부를 표로 정리한다. 왜: 전체 사이트 전환 전 어떤 URL 1개부터 자체 폼을 붙일지 정해야 하기 때문이다. 어떻게: `aibio/아임웹폼제출API검토.md`, `frontend/src/app/aibio-funnel/page.tsx`, 첨부 통계 화면의 인기 페이지·유입 사이트 값을 대조한다. 산출물: 첫 실험 랜딩 결정 표와 redirect 후보. 검증: 각 후보에 source, 기준시각, confidence가 붙는다.
3. [TJ] 아임웹 입력폼 CSV와 페이지 목록 export를 제공한다 — 무엇: AIBIO 입력폼 제출 목록, 페이지 URL 목록, 폼 필드명을 export한다. 왜: 아임웹 관리자 원본은 2FA 로그인이 필요하고 자체 원장 누락률 대조의 기준 데이터가 되기 때문이다. 어떻게: 아임웹 관리자에서 입력폼/페이지 목록을 CSV 또는 화면 캡처로 내려받아 공유한다. 산출물: 원본 export 파일 또는 캡처. 검증: export 기준일, 기간, 페이지 수, 폼 제출 수가 같이 기록된다. 의존성: 부분병렬.
4. [Codex] 입력폼 원본 수령 후 리드 필드 정본을 확정한다 — 무엇: 이름, 전화번호, 나이대, 상담 목적, 알게 된 경로, 신청 유형, 동의 필드를 자체 DB 필드와 매핑한다. 왜: 필드명이 흔들리면 아임웹 fallback과 자체 폼을 비교할 수 없기 때문이다. 어떻게: 3번 export의 개인정보를 마스킹한 뒤 현재 `aibio_native_leads` 필드와 대조한다. 산출물: 리드 필드 mapping v1. 검증: 원문 개인정보를 문서에 남기지 않고 hash/마스킹 기준만 남긴다. 의존성: 선행필수.

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

1. [x] [Codex] NestJS 적용 범위를 skeleton 문서로 만든다 — 무엇: `CoreModule`, `AuthModule`, `UsersModule`, `RbacModule`, `AuditModule`, `AibioLeadsModule`, `PaymentsModule`, `AttributionModule`의 책임을 정의했다. 왜: AIBIO가 전사 플랫폼 첫 모듈이 될 경우 인증·권한·결제 API가 흩어지면 나중에 다시 만들어야 하기 때문이다. 어떻게: 현재 Express 7020 route, AIBIO native lead API, Toss route, attribution route를 모듈 단위로 분류했다. 산출물: `imweb/aibio-nestjs-skeleton.md`. 검증: 각 주요 API가 Express 유지 또는 NestJS 목표 module 중 하나로 분류됐다.
2. [x] [Codex] 기존 Express 7020 유지 범위를 확정한다 — 무엇: 이미 운영 검증 중인 `/api/aibio/native-leads` 계열은 단기 유지하고, 새 결제/RBAC는 NestJS-first 후보로 분리했다. 왜: 프레임워크 전환 때문에 Phase3 리드 원장 실운영이 늦어지면 안 되기 때문이다. 어떻게: endpoint별 역할을 `Express 유지`, `NestJS 목표 Module`, `NestJS-first 신규 API`로 나눴다. 산출물: `imweb/aibio-nestjs-skeleton.md`의 API 분류표. 검증: 팀 리뷰에 필요한 리드/관리자/content/form 분석 API가 Express 유지로 남아 있다.
3. [TJ] AIBIO를 전사 플랫폼 첫 모듈로 볼지 승인한다 — 무엇: AIBIO 단독 MVP로 빠르게 갈지, NestJS 기반 전사 통합의 첫 모듈로 시작할지 결정한다. 왜: 인증/RBAC/결제 설계 범위와 초기 개발비가 달라지기 때문이다. 어떻게: 이 문서의 Phase1 판단표와 개발팀 기존 의견을 보고 승인한다. 산출물: 플랫폼 방향 결정. 검증: 승인 결과가 `Express 우선` 또는 `NestJS 신규 skeleton 병행` 중 하나로 문서에 기록된다. 의존성: 선행필수.
4. [Codex] 승인 결과에 맞춰 API path와 환경변수 이름을 고정한다 — 무엇: site prefix, admin token, Toss key, CAPI key, database path 이름을 정한다. 왜: 이름이 흔들리면 프론트·백엔드·운영 env가 서로 맞지 않는다. 어떻게: 기존 `AIBIO_NATIVE_ADMIN_TOKEN`과 `backend/src/tossConfig.ts` 네이밍 규칙을 맞춘다. 산출물: env naming table. 검증: `.env.example` 업데이트 필요 항목이 분리되고 secret 값은 커밋되지 않는다. 의존성: 선행필수.

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

1. [Codex] AIBIO 공개 사이트 메뉴 IA를 Next.js route 기준으로 옮긴다 — 무엇: `대사&붓기케어`, `대사&식욕조절`, `변화 후기`, `기기 설명`, `바이오해킹이란?` 메뉴를 route/section 후보로 나눈다. 왜: 광고 랜딩과 SEO 페이지가 같은 CTA와 폼 원장을 쓰게 하기 위해서다. 어떻게: 첨부 디자인 모드 화면의 상단 메뉴와 현재 `/aibio-native` 구조를 비교한다. 산출물: route/section mapping 표. 검증: 각 메뉴가 route, section anchor, 보류 중 하나로 분류된다.
2. [x] [Codex] 첫 실험 랜딩 route를 만들었다 — 무엇: `/shop_view?idx=25` 성격의 이벤트/체험권 랜딩을 자체 route 1개로 구현했다. 왜: 전체 홈페이지보다 작은 범위에서 광고 유입, CTA, 폼 저장을 검증하기 위해서다. 어떻게: `frontend/src/app/shop_view/page.tsx`, `RecoveryLabOfferLanding.tsx`, `AibioNativeLeadForm.tsx`를 추가했다. 산출물: `/shop_view?idx=25` Next.js route, CTA, native form 연결. 검증: 모바일/PC screenshot, Playwright, local backend 저장 smoke 통과.
3. [x] [Codex] 상세페이지 편집 관리자 초안을 만들었다 — 무엇: `/aibio-native/admin/content`에서 히어로, CTA, 이미지, 카드, 흐름, 폼 문구를 편집한다. 왜: 개발자/디자이너가 코드 수정 없이 랜딩 이미지를 바꾸고 상세페이지 내용을 수정할 수 있어야 운영 전환이 가능하기 때문이다. 어떻게: 공개 랜딩이 `GET /api/aibio/content/shop-view-25`를 읽고, 관리자는 `PATCH /api/aibio/admin/content/shop-view-25`로 저장한다. 산출물: 파일 기반 content store와 이미지 업로드 API. 검증: Playwright content 저장 테스트.
4. [Codex] 기존 아임웹 URL redirect 초안을 작성한다 — 무엇: `/shop_view?idx=25`, `/59`, `/main`, `/bio_pulse_M`, `/56`을 자체 route 또는 아임웹 fallback으로 분류한다. 왜: 광고 소재와 검색 유입이 깨지면 리드가 끊기기 때문이다. 어떻게: 아임웹 통계의 인기 페이지와 로컬 문서의 폼 제출 URL을 대조한다. 산출물: redirect map v0.1. 검증: 각 URL에 source, 처리 방향, 운영 반영 전/후 상태가 적힌다.
5. [Claude Code] hero와 섹션 UX를 리뷰한다 — 무엇: 첫 화면 CTA, 섹션 순서, 폼 진입 버튼, 모바일 문구 길이를 점검한다. 왜: 랜딩의 목적은 설명이 아니라 상담 신청 전환이기 때문이다. 어떻게: Playwright screenshot 또는 로컬 브라우저 캡처를 기준으로 시각적 우선순위와 이탈 지점을 표시한다. 산출물: UX 수정 제안 목록. 검증: CTA가 첫 viewport에서 보이고 폼 진입까지 1번 클릭으로 가능하다. 의존성: 병렬가능.
6. [TJ] before/after 이미지와 후기 표현 사용 범위를 승인한다 — 무엇: 변화 후기, 전후 이미지, 감량 수치, 건강 표현의 사용 가능 범위를 결정한다. 왜: 의료·건강 표현은 광고 심사와 법적 리스크가 있기 때문이다. 어떻게: 실제 사용할 이미지·문구 후보를 보고 허용/수정/금지로 표시한다. 산출물: 표현 승인표. 검증: 승인 안 된 표현은 랜딩에 배포하지 않는다. 의존성: 부분병렬.
7. [x] [Codex] Playwright PC/mobile screenshot으로 랜딩을 검증했다 — 무엇: desktop 1366x900, mobile 390x844 viewport에서 hero, CTA, 폼 진입을 캡처했다. 왜: 디자인 모드에서 보이던 화면과 자체 구현 화면의 깨짐을 조기에 잡기 위해서다. 어떻게: frontend 7010에서 `/shop_view?idx=25` route를 열고 Playwright screenshot과 smoke test를 실행했다. 산출물: `.codex-backups/20260426-aibio-offer-route/shop-view-25-*.png`와 테스트 로그. 검증: 텍스트 겹침, CTA 미노출, route 404가 없었다. 의존성: 부분병렬.

**다음 Phase에 주는 가치**: 광고 랜딩과 상담 CTA를 자체 폼/원장에 연결할 수 있다.

### Phase3-Sprint4

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 폼/예약/리드 원장
**목표**: 아임웹 입력폼 의존을 줄이고, 폼 제출 이후 상담/방문/결제까지 한 기록 장부로 본다.
**왜 지금 해야 하는가**: 현재 AIBIO는 커머스몰보다 오프라인 센터 리드 사업에 가깝다. 광고 클릭이 리드, 상담, 예약, 방문, 결제로 이어졌는지가 매출 판단의 중심이다.
**산출물**: 자체 lead form, local SQLite lead ledger, UTM/fbclid/gclid/fbc/fbp/ga 저장, 상담 상태, 주간 퍼널, fallback 대조 API
**완료 기준**: 자체 폼과 아임웹 폼을 30일 병행해 누락/중복률을 계산할 수 있다.

#### 이번 결정

Phase3가 가장 파급력이 크다. 홈페이지 전체를 먼저 완성하는 것이 아니라, `광고 클릭 -> 랜딩 -> 상담 신청 -> 상담 상태 -> 방문 예약 -> 방문/결제 가능성`을 한 장부에 묶는 것이 우선이다.

첫 실험은 전체 사이트가 아니다. `/shop_view?idx=25` 성격의 이벤트/체험권 랜딩 1개와 자체 상담폼을 붙인다. `/59`는 2순위 fallback/비교 후보로 둔다.

#### 리드 상태값 정본 v1

2026-04-26 15:04 KST 기준 추천안 A가 승인됐다. 내부 상태 코드는 유지하고 화면 표시명을 `연락중`, `상담완료`, `예약확정`, `제외`로 바꾼다. 추천 자신감은 76%였다.

| 내부 상태 | 화면 표시 | 의미 |
|---|---|---|
| `new` | 신규 | 폼 제출 직후 |
| `contact_attempted` | 연락중 | 상담원이 전화/카톡 등으로 연락 시도했지만 상담이 아직 끝나지 않음 |
| `contacted` | 상담완료 | 통화/채팅으로 상담 목적과 다음 단계를 확인 |
| `reserved` | 예약확정 | 방문 날짜와 시간이 확정 |
| `visited` | 방문완료 | 실제 방문 |
| `paid` | 결제완료 | 센터 결제 또는 체험권 결제 |
| `no_show` | 노쇼 | 예약 후 미방문 |
| `invalid_duplicate` | 제외 | 테스트, 중복, 연락처 오류, 대상 아님, 장기 무응답 등 퍼널에서 뺄 리드 |

#### 2026-04-26 구현 상태

| 항목 | 구현 위치 | 상태 |
|---|---|---|
| 자체 리드 저장 API | `POST /api/aibio/native-leads` | 로컬 구현 완료 |
| 리드 목록 API | `GET /api/aibio/native-leads` | 로컬 구현 완료 |
| 상태 변경 API | `PATCH /api/aibio/native-leads/:leadId/status` | 로컬 구현 완료 |
| 원문 연락처 보호 API | `GET /api/aibio/native-leads/:leadId/contact` | `AIBIO_NATIVE_ADMIN_TOKEN` 필요 |
| 주간 퍼널 API | `GET /api/aibio/native-leads/funnel?days=7` | 로컬 구현 완료 |
| 아임웹 병행 대조 API | `GET /api/aibio/native-leads/fallback-comparison?rangeDays=30` | 로컬 구현 완료 |
| 아임웹 병행 대조 화면 | `frontend/src/app/aibio-native/admin/AibioNativeAdmin.tsx` | 운영자 화면 연결 완료 |
| 저장 테이블 | `aibio_native_leads`, `aibio_native_lead_status_log` | `backend/data/crm.sqlite3` local SQLite |
| 공개 폼 연결 | `frontend/src/app/aibio-native/AibioNativeExperience.tsx` | 실제 API 연결 |
| 운영자 리스트 연결 | `frontend/src/app/aibio-native/admin/AibioNativeAdmin.tsx` | API 연결 + 담당자/메모/예약일/방문일 저장 UI |

운영 기준은 아직 0%다. 위 구현은 로컬 개발 서버와 local SQLite 기준이다. 운영 배포, 접근권한, 상담원 프로세스, 30일 병행 리포트가 닫혀야 운영 기준 수치가 올라간다.

#### 저장 필드 v1

| 영역 | 저장값 | 현재 처리 |
|---|---|---|
| 개인정보 | 이름, 전화번호 원문, `phone_hash_sha256` | 원장은 원문 저장, 목록 API는 마스킹 |
| 상담정보 | 나이대, 상담 목적, 알게 된 경로, 연락 희망 시간 | 저장 |
| 동의 | 개인정보 동의, 마케팅 동의, 동의 시각 | 저장 |
| 유입 | landing path, referrer, UTM | 저장 |
| 광고키 | fbclid, gclid, `_fbc`, `_fbp`, `_ga` | 저장 |
| 운영상태 | lead status, 담당자, 메모, 예약/방문/결제 필드 | 상태/담당자/메모/예약/방문 저장 가능, 결제 필드 준비 |
| 중복방지 | phone hash + 최근 30일 | 중복 후보 자동 표시 |

#### 성공 기준 v1

| 항목 | Go 기준 |
|---|---|
| 자체 폼 정상 저장률 | 99% 이상 |
| 아임웹 대비 리드 누락률 | 3% 이하 |
| 중복 제거 가능률 | 95% 이상 |
| 운영자 처리 상태 입력률 | 80% 이상 |
| 광고 유입키 저장률 | Meta/Google 유입의 90% 이상 |
| 상담 후 예약 상태 기록률 | 70% 이상 |

#### 역할 구분

- TJ: 폼 필드 정본과 상담 상태 정의 승인
- Codex: lead/reservation API, attribution join, 개인정보 저장 정책, 중복 제거 로직
- Claude Code: 폼 UX, 모바일 CTA, 운영자 입력 화면

#### 실행 단계

1. [x] [Codex] lead schema v1을 확정했다 — 무엇: 이름, 전화번호, phone hash, 나이대, 상담 목적, 유입 경로, 동의, UTM, fbclid/gclid/fbc/fbp/ga를 저장 필드로 정의했다. 왜: 광고 클릭부터 상담 상태까지 같은 원장에 묶기 위해서다. 어떻게: `backend/src/aibioNativeLeadLedger.ts`에 SQLite 테이블과 insert mapping을 만들었다. 산출물: `aibio_native_leads`와 `aibio_native_lead_status_log`. 검증: backend typecheck와 API smoke 통과.
2. [x] [Codex] 자체 폼 DB 저장 API를 구현했다 — 무엇: `POST /api/aibio/native-leads`가 폼 제출을 local SQLite에 저장한다. 왜: mock/draft가 아니라 운영 데이터 전환의 시작점이 필요하기 때문이다. 어떻게: Express 7020 AIBIO route에 validation, phone hash, duplicate 후보 표시를 넣었다. 산출물: native lead 저장 API. 검증: 폼 제출 smoke에서 lead id가 반환된다.
3. [x] [Codex] 운영자 리드 리스트를 실제 API에 연결했다 — 무엇: `/aibio-native/admin` 화면이 mock 대신 `GET /api/aibio/native-leads`와 funnel API를 읽는다. 왜: 상담원이 실제 리드 목록을 봐야 아임웹 탈출 판단이 가능하기 때문이다. 어떻게: `AibioNativeAdmin.tsx`에서 목록, 상태 변경, 주간 퍼널을 API 기반으로 바꿨다. 산출물: 운영자 리드 화면. 검증: Playwright admin smoke 통과.
4. [x] [Codex] phone hash 기반 아임웹 fallback 대조 API와 운영자 화면을 연결했다 — 무엇: 30일 window에서 native lead와 아임웹 fallback 후보를 비교해 `/aibio-native/admin`에 표시한다. 왜: 자체 폼 누락률과 중복률을 숫자로 봐야 아임웹 입력폼을 줄일 수 있기 때문이다. 어떻게: `GET /api/aibio/native-leads/fallback-comparison?rangeDays=30` 결과의 counts/rates/source/freshness를 카드로 표시했다. 산출물: 병행 대조 API + 운영자 대조 카드. 검증: Playwright와 local API smoke 통과.
5. [x] [Codex] 운영자 리드 리스트에 담당자/메모/예약일/방문일 저장 UI를 붙였다 — 무엇: 리드 행에서 담당자, 메모, 예약일, 방문일을 입력하고 저장한다. 왜: 상담원이 실제로 쓰려면 “누가 처리 중인지”와 “다음 연락 내용”이 남아야 하기 때문이다. 어떻게: `PATCH /api/aibio/native-leads/:leadId/status`에 `assignedTo`, `memo`, `reservationAt`, `visitAt`를 함께 전송한다. 산출물: 운영 정보 저장 UI. 검증: Playwright payload 검증과 local PATCH smoke 통과.
6. [x] [TJ+Codex] 리드 상태값 추천안 A를 승인하고 반영한다 — 무엇: 신규, 연락중, 상담완료, 예약확정, 방문완료, 결제완료, 노쇼, 제외를 화면 표시명으로 쓴다. 왜: 상담원이 다음 행동을 쉽게 판단하고 주간 퍼널을 같은 기준으로 보기 위해서다. 어떻게: 내부 상태 코드는 유지하고 `AIBIO_NATIVE_STATUS_LABELS`와 admin 문구만 바꾼다. 산출물: 승인 기록 `imweb/aibio-lead-status-decision.md`, API/admin 표시명 업데이트. 검증: Playwright admin 테스트에서 `예약확정`과 토큰 header를 확인한다. 의존성: 승인완료.
7. [x] [Codex] 아임웹 입력폼 엑셀 분석 화면을 붙였다 — 무엇: `/aibio-native/admin/forms`에서 엑셀 업로드 후 컬럼, 행수, 동의, 중복 연락처 hash, 상담 목적/경로/상담 유형 집계를 본다. 왜: 기존 아임웹 폼과 자체 폼 필드가 다르면 30일 병행 대조가 왜곡되기 때문이다. 어떻게: `POST /api/aibio/admin/form-export/analyze`가 엑셀을 메모리에서 분석하고 원문 PII 없이 집계만 반환한다. 산출물: 입력폼 분석 화면과 `imweb/aibio-form-export-analysis-20260426.md`. 검증: Playwright 업로드 테스트.
8. [Claude Code] 모바일 고정 CTA와 폼 화면 구성을 리뷰한다 — 무엇: 모바일 하단 CTA, 전화번호 입력, 개인정보 동의, 에러/성공 문구를 점검한다. 왜: 광고 유입 사용자가 모바일에서 폼을 끝까지 제출해야 리드 원장이 쌓인다. 어떻게: `/aibio-native`와 첫 실험 랜딩 screenshot을 기준으로 UX 문제를 표시한다. 산출물: UX 수정 제안과 우선순위. 검증: CTA는 첫 화면 또는 고정 영역에서 보이고 입력 오류는 사용자가 이해할 수 있어야 한다. 의존성: 병렬가능.
9. [Codex] `/shop_view?idx=25` 성격의 고유입 랜딩 1개를 팀 리뷰 이후 자체 폼으로 병행 운영한다 — 무엇: 첫 실험 랜딩의 CTA가 자체 native lead API로 저장되게 하되, 30일 병행 운영 시작은 기능 리뷰 후로 미룬다. 왜: 상담원과 운영팀이 사용법을 모르는 상태에서 병행 지표를 시작하면 상태 입력률과 누락률 판단이 왜곡되기 때문이다. 어떻게: 2~3일 뒤 팀 리뷰에서 `/admin`, `/forms`, `/content`, `/access`를 설명하고 수정 요청을 반영한 뒤 시작일을 정한다. 산출물: 자체 랜딩 1개와 병행 리포트. 검증: 30일간 정상 저장률 99% 이상, 누락률 3% 이하를 본다. 의존성: 팀 리뷰/운영 배포 승인.
9. [x] [Codex] 자체 관리자 token 방식을 구현한다 — 무엇: `AIBIO_NATIVE_ADMIN_TOKEN`을 우리 자체 AIBIO 관리자 API의 보호 토큰으로 쓴다. 왜: 상태 변경과 원문 연락처 조회는 개인정보와 운영 데이터 변경이라 공개 API처럼 열면 안 되기 때문이다. 어떻게: 백엔드는 서버 secret의 token과 `x-admin-token` 헤더를 비교하고, admin 화면은 브라우저 sessionStorage에만 토큰을 저장해 PATCH 때 헤더로 보낸다. 산출물: `.env.example` 안내, admin token UI, Playwright header 검증. 검증: token 없는 운영 환경에서는 403, token 입력 후 status PATCH header 포함.

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

1. [Codex] 아임웹 통계 대체 지표 v1을 정의한다 — 무엇: 방문자, 인기 페이지, 유입 도메인, 폼 전환, 예약/방문/결제 전환을 주간 지표로 고정한다. 왜: 아임웹 관리자 화면의 모든 통계를 복제하지 않고 AIBIO 매출 판단에 필요한 값만 보기 위해서다. 어떻게: 첨부 통계 화면, native lead funnel API, 기존 attribution ledger를 비교한다. 산출물: 주간 지표 정의표. 검증: 각 지표에 source, window, freshness, confidence가 붙는다.
2. [Codex] GA4/서버 이벤트/attribution ledger 조인 기준을 작성한다 — 무엇: PageView, form submit, CTA click, native lead, fallback lead를 같은 landing path와 client key로 묶는다. 왜: “리드 수”가 아니라 어떤 유입이 예약/방문 가능성을 만들었는지 봐야 하기 때문이다. 어떻게: `_ga`, `_fbp`, `_fbc`, UTM, referrer, landing path 우선순위를 정한다. 산출물: attribution join rule v1. 검증: 조인 실패 사유가 unknown으로 뭉개지지 않고 reason code로 남는다.
3. [Claude Code] 운영자용 간단 통계 화면을 설계한다 — 무엇: 유입, 인기 페이지, 리드 상태 퍼널, 누락률, 광고키 저장률을 한 화면에 배치한다. 왜: 상담 운영자가 매주 볼 화면은 작고 반복 사용 가능해야 하기 때문이다. 어떻게: `/aibio-native/admin`의 funnel 영역을 확장하거나 별도 tab으로 분리하는 UX를 제안한다. 산출물: dashboard wireframe 또는 구현 PR. 검증: 1366px와 모바일 폭에서 표가 깨지지 않는다. 의존성: 병렬가능.
4. [TJ] 첫방문 오퍼 정책을 승인한다 — 무엇: 쿠폰 전체 복제가 아니라 첫방문 혜택 코드 1개를 정한다. 왜: 아임웹 쿠폰 시스템 전체를 만들기보다 리드->방문 전환을 보는 작은 오퍼가 먼저 필요하기 때문이다. 어떻게: 혜택명, 적용 대상, 유효기간, 상담원이 말할 문구를 승인한다. 산출물: 오퍼 코드 v1. 검증: 혜택 조건이 랜딩/상담 스크립트/운영자 메모에서 동일하게 쓰인다. 의존성: 부분병렬.
5. [Codex] 랜딩 A/B 테스트 최소 기능을 설계한다 — 무엇: 첫 실험 랜딩의 hero/CTA 문구 2안을 사용자 단위로 고정 배정한다. 왜: 단순 방문 수가 아니라 어떤 문구가 좋은 리드를 만드는지 보기 위해서다. 어떻게: cookie 또는 server assignment key로 variant를 저장하고 native lead에 variant를 함께 저장한다. 산출물: A/B assignment 설계. 검증: 같은 브라우저가 새로고침해도 같은 variant를 본다. 의존성: 부분병렬.

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

1. [Codex] test key 기준 order/payment schema와 confirm API를 만든다 — 무엇: 예약금 또는 체험권 1개에 대해 order draft, amount, customer key, lead id, payment status를 저장한다. 왜: Toss 결제가 붙어도 어떤 리드가 결제했는지 잃지 않기 위해서다. 어떻게: 기존 `backend/src/routes/toss.ts`와 `backend/src/tossConfig.ts` 패턴을 참고해 AIBIO store 분기를 설계한다. 산출물: 결제 draft API와 confirm API 초안. 검증: test key에서 금액 변조가 400으로 막힌다.
2. [Claude Code] checkout/success/fail 화면을 구현한다 — 무엇: 예약금/체험권 checkout, 결제 성공, 결제 실패 화면을 만든다. 왜: 사용자가 결제 완료 여부와 다음 방문 절차를 알아야 이탈과 CS를 줄일 수 있다. 어떻게: Toss payment widget의 success/fail redirect를 Next.js route에 연결한다. 산출물: checkout UI 3종. 검증: 실패 화면에 재시도와 상담 CTA가 보인다. 의존성: 병렬가능.
3. [TJ] AIBIO Toss 계약/MID/API key를 확인한다 — 무엇: AIBIO 전용 MID, client key, secret key, 결제수단 허용 범위를 확인한다. 왜: Toss 관리자 계정과 live key 확인은 2FA 또는 관리자 권한이 필요한 외부 계정 작업이다. 어떻게: Toss Payments 관리자에서 상점 정보와 API 키를 확인하고 secret은 안전한 채널로만 전달한다. 산출물: live/test key 보유 여부와 결제수단 목록. 검증: secret 값은 문서와 git에 남지 않는다. 의존성: 선행필수.
4. [Codex] live key 환경변수와 소액 결제 검증을 진행한다 — 무엇: 운영 env에 AIBIO Toss key를 연결하고 소액 live 결제를 1건 테스트한다. 왜: test key 통과만으로는 실제 정산, webhook, 실패 처리를 검증할 수 없기 때문이다. 어떻게: 환경변수 적용 후 checkout->success->confirm->webhook->reconcile 순서로 확인한다. 산출물: live smoke 로그와 결제 id. 검증: 결제 금액, order id, lead id가 모두 일치한다. 의존성: 선행필수.
5. [Codex] Toss 거래/정산 조회와 자체 payments daily reconcile을 만든다 — 무엇: Toss 거래 원본과 자체 payment table을 날짜별로 대조한다. 왜: 결제 성공 화면만 믿으면 누락·부분취소·수수료 차이를 놓친다. 어떻게: 기존 Toss 조회 route를 AIBIO store로 확장하고 daily reconcile summary를 만든다. 산출물: 일별 대조 리포트. 검증: 거래 수, 총액, 취소액, 미조인 건수가 표시된다.

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

1. [Codex] 운영 역할 정의를 만든다 — 무엇: admin, manager, marketer, viewer의 권한 범위를 리드 원문 연락처, 상태 변경, 결제 조회, 통계 조회 기준으로 나눈다. 왜: 첨부 고객 목록처럼 개인정보가 있는 화면은 권한이 없으면 운영 리스크가 크기 때문이다. 어떻게: 현재 `AIBIO_NATIVE_ADMIN_TOKEN` 임시 보호를 정식 RBAC 모델로 분해한다. 산출물: role permission matrix. 검증: 각 API가 최소 1개 role과 연결된다.
2. [Codex] `@Roles`와 `@SiteAccess('aibio')` guard 적용 범위를 설계한다 — 무엇: NestJS로 갈 경우 controller 단위 권한 데코레이터 적용 지점을 정한다. 왜: route마다 if문으로 권한을 검사하면 빠뜨린 endpoint가 보안 구멍이 된다. 어떻게: AIBIO lead, reservation, payment, stats controller 후보별 guard를 표로 만든다. 산출물: guard 적용표. 검증: 개인정보 원문 조회 API는 viewer/marketer 권한에서 제외된다.
3. [x] [Codex] 운영자 리스트에 실사용 입력 영역을 붙였다 — 무엇: 리드 목록 행에 상태 변경, 담당자, 메모, 예약일, 방문일 저장 영역을 추가했다. 왜: 한 화면에서 상담 인수인계와 다음 액션을 남겨야 실제 운영자가 쓸 수 있기 때문이다. 어떻게: `/aibio-native/admin`에서 `PATCH /api/aibio/native-leads/:leadId/status`를 호출한다. 산출물: 운영 정보 저장 UI. 검증: Playwright payload 검증과 local PATCH smoke 통과.
4. [x] [Codex] 관리자 권한 명부 초안을 만들었다 — 무엇: `/aibio-native/admin/access`에서 owner, manager, marketer, designer, viewer 역할과 운영자 명부를 편집한다. 왜: 상담원, 마케터, 디자이너가 같은 관리자 토큰을 쓰더라도 어떤 권한 체계로 분리할지 먼저 정해야 정식 로그인으로 넘어갈 수 있기 때문이다. 어떻게: DB 스키마 변경 없이 `backend/data/aibio-native-access.json` 파일 저장 API를 만들었다. 산출물: access GET/PUT API, 역할 기준표 화면. 검증: backend/frontend typecheck와 화면 smoke.
5. [Claude Code] 운영자 리스트/상세 화면 UX를 추가 리뷰한다 — 무엇: 현재 표 기반 입력 UI를 상담원이 반복 사용하기 쉬운 상세 패널 또는 drawer 구조로 개선할지 본다. 왜: 한 화면에 개인정보와 운영 메모가 섞이면 상담원이 실수하기 쉽다. 어떻게: `/aibio-native/admin` 실제 screenshot을 기준으로 리스트/상세 패널 구조를 제안한다. 산출물: admin UX 수정안. 검증: 원문 연락처는 명시적 클릭과 권한 확인 후에만 보인다. 의존성: 병렬가능.
6. [TJ] 실제 운영진 계정과 역할을 확정한다 — 무엇: 운영자별 이메일, 역할, 개인정보 접근 가능 여부를 승인한다. 왜: 계정 부여와 개인정보 접근은 회사 운영·보안 판단이 필요한 TJ-only 작업이다. 어떻게: 상담원, 마케터, 관리자 명단을 role permission matrix에 맞춰 표시한다. 산출물: 운영 계정 승인표. 검증: 퇴사자/외부 계정이 포함되지 않는다. 의존성: 선행필수.
7. [Codex] audit log와 권한 회귀 테스트를 작성한다 — 무엇: 원문 연락처 조회, 상태 변경, 결제 조회에 actor, timestamp, action, lead id를 남긴다. 왜: 개인정보 접근과 상태 변경은 나중에 문제 추적이 가능해야 한다. 어떻게: API middleware 또는 service layer에서 audit event를 기록하고 unauthorized 케이스 테스트를 만든다. 산출물: audit log table/API test. 검증: 권한 없는 token은 401/403, 권한 있는 token은 audit row를 남긴다. 의존성: 부분병렬.

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

1. [Codex] 자체 사이트와 아임웹 fallback 30일 병행 지표를 정의한다 — 무엇: native lead count, fallback lead count, duplicate rate, missing rate, status input rate, ad key capture rate를 고정한다. 왜: 아임웹 종료는 느낌이 아니라 누락·중복·운영 처리율 숫자로 판단해야 하기 때문이다. 어떻게: native lead API, fallback comparison API, 아임웹 CSV export를 같은 30일 window로 맞춘다. 산출물: 병행 리포트 지표표. 검증: 모든 숫자에 source, 기준시각, window, confidence가 붙는다. 시작 조건: 최소 기능이 워킹되고, 2~3일 뒤 팀 리뷰에서 기능/사용법 설명을 끝낸 뒤 시작한다.
2. [Codex] 기존 URL별 301 redirect map을 작성한다 — 무엇: `/shop_view?idx=25`, `/59`, `/main`, `/bio_pulse_M`, `/56`과 주요 SEO URL의 새 목적지를 정한다. 왜: 검색/광고/외부 링크 유입을 잃지 않기 위해서다. 어떻게: 아임웹 인기 페이지, Search Console 후보, 현재 route mapping을 대조한다. 산출물: redirect map v1. 검증: 각 URL에 old URL, new URL, 처리 방식, fallback 여부가 있다.
3. [Claude Code] fallback/maintenance 화면을 작성한다 — 무엇: 자체 폼 장애, 결제 장애, 아임웹 fallback 이동 시 보여줄 안내 화면을 만든다. 왜: 전환 중 장애가 나도 리드 접수 자체는 놓치면 안 되기 때문이다. 어떻게: CTA는 전화/카카오/아임웹 fallback 중 하나를 명확히 제공한다. 산출물: fallback UI. 검증: 모바일에서 첫 화면 안에 대체 연락 수단이 보인다. 의존성: 병렬가능.
4. [TJ] 30일 리포트를 확인하고 종료/유지 여부를 승인한다 — 무엇: 자체 폼 저장률, 누락률, 중복률, 상태 입력률, 상담원 피드백을 보고 Go/No-Go를 결정한다. 왜: 운영 종료는 사업·운영 판단이라 자동화할 수 없다. 어떻게: 30일 리포트 표에서 Go 기준 충족 여부를 확인한다. 산출물: 아임웹 유지/축소/종료 결정. 검증: 결정일, 기준 window, 예외 조건이 문서에 남는다. 의존성: 선행필수.
5. [Codex] 승인 후 redirect와 sitemap을 운영 반영한다 — 무엇: 승인된 URL map을 배포 설정, sitemap, canonical, Search Console 점검표에 반영한다. 왜: 아임웹 종료 후 SEO와 광고 랜딩이 새 사이트로 안정적으로 넘어와야 하기 때문이다. 어떻게: redirect 설정 적용 전 staging에서 curl로 status/location을 확인하고 운영 반영 후 재검사한다. 산출물: redirect 운영 반영 로그와 Search Console 체크리스트. 검증: 주요 URL이 301 또는 의도한 fallback으로 응답한다. 의존성: 선행필수.

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

초기에는 로컬/개발 DB에서 검증하고, 운영 DB 스키마 변경은 승인 후 진행한다. 2026-04-26 11:00 KST 기준 실제 구현은 `backend/data/crm.sqlite3` local SQLite에 `aibio_native_leads`, `aibio_native_lead_status_log`를 자동 생성하는 방식이다. 아래 모델은 AIBIO 예약금/체험권 결제용 초안이며, 범용 쇼핑몰 모델이 아니다.

현재 구현된 local table:

| 테이블 | 역할 | 운영 DB 반영 |
|---|---|---|
| `aibio_native_leads` | 자체 상담폼 제출, 유입키, 상태, 중복 후보, 예약/방문/결제 필드 | 미반영 |
| `aibio_native_lead_status_log` | 상태 변경 이력 | 미반영 |

운영 DB로 올릴 때는 원문 전화번호 암호화, RBAC, 감사로그, backup/restore 절차를 먼저 확정한다.

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

1. `/shop_view?idx=25` 성격의 이벤트/체험권 랜딩 1개를 자체 폼으로 병행 운영한다.
   - 기존 아임웹 URL은 유지
   - 광고/내부 테스트 트래픽 일부만 자체 랜딩으로 보냄
   - 30일 동안 native lead와 아임웹 fallback을 대조
2. 운영자 사용 플로우를 고정한다.
   - 누가 신규 리드를 보는가
   - 몇 분 안에 연락하는가
   - 상태값을 언제 바꾸는가
   - 원문 전화번호 접근 권한을 누가 갖는가
3. AIBIO 기능 인벤토리 보강
   - 아임웹 관리자 페이지 목록 export 또는 sitemap
   - 입력폼 CSV export 샘플
   - CTA 링크 전체 목록
   - 네이버 예약/플레이스 사용 여부
   - 현재 삽입 코드 정본 재확인
4. NestJS skeleton 병행 여부 승인
   - 적용 범위 문서: `imweb/aibio-nestjs-skeleton.md`
   - Codex 추천: `YES: NestJS skeleton 병행`
   - 단기 원칙: 리드 원장과 팀 리뷰용 관리자 API는 기존 Express 7020 유지
   - 신규 원칙: 정식 로그인/RBAC/감사로그/Toss confirm/webhook은 NestJS-first
5. Toss 단일 checkout 기술 스파이크
   - test key
   - order draft
   - payment widget
   - confirm
   - webhook
6. AIBIO 아임웹 기존 URL -> 자체 URL 301 redirect 계획 수립
7. 바이오컴/더클린커피는 별도 검토 일정으로 분리

## 16. 개발 진행 기록

### 2026-04-26 09:08 KST

우리 기준 개발을 시작했다. 운영 DB, 운영 배포, 아임웹 관리자 설정은 건드리지 않았다.

| 항목 | 결과 | 운영 반영 |
|---|---|---|
| AIBIO 자체 홈페이지 MVP route | `frontend/src/app/aibio-native/page.tsx` 추가 | 미반영 |
| 공개 화면 컴포넌트 | `frontend/src/app/aibio-native/AibioNativeExperience.tsx` 추가 | 미반영 |
| 리드 draft API | `frontend/src/app/api/aibio-native/lead-draft/route.ts` 추가. 원문 전화번호는 응답하지 않고 SHA-256 hash만 반환 | 미반영 |
| API 계약 분리 | `frontend/src/lib/aibio-native.ts` 추가 | 미반영 |
| 유입 키 수집 | URL UTM, `fbclid`, `gclid`, `_fbc`, `_fbp`, `_ga`, referrer key 수집. API 응답은 key 목록만 반환 | 미반영 |
| redirect map 초안 | `imweb/aibio-redirect-map.md` 추가 | 미반영 |
| 운영자 리드 관리자 mock | `frontend/src/app/aibio-native/admin/page.tsx`, `frontend/src/app/aibio-native/admin/AibioNativeAdmin.tsx` 추가 | 미반영 |
| 자동 검증 | `frontend/tests/aibio-native.spec.ts` 추가 | 로컬 검증 완료 |
| 화면 검증 | Playwright desktop/mobile screenshot 생성 | 로컬 검증 완료 |

검증 결과:

- `npm --prefix frontend run lint -- src/app/aibio-native/page.tsx src/app/aibio-native/AibioNativeExperience.tsx src/app/aibio-native/admin/page.tsx src/app/aibio-native/admin/AibioNativeAdmin.tsx src/app/api/aibio-native/lead-draft/route.ts src/lib/aibio-native.ts tests/aibio-native.spec.ts`: 통과
- `cd frontend && npx tsc --noEmit --pretty false --incremental false`: 통과
- `PLAYWRIGHT_BASE_URL=http://localhost:7011 npx playwright test tests/aibio-native.spec.ts --reporter=list`: 3 passed

현재 의미:

- Phase2-Sprint3은 홈페이지/랜딩의 첫 구현물이 생겼으므로 `40% / 0%`로 올린다.
- Phase3-Sprint4는 실제 DB 저장 전 단계의 lead draft API, attribution key 수집, 폼 검증이 생겼으므로 `35% / 0%`로 올린다.
- Phase6-Sprint7은 운영자 관리자 mock이 생겼으므로 `10% / 0%`로 올린다.
- 운영 기준은 아직 0%다. 이유는 아임웹 redirect, 운영 DB 저장, GTM/GA4/CAPI 연결, 실운영 상담 프로세스가 아직 붙지 않았기 때문이다.

다음 개발 순서:

1. lead draft API 응답을 NestJS 또는 Express native API 계약으로 옮긴다.
2. AIBIO 인기 URL `/shop_view`, `/main`, `/bio_pulse_M`, `/56`, `/59` redirect map을 아임웹 export와 대조한다.
3. 자체 관리자용 리드 리스트 mock을 실제 lead draft API 응답과 연결한다.
4. 운영 DB 스키마 변경은 TJ님 승인 전에는 하지 않는다.

### 2026-04-26 11:00 KST

Phase3를 우선순위 1번으로 재정렬하고, mock/draft 단계였던 자체 리드 폼을 local SQLite 원장 저장 단계로 올렸다. 운영 DB, 운영 배포, 아임웹 관리자 설정은 건드리지 않았다.

| 항목 | 결과 | 운영 반영 |
|---|---|---|
| 자체 리드 원장 모듈 | `backend/src/aibioNativeLeadLedger.ts` 추가 | 미반영 |
| 리드 저장 API | `POST /api/aibio/native-leads` 추가. 이름/전화번호는 서버 원장에 저장하고 응답에는 원문을 반환하지 않음 | 미반영 |
| 리드 목록 API | `GET /api/aibio/native-leads` 추가. 운영자 화면용 마스킹 목록 반환 | 미반영 |
| 상태 변경 API | `PATCH /api/aibio/native-leads/:leadId/status` 추가 | 미반영 |
| 원문 연락처 보호 | `GET /api/aibio/native-leads/:leadId/contact` 추가. `AIBIO_NATIVE_ADMIN_TOKEN` 필요 | 미반영 |
| 주간 퍼널 API | `GET /api/aibio/native-leads/funnel?days=7` 추가 | 미반영 |
| 아임웹 병행 대조 API | `GET /api/aibio/native-leads/fallback-comparison?rangeDays=30` 추가 | 미반영 |
| 공개 폼 연결 | `/aibio-native` 폼이 `lead-draft`가 아니라 native lead API로 저장 | 미반영 |
| 운영자 리스트 연결 | `/aibio-native/admin` mock 제거, 실제 API 목록과 주간 퍼널 표시 | 미반영 |
| 첫 실험 랜딩 | `/shop_view?idx=25` 성격의 이벤트/체험권 랜딩 1개로 결정 | 운영 승인 전 |

현재 의미:

- Phase3-Sprint4는 `65% / 0%`로 올린다. 저장 API, 중복 감지, 상태값, 주간 퍼널, fallback 대조 API가 생겼다.
- Phase4-Sprint5는 `20% / 0%`로 올린다. 최소 주간 퍼널과 유입키 저장률이 생겼다.
- Phase6-Sprint7은 `35% / 0%`로 올린다. 운영자 mock이 실제 API 화면으로 바뀌었다.
- 운영 기준은 아직 0%다. 이유는 운영 배포, 권한, 상담원 사용, 아임웹 30일 병행 대조가 아직 남았기 때문이다.

검증 결과:

- `npm --prefix backend run typecheck`: 통과
- `cd frontend && npx tsc --noEmit --pretty false --incremental false`: 통과
- `npm --prefix frontend run lint -- src/app/aibio-native/page.tsx src/app/aibio-native/AibioNativeExperience.tsx src/app/aibio-native/admin/page.tsx src/app/aibio-native/admin/AibioNativeAdmin.tsx src/app/api/aibio-native/lead-draft/route.ts src/lib/aibio-native.ts tests/aibio-native.spec.ts`: 통과
- `PORT=7021 CRM_LOCAL_DB_PATH=.codex-backups/.../aibio-native-smoke.sqlite3 npx tsx src/server.ts` 후 API 스모크: 저장, 목록 마스킹, 상태 변경, 주간 퍼널, fallback 대조 통과
- `PLAYWRIGHT_BASE_URL=http://localhost:7011 npx playwright test tests/aibio-native.spec.ts --reporter=list`: 3 passed
- `python3 scripts/validate_wiki_links.py imweb/!imwebplan.md`: 통과

다음 개발 순서:

1. `/shop_view?idx=25` 성격의 고유입 랜딩 1개를 자체 폼으로 병행 운영한다.
2. 운영자 원문 연락처 조회와 상태 변경에는 정식 auth/RBAC 또는 최소 `AIBIO_NATIVE_ADMIN_TOKEN`을 설정한다.
3. 30일 동안 `/api/aibio/native-leads/fallback-comparison` 결과를 저장해 누락률과 중복률을 본다.
4. 운영 DB 이관은 원문 전화번호 암호화, 감사로그, backup/restore 절차를 승인받은 뒤 진행한다.

### 2026-04-26 12:26 KST

다음 할일 1번을 처리했다. `/shop_view?idx=25` 성격의 고유입 이벤트/체험권 랜딩을 자체 Next.js route로 만들고, 기존 native lead 저장 API에 연결했다. 운영 배포나 아임웹 redirect는 아직 건드리지 않았다.

| 항목 | 결과 | 운영 반영 |
|---|---|---|
| 첫 실험 route | `frontend/src/app/shop_view/page.tsx` 추가. `http://localhost:7010/shop_view?idx=25` 응답 200 | 미반영 |
| 랜딩 UI | `RecoveryLabOfferLanding.tsx` 추가. hero, CTA, 프로그램, 흐름, 측정 설명, 상담 신청 폼 구성 | 미반영 |
| 폼 재사용 | 기존 `/aibio-native` 폼 로직을 `AibioNativeLeadForm.tsx`로 분리해 신규 랜딩과 공유 | 미반영 |
| 유입 저장 | landing path가 `/shop_view?idx=25...`로 native lead API에 저장됨 | 로컬 SQLite 기준 |
| 테스트 | `tests/aibio-native.spec.ts`에 `/shop_view?idx=25` 저장 테스트 추가 | 미반영 |

현재 의미:

- Phase2-Sprint3은 `55% / 0%`로 올린다. 고유입 랜딩 1개가 실제 route로 생겼고, native lead API 저장까지 검증했다.
- Phase3-Sprint4는 `65% / 0%` 유지다. 원장 저장 API는 이미 있었고, 이번 작업은 그 API를 첫 실험 랜딩에 연결한 것이다.
- 운영 기준은 아직 0%다. 이유는 운영 도메인 배포, 아임웹 redirect, GTM/GA4/CAPI 운영 연결, 아임웹 30일 병행 대조가 아직 남았기 때문이다.

검증 결과:

- `cd frontend && npx tsc --noEmit --pretty false`: 통과
- `cd frontend && npx eslint src/app/aibio-native/AibioNativeExperience.tsx src/app/aibio-native/AibioNativeLeadForm.tsx src/app/shop_view/page.tsx src/app/shop_view/RecoveryLabOfferLanding.tsx tests/aibio-native.spec.ts`: 통과
- `cd frontend && npm run build`: 통과. `/shop_view` static route 생성 확인
- `curl http://localhost:7010/shop_view?idx=25`: 200
- `cd frontend && npx playwright test tests/aibio-native.spec.ts --reporter=list`: 4 passed
- `cd frontend && npx playwright screenshot .../shop_view?idx=25 ...`: desktop/mobile screenshot 생성
- `POST http://localhost:7020/api/aibio/native-leads`: local SQLite 저장 smoke 통과. 테스트 lead id `aibio_native_20260426032622838_fbdae8fe97_506e65e8`

다음 개발 순서:

1. 아임웹 병행 대조 리포트를 운영자 화면에서 볼 수 있게 만든다.
2. 운영자 리드 리스트에 담당자, 메모, 예약일, 방문일 저장 UI를 붙인다.
3. `/shop_view?idx=25` 운영 배포 전 GTM/GA4/CAPI event mapping을 확정한다.

### 2026-04-26 13:31 KST

다음 할일 2번과 3번을 처리했다. 운영자 화면에서 30일 아임웹 병행 대조 리포트를 보고, 각 리드에 담당자/메모/예약일/방문일을 저장할 수 있게 했다. 운영 DB나 프로덕션 배포는 건드리지 않았다.

| 항목 | 결과 | 운영 반영 |
|---|---|---|
| 30일 병행 대조 화면 | `/aibio-native/admin`에 native/fallback count, overlap, native only, fallback only, source, freshness 표시 | 미반영 |
| 운영 정보 저장 UI | 리드 행에서 담당자, 메모, 예약일, 방문일 입력 후 저장 | 미반영 |
| API 연결 | 기존 `PATCH /api/aibio/native-leads/:leadId/status`에 `assignedTo`, `memo`, `reservationAt`, `visitAt` 전송 | local SQLite 기준 |
| 테스트 | 운영자 화면 Playwright 테스트가 fallback 리포트 표시와 운영 정보 저장 payload를 검증 | 미반영 |
| local smoke | `fallback-comparison` API와 PATCH 저장을 7020에서 직접 확인 | local SQLite 기준 |

현재 의미:

- Phase3-Sprint4는 `75% / 0%`로 올린다. 리드 원장 저장, 상태 변경, 30일 fallback 대조, 운영 메모 저장까지 로컬에서 닫혔다.
- Phase6-Sprint7은 `45% / 0%`로 올린다. 아직 정식 로그인/RBAC/audit는 없지만 운영자가 쓸 최소 입력 화면은 생겼다.
- 운영 기준은 아직 0%다. 이유는 운영 배포, 운영 token/RBAC, 상담원 실사용, 30일 병행 리포트의 실제 기준일 확정이 남아 있기 때문이다.

검증 결과:

- `cd frontend && npx tsc --noEmit --pretty false`: 통과
- `cd frontend && npx eslint src/app/aibio-native/admin/AibioNativeAdmin.tsx tests/aibio-native.spec.ts`: 통과
- `cd frontend && npm run build`: 통과
- `cd frontend && npx playwright test tests/aibio-native.spec.ts --reporter=list`: 4 passed
- `GET http://localhost:7020/api/aibio/native-leads/fallback-comparison?rangeDays=30`: 200, native/fallback/source/window 반환
- `PATCH http://localhost:7020/api/aibio/native-leads/:leadId/status`: 담당자/메모/예약일/방문일 저장 smoke 통과
- `python3 scripts/validate_wiki_links.py imweb/!imwebplan.md`: 통과

다음 개발 순서:

1. 운영자 화면의 표 기반 입력을 상담원용 상세 패널/drawer로 다듬을지 결정한다.
2. `/shop_view?idx=25` 운영 배포 전 GTM/GA4/CAPI event mapping을 확정한다.
3. 30일 병행 운영 시작일과 Go/No-Go 기준을 TJ님이 확정한다.

### 2026-04-26 14:12 KST

Claude Code가 모바일 CTA와 폼 UX 리뷰를 끝내고 일부 수정했다. Codex는 클로드 변경분을 되돌리지 않고, 새 UX 기준으로 회귀 테스트와 TJ님 실행 체크리스트를 이어서 정리했다.

| 항목 | 결과 | 운영 반영 |
|---|---|---|
| 모바일 CTA | `/aibio-native`, `/shop_view?idx=25`에 모바일 하단 카카오 상담/상담 신청 고정 버튼 추가 | 미반영 |
| 폼 UX | 전화번호 자동 하이픈, 휴대폰 번호 검증, 필수 표시, 개인정보 동의 자세히, 사용자 친화 성공/실패 문구 추가 | 미반영 |
| 사용자용 내부 용어 제거 | 공개 폼 성공 문구에서 `리드 원장`, `유입 키`, `중복 후보` 노출 제거 | 미반영 |
| Codex 회귀 테스트 | 기존 Playwright 테스트를 새 문구와 모바일 CTA 기준으로 업데이트 | Playwright 5 passed |
| TJ님 실행 문서 | `imweb/aibio-tj-next-actions.md` 신규 작성. TJ/Codex/Claude Code 역할과 승인 순서를 분리 | 문서 반영 |

현재 의미:

- Phase2-Sprint3은 `60% / 0%`로 올린다. 첫 랜딩 자체화에 모바일 전환 CTA와 UX 개선이 붙었다.
- Phase3-Sprint4는 `78% / 0%`로 올린다. 리드 원장 자체는 이미 저장되고, 이번에는 폼 제출 이탈을 줄이는 프론트 품질 기준이 추가됐다.
- 운영 기준은 아직 0%다. 이유는 운영 secret, 실제 상담원 상태값, 아임웹 export, 첫 실험 랜딩 노출 방식이 아직 확정되지 않았기 때문이다.

다음 개발 순서:

1. 완료: 프론트 build 후 7010 로컬 서버를 재시작했다.
2. 완료: Playwright로 `/aibio-native`, `/shop_view?idx=25`, `/aibio-native/admin` 흐름을 다시 확인했다.
3. 다음: TJ님은 `imweb/aibio-tj-next-actions.md`의 1~4번을 먼저 결정한다.

## 17. 근거와 참고

### 로컬 자료

- `AGENTS.md`
- `docurule.md`
- `imweb/aibio-admin-screenshots.md`
- `imweb/aibio-lead-status-decision.md`
- `imweb/aibio-mobile-cta-form-ux-review.md`
- `imweb/aibio-nestjs-skeleton.md`
- `imweb/aibio-tj-next-actions.md`
- `imwebapi.md`
- `tossapi.md`
- `tosskey.md`
- `localdb.md`
- `backend/src/aibioNativeLeadLedger.ts`
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
- `frontend/src/app/aibio-native/page.tsx`
- `frontend/src/app/aibio-native/AibioNativeExperience.tsx`
- `frontend/src/app/aibio-native/admin/page.tsx`
- `frontend/src/app/aibio-native/admin/AibioNativeAdmin.tsx`
- `frontend/src/app/api/aibio-native/lead-draft/route.ts`
- `frontend/src/lib/aibio-native.ts`
- `frontend/tests/aibio-native.spec.ts`
- `imweb/aibio-redirect-map.md`
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

## 18. 데이터 정확성 기록

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
| AIBIO native MVP 개발 | 로컬 코드와 Playwright 테스트 | 2026-04-26 09:08 KST | 로컬 dev server 7011 | aibio | 높음 | 높음, 운영 미반영 |
| AIBIO native lead ledger | `backend/src/aibioNativeLeadLedger.ts`, `backend/src/routes/aibio.ts` | 2026-04-26 11:00 KST | local SQLite `backend/data/crm.sqlite3` | aibio | 높음 | 높음, 운영 DB 미반영 |
| AIBIO NestJS skeleton 적용 범위 | `imweb/aibio-nestjs-skeleton.md`, `backend/src/routes/aibio.ts`, `backend/src/routes/toss.ts`, `backend/src/routes/attribution.ts` | 2026-04-26 23:55 KST | 로컬 코드 기준 | aibio | 높음 | 중상, TJ 플랫폼 방향 승인 필요 |
