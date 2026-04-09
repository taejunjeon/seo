# Revenue CRM/실험 로드맵 0327

기준일: 2026-03-27 (최종 업데이트: 2026-04-02 #19 — 3사이트 83,017명 consent 동기화 + Phase 3 실행 채널 거의 완성)
작성 근거:
- 로컬 코드베이스: `/Users/vibetj/coding/revenue/frontend`, `/Users/vibetj/coding/revenue/backend`
- 참고 문서: `/Users/vibetj/coding/seo/gptprofeedback_0327.md`, `/Users/vibetj/coding/seo/roadmap0226.md`, `/Users/vibetj/coding/seo/gptprofeedback0101.md`
- 운영 현황 메모: `/Users/vibetj/coding/revenue/project_structure.md`, `/Users/vibetj/coding/revenue/dbstatus.md`
- 운영 DB 점검: `/Users/vibetj/coding/seo/database0327.md`
- 상담 가치 분석: `/Users/vibetj/coding/seo/callprice.md`
- 알리고 API 명세: `/Users/vibetj/coding/seo/kakaoapi.md`

---

## Sprint 진행 현황 총괄

> Phase가 상위 목표, Sprint가 세부 실행 단위. 각 Sprint는 `Codex (백엔드/설계/API/계측)` 또는 `Claude Code (프론트/UXUI)` 중 하나에만 배정.

### Phase 0 — 구조 고정 · 데이터 계약

> 왜: 식별키/이벤트/리드/정책 온톨로지가 없으면 이후 모든 실험과 에이전트가 반쪽짜리
>
> **사용자 베네핏:**
> - **대표(TJ)**: CRM 운영자 화면 구조가 확정되어, 앞으로 만들어질 모든 화면이 어디에 어떤 형태로 들어가는지 한눈에 파악 가능
> - **운영팀**: `/crm`에 들어가면 후속 관리/실험/알림톡/결제 귀속이 한 곳에 정리되어, 업무별로 다른 도구를 찾아다닐 필요 없음
> - **개발팀**: customer_key 규칙과 이벤트 명세가 고정되어, 이후 개발에서 "이 고객이 저 고객과 같은 사람인지" 혼란 없음
> - **AI/데이터 운영팀**: lead, customer, claim, policy를 같은 이름으로 부르기 시작해 에이전트가 헛소리할 여지를 줄임

| Sprint          | 목표                                    | 담당                     | 완료   |
| --------------- | ------------------------------------- | ---------------------- | ---- |
| [P0-S1](#p0-s1) | customer_key 규칙 · 이벤트 명세서 · DB 스키마 초안 | Codex (백엔드/설계)         | 100% |
| [P0-S2](#p0-s2) | CRM 운영자 화면 IA · 와이어프레임                | Claude Code (프론트/UXUI) | 100%  |
| [P0-S3](#p0-s3) | lead/콘텐츠/정책 온톨로지 · agent-readiness 계약 | Codex (백엔드/설계) | 100% |

> **Claude Code**: P0-S2 완료. `/crm` 4탭 구조(후속 관리/실험 운영/알림톡 발송/결제 귀속), 실험 생성 폼, 전환 동기화 버튼, 알림톡 준비 상태 UI 모두 구현.
> **Codex 추가 반영**: `GET /api/crm/phase0-blueprint`에 `lead_id`, `lead_magnet_id`, `problem_cluster`, `consent_status`, `claim_review_status`, `agent_run_log` 계열 설계 응답 추가.

### Phase 1 — CRM 실험 원장 MVP

> 왜: control/treatment 배정 없이는 증분 판정(Incremental Gross Profit) 불가
>
> **사용자 베네핏:**
> - **대표(TJ)**: "상담사를 더 뽑아야 하나?"에 대해 감이 아닌 숫자로 판단 가능. treatment 그룹이 control보다 얼마나 더 샀는지 바로 확인
> - **운영팀**: 실험을 직접 만들고, 전환 동기화 버튼 하나로 주문 매칭 결과를 즉시 확인. "이 캠페인이 효과가 있었나?"를 더 이상 추측하지 않음
> - **마케터**: 메시지를 보낸 그룹 vs 안 보낸 그룹의 구매율/매출 차이를 실험 단위로 비교 가능

| Sprint            | 목표                                                     | 담당                     | 완료 (우리 / 운영) |
| ----------------- | ------------------------------------------------------ | ---------------------- | ------------ |
| [P1-S1](#p1-s1)   | 실험/배정/전환 테이블 구현 · 매핑 배치                                | Codex (백엔드/로컬 SQLite)  | 100% / 70%   |
| [P1-S1B](#p1-s1b) | lead profile/event/consent ledger · pre_purchase 실험 확장 | Codex (백엔드/설계)         | 100% / 40%   |
| [P1-S1A](#p1-s1a) | PG attribution 원장 · Toss API 연동 · 토스 조인 진단 · **live row + UTM 완성**        | Codex + Claude Code         | 100% / 85%    |
| [P1-S2](#p1-s2)   | 실험 목록/상세/KPI 화면 구현                                     | Claude Code (프론트/UXUI) | 100% / 70%   |

> **Phase 1 남은 작업**: ~~실제 고객 사이트에 receiver 연결~~ ✅ 완료(0402). 운영 DB cutover, 운영 재검증, 커피 Toss Secret Key 확보, ngrok→고정 endpoint 전환.

Phase 1 현재 상태 (0331 업데이트):
- **P1-S1 로컬 SQLite 전환 완료**: `REVENUE_API` 프록시 대신 `backend/data/crm.sqlite3`에 실험 데이터를 직접 관리. 운영 DB는 읽기만 함.
- **전환 자동 동기화**: `POST /api/crm-local/experiments/:key/sync-conversions`로 운영 DB 주문 데이터를 읽어 전환 로그에 자동 매핑
- **실데이터 검증 완료**: 실제 상담 고객 6명으로 실험 생성→배정→전환 동기화→variant별 결과 산출까지 end-to-end 동작 확인
- **P1-S1B lead ledger 추가**: `crm_lead_profile`, `crm_lead_event_log`, `crm_consent_log` 로컬 원장과 `GET/POST /api/crm-local/leads*` API 추가. `funnel_stage`, `asset_id`, `lead_magnet_id`를 실험 객체에 얹어 pre-purchase 실험도 같은 장부에서 다룸
- **P1-S1B hard gate 실행 코드 추가**: `crm_contact_policy_service.py`에서 `consent`, `claim review`, `quiet hours`, `cooldown`, `suppression`, `fallback`을 코드로 평가한다
- **P1-S2 화면 마감**: `/crm` 실험 운영 탭에서 실험 생성 폼, 전환 동기화 버튼, KPI 표, variant 비교 차트까지 동작
- **P1-S1A 진단 장치 준비 완료**: receiver, JSONL 원장, 토스 조인 진단, GA4 `(not set)` 일자 비교표, `live / replay / smoke` 구분 UI까지 구현 완료
- **P1-S1A replay 배선 점검 완료**: `POST /api/attribution/replay/toss`로 read-only `tb_sales_toss` 최근 승인 `5건`을 replay row로 적재했고, replay 기준 토스 조인율은 `5/5`
- **★ P1-S1A live row + UTM 추적 완성 (0402)**:
  - 더클린커피(thecleancoffee.com) 아임웹 푸터 코드로 **live row 3건** 적재 성공
  - `orderId` URL 파라미터 자동 추출 ✅
  - `paymentKey` referrer URL에서 자동 추출 ✅ (백엔드 referrer 파싱 구현)
  - `amount`, `orderCode`, `paymentCode` referrer에서 구조화 파싱 → `metadata.referrerPayment`
  - `source=thecleancoffee_imweb` metadata 보존 + 필터링 API 추가
  - **UTM 추적 완성**: `utmSource`, `utmMedium`, `utmCampaign`, `gclid` 정상 적재 (아임웹 자체 세션 `__bs_imweb_session` 활용)
  - **Cloudflare Tunnel** 도입: ngrok free 경고 페이지 문제 해결, `trycloudflare.com` 무료 터널로 CORS/시크릿 모드 정상 작동
  - 푸터 코드 V0.2: 아임웹 세션 1순위 + localStorage fallback 구조
- 남은 것: 운영 DB/운영 배포 반영, lead ledger 실데이터 적재, 커피 Toss Secret Key 확보(크로스 검증), 고정 endpoint 전환, 바이오컴 확장
- **Toss API 연동 완료 (0401)**: 라이브 키로 거래/정산 실조회 성공. `env.ts`에 등록, `/health`에서 `toss: { ready: true }`
- **Toss API 백엔드 라우트 구현 (0401)**: `routes/toss.ts` — 4개 엔드포인트:
  - `GET /api/toss/transactions` — 일별 거래내역
  - `GET /api/toss/settlements` — 정산내역 (수수료/정산금)
  - `GET /api/toss/payments/orders/{orderId}` — orderId로 결제 상세
  - `GET /api/toss/daily-summary` — 일별 요약 집계 (매출/수수료/카드/가상계좌)
- PG 수수료율 실측: **3.41~3.63%** (카드 기준, MID `iw_biocomo8tx`)

### Phase 2 — 상담 원장 정규화 · 상담사 가치

> 왜: 상담 데이터(8,305건)가 가장 풍부한 자산. 채용/운영 판단에 즉시 필요
>
> **사용자 베네핏:**
> - **대표(TJ)**: 상담사별 "상담 1건당 추정 가치"를 보고 채용/유지/교육 판단 가능. 상담사 충원 시 매출 시뮬레이션으로 투자 대비 효과 미리 확인
> - **상담 팀장**: 누가 전환을 잘 이끄는지, 어떤 검사 유형에서 상담 효과가 큰지 데이터로 파악. 상담 완료 후 미구매 고객 리스트로 바로 후속 액션
> - **운영팀**: 부재/변경 고객 재연락 대상을 매일 확인하여 놓치는 리드를 줄임

| Sprint          | 목표                                                                       | 담당          | 완료   |
| --------------- | ------------------------------------------------------------------------ | ----------- | ---- |
| [P2-S1](#p2-s1) | 상담 상태 표준화 · 전화번호 정규화 · consultation API 5개                               | Codex (백엔드/설계) | 100% |
| [P2-S2](#p2-s2) | callprice 백엔드 API 5개 (overview/managers/analysis-types/scenario/options) | Codex (백엔드/설계) | 100% |
| [P2-S3](#p2-s3) | `/callprice` 상담사 가치 분석 대시보드 프론트                                          | Claude Code (프론트/UXUI) | 100%  |
| [P2-S4](#p2-s4) | `/crm` CRM 관리 페이지 (후속 관리 대상 리스트)                                         | Claude Code (프론트/UXUI) | 100%  |
| [P2-S5](#p2-s5) | callprice 추가 UXUI (상품 믹스, 분포, 첫 구매일수)                                    | Claude Code (프론트/UXUI) | 100%   |

> **Claude Code 완료 (2026-04-01)**: P2-S3 분석유형별 BarChart 추가 완료. P2-S4 상태 배지 한글화(STATUS_LABELS) 완료. P2-S5 상품 믹스 파이차트 + 주문가치 분포 바차트 + 상태×상품 교차표 구현 완료. 상세: `Phase2.md` 참조.

### Phase 1.5 — AIBIO 리커버리랩 광고 최적화 (0402 신규)

> 왜: AIBIO 리커버리랩(강서구 마곡)은 현재 쇼핑몰 비노출, 입력폼(상담 접수)만 운영 중. 4월 안에 유료 광고로 50명 유입이 목표.
>
> **사용자 베네핏:**
> - **대표(TJ)**: 메타/구글/당근 3채널 광고의 CPL(리드당 비용)을 비교하고, 가장 효율 좋은 채널에 예산을 집중
> - **영업팀**: 메타 Lead Form → 24시간 내 전화 영업으로 체험 예약 전환율 극대화
> - **마케터**: GA4 `generate_lead` 전환 기반으로 Google Ads 자동 입찰 최적화 가능

| Sprint | 목표 | 담당 | 완료 |
|--------|------|------|------|
| [P1.5-S1](#p15-s1) | GTM 정리 + GA4 `generate_lead` 전환 설정 + 계측 확인 | TJ + Claude Code | 90% |
| [P1.5-S2](#p15-s2) | Meta 영상 광고 + Lead Form 캠페인 (홈페이지 외 별도 퍼널) | TJ (마케팅) | 0% |
| [P1.5-S3](#p15-s3) | Google Ads 검색 캠페인 (마곡/강서구 지역 키워드) | TJ (마케팅) | 0% |
| [P1.5-S4](#p15-s4) | 당근 비즈프로필 광고 운영 + 주간 수동 리포팅 | TJ (마케팅) | 진행중 |

> **P1.5-S1 현황 (0402)**: GTM-NM988QL 아임웹 교체 완료. Google Ads `AW-10976547519` 태그 확인. GA4 `generate_lead` 이벤트 태그 + 아임웹 폼 제출 트리거 생성/게시 완료. 남은 것: GA4 실시간 검증 + `generate_lead` 전환 표시.
>
> **4월 목표**: 메타(₩1~1.5M) + Google(₩0.6~0.9M) + 당근(₩0.3~0.6M) = 총 ₩1.9~3M으로 50명 유입.
>
> **Meta Lead Form 전략**: 영상 광고 → 인스턴트 폼(이름/연락처/관심사) → 전화 영업 리스트 → 24시간 내 전화 → 체험 예약. 홈페이지 방문 불필요.
>
> **당근 광고 API**: 없음. 수동 관리 필요. 주 1회 대시보드 스크린샷 + 스프레드시트 기록.
>
> 상세 문서: `seo/aibio/aibio.md`

### Phase 2.5 — 프리-구매 리드 마그넷 MVP

> 왜: 주문/상담 이후 CRM만으로는 acquisition와 CRM이 끊긴다. 익명 방문자를 식별 가능한 리드 자산으로 바꾸는 앞단이 따로 필요하다
>
> **사용자 베네핏:**
> - **대표(TJ)**: 광고/SEO/콘텐츠 유입을 그냥 흘려보내지 않고, 상담 후보와 첫 구매 후보로 전환되는 구조를 수치로 본다
> - **운영팀**: 리드 마그넷 결과를 바로 상담 우선순위와 후속 메시지 흐름에 연결할 수 있다
> - **마케터**: 다운로드 수가 아니라 `상담 예약률`, `첫 구매율`, `90일 순매출`로 리드 자산을 평가한다

| Sprint | 목표 | 담당 | 완료 |
|--------|------|------|------|
| [P2.5-S1](#p25-s1) | 리드 마그넷 ledger · 퀴즈 결과 저장 · consent/claim gate | Codex (백엔드/설계) | 10% |
| [P2.5-S2](#p25-s2) | 진단형 리드 마그넷 랜딩/결과 화면 | Claude Code (프론트/UXUI) | 0% |
| [P2.5-S3](#p25-s3) | 1호 자산 `3분 피로 원인 자가진단` 운영 실험 | Codex (설계) + Claude Code (프론트) | 0% |

> **이번 턴 판단**: 리드 마그넷은 PDF보다 `진단형 퀴즈`로 가는 것이 맞다. 이유는 `problem_cluster`, `urgency_score`, `analysis_type_hint`를 구조화된 데이터로 바로 남길 수 있기 때문이다.

### Phase 3 — 실행 채널 연동 (채널톡 · 알리고)

> 왜: 첫 실험의 실행 채널. 채널톡은 이미 고객 사이트에서 사용 중, 알리고 senderKey 확보 완료
>
> **사용자 베네핏:**
> - **대표(TJ)**: CRM 대시보드에서 "이 고객에게 알림톡 보내기"까지 한 흐름으로 완결. 별도 도구 전환 없이 분석→판단→실행
> - **운영팀**: 후속 관리 대상 리스트에서 바로 알림톡 발송 가능. 채널톡 Campaign과 알리고 알림톡 중 상황에 맞는 채널 선택
> - **고객**: 상담 후 적절한 타이밍에 맞춤 영양제 추천/검사 안내를 받아 구매 결정에 도움

| Sprint          | 목표                                                 | 담당                     | 완료   |
| --------------- | -------------------------------------------------- | ---------------------- | ---- |
| [P3-S1](#p3-s1) | ChannelTalk SDK 래퍼 · identity/event 연동 · **Webhook** | Codex + Claude Code    | **95%**  |
| [P3-S2](#p3-s2) | ChannelTalk 프론트 래퍼 (boot/setPage/track/updateUser) | Claude Code (프론트/UXUI) | 100% |
| [P3-S3](#p3-s3) | 알리고 알림톡/SMS 백엔드 전송 wrapper · 템플릿 관리               | Codex + Claude Code    | **100%** |
| [P3-S4](#p3-s4) | 알리고 알림톡 프론트 발송 UI (`/crm`에 통합)                     | Claude Code (프론트/UXUI) | 60%  |

> **Codex 이번 턴 반영**: Revenue 백엔드에 `GET /api/crm/channeltalk/sync-preview`, `POST /api/crm/channeltalk/sync-users`, `GET /api/crm/channeltalk/stale-users`, `POST /api/crm/channeltalk/campaign-preview` 추가. `crm_contact_policy_service.py`로 발송 hard gate 실행 코드 추가. SEO 백엔드에는 `GET /api/aligo/status|health|profiles|templates|quota|history`, `GET /api/aligo/history/:mid`, `POST /api/aligo/test-send` 추가.
>
> **★ Phase 3 핵심 병목 해소 (0402)**:
> - **ChannelTalk Webhook**: `POST /api/channeltalk/webhook` 구현 + desk.channel.io 등록 + **101건 실시간 수신 확인**. 실제 고객 7명(고승업/이은주/이예진/김영선/김다솜/김지은/김효미) 프로필+채팅 데이터 포착.
> - **Aligo 알림톡 live 1건**: `TV_6586`(분석 결과 소요 일정 안내) 카카오톡 수신 확인. `dormant=Y` 템플릿 2건 실패 → 활성 템플릿으로 성공. 45개 중 활성 18개/휴면 24개/반려 3개 현황 정리(`aligo.md`).
> - **Aligo SMS live 1건**: `POST /api/aligo/sms` 엔드포인트 신규 구현 + SMS 수신 확인.
> - ~~**남은 것**: consent 데이터 소스 확보~~ → **✅ 3사이트 83,017명 consent 동기화 완료 (0402)**. 아임웹 API v2로 바이오컴(69,681명) + 더클린커피(13,236명) + AIBIO(100명) 전원 적재. SMS 동의율 47.5%(39,440명), 전화번호 99.8%. contact policy 자동 연동 완료.
> - **남은 것**: 발송 UI 세그먼트 선택, 정보성/홍보성 분리 UI, 첫 operational live(상담 14일 미구매 → 알림톡).
>
> ~~**현재 운영 blocker**: ChannelTalk는 실제 고객 사이트 live 삽입이 남았고, Aligo는 IP whitelist가 닫힌 뒤 `history/:mid` 조회까지 성공했다. 지금 남은 핵심은 `승인 템플릿 본문/버튼`과 실제 발송 렌더링이 exact-match가 아니라는 점이다.~~
>
> **용어 정리**:
> - 첫 operational live: `상담 완료 후 14일 미구매` 시나리오를 실제 채널로 한 번 돌려 보는 것
> - 첫 gold-standard causal test: `checkout abandon holdout vs 6h/24h` 실험을 증분 기준으로 읽는 것
>
> **Claude Code (2026-04-01)**: P3-S2 ChannelTalk 프론트 래퍼 완성. P3-S3 Codex 보완 완료 — `POST /api/aligo/send` + `render-preview`. P3-S4 알림톡 발송 UI **60%** — 4-step 워크플로우(대상→템플릿→미리보기→발송), 2-column 레이아웃, gate 상태 배지. **남은 40%**: 세그먼트 선택, exact-match 연동, 스케줄링, 결과 통계, 타사 벤치마크.
>
> **ChannelTalk live 확인 (2026-04-01)**: biocom.kr에 ChannelTalk SDK가 **이미 풀 연동** 상태. 아임웹 내장 래퍼(`channel_plugin.js`)가 `ProductView`, `AddToCart`, `CheckoutBegin`, `CheckoutComplete`, `SignUp`, `AddToWish`, `ReviewSubmit`, `SurveySubmit` 8종 이벤트를 자동 추적 중. Plugin Key `0b565f40-...`, 채널 ID `129149`(바이오컴), Open API 정상. **데이터는 채널톡 서버에 쌓이고 있으나**, 우리 대시보드로의 export/분석 연동은 미완. Campaign(자동 메시지)이 설정되어 있는지는 `desk.channel.io` 운영자 대시보드에서 확인 필요. (`app.channel.io`는 고객용 채팅 위젯이므로 관리 기능 없음)
>
> **채널톡 이벤트 데이터 활용 가능성**: desk.channel.io 마케팅 메뉴에서 캠페인 생성하여 Checkout Abandon 메시지(CheckoutBegin 후 10분 내 CheckoutComplete 미발생 시 자동 메시지) 등 설정 가능. 현재 활용되지 않는 이유는 캠페인 미설정 + 대시보드 미연동. 이벤트 데이터는 Open API로 조회 불가(404) — Webhook 수신 서버가 필요함. 남은 것: desk.channel.io 웹훅 등록, Webhook 수신 서버 구축, memberHash 활성화(현재 켜면 안 됨 — 아임웹 래퍼가 memberHash 미전달하여 전 고객 채팅 버튼 소실).
>
> **발송 정책(contact policy) 구현 완료 (2026-04-01)**: Revenue의 `crm_contact_policy_service.py`(266줄)를 SEO 백엔드에 TypeScript로 이식. `POST /api/contact-policy/evaluate`로 8가지 규칙(수신동의/문구검토/야간/쿨다운/빈도/최근구매/최근상담/연락처) 판단. **최고관리자 강제 발송(adminOverride)**: consent/claimReview 차단을 우회하여 발송 가능. 야간/쿨다운/빈도/구매 규칙은 admin이어도 우회 불가.
>
> **★ 수신 동의 상태 — 확보 완료 (0402)**: 아임웹 API v2(`/v2/member/members`)에서 `marketing_agree_sms`, `marketing_agree_email`, `third_party_agree` 필드 확인. 3사이트 83,017명 로컬 SQLite 동기화 완료. SMS 동의율 47.5%(39,440명). `POST /api/contact-policy/evaluate`에서 전화번호만 넣으면 consent 자동 판정.
>
> **추가 완료 (2026-04-01)**: exact-match 프론트 연동(render-preview API → PASS/FAIL 배지), 실험 카드 메타 배지(배정/전환/발송/동기화), variant alias(한글 표시명), 표본 부족 경고(30명 미만 시 주황 배지), 상단 pill 운영 용어화 완료. P3-S4 실질 완성도는 60%→약 75% 수준으로 상승.
>
> **추후 작업 — 색 의미 단순화**: CRM 페이지에 민트(탭)/보라(step)/파랑(outline)/초록(버튼) 색이 혼재. 파랑=행동, 초록=성공, 주황=경고, 빨강=실패, 회색=참고로 통일 필요. Phase 3 기능이 안정화된 후(P3-S4 80%+) CSS 디자인 토큰 정리와 함께 일괄 진행 예정.

### Phase 4 — 재구매 코호트 · 북극성 지표

> 왜: 회사 북극성 지표(90일 재구매 순이익) 추적의 기본 화면. 지금 내부 데이터만으로 즉시 시작 가능
>
> **사용자 베네핏:**
> - **대표(TJ)**: 회사의 건강 상태를 하나의 숫자(90일 재구매 순이익)로 매주 추적. "우리 충성고객이 실제로 돈을 남기고 있는가?"에 즉답
> - **전략팀**: 어느 월 코호트가 잘 남고 어느 월에 이탈하는지 히트맵으로 패턴 발견. 시즌성/프로모션 효과를 코호트 단위로 분리
> - **마케터**: 검사 유형별, 결제채널별로 재구매율이 다르다는 것을 확인하고 타깃팅 전략 수정

| Sprint | 목표 | 담당 | 완료 |
|--------|------|------|------|
| [P4-S1](#p4-s1) | 코호트 재구매율/순매출 API · 결제채널/상품 분해 | Codex (백엔드/설계) | 95% |
| [P4-S2](#p4-s2) | 코호트 히트맵/테이블 프론트 · 북극성 지표 카드 | Claude Code (프론트/UXUI) | 90% |

> **Claude Code 남은 작업**: P4-S2 마지막 10% — 월별 첫 구매 코호트 히트맵 (M+0, M+1, M+2...), 실험 라벨 오버레이. Codex P4-S1에서 코호트 전용 API가 라우트 등록되면 연결.

### Phase 5 — Meta 광고 데이터 연동

> 왜: 광고비 없이 iROAS 계산 불가. 이미 Meta 집행 중
>
> **사용자 베네핏:**
> - **대표(TJ)**: "이번 달 광고비 대비 실제 순이익이 얼마인가?"를 iROAS 한 숫자로 확인. 광고 예산 증감 판단 근거 확보
> - **마케터**: 캠페인/광고세트/소재별 성과를 한 화면에서 비교. 어떤 소재가 전환을 잘 이끄는지 데이터 기반으로 판단
> - **운영팀**: 광고 유입 → 상담 → 구매까지 퍼널이 연결되어, 광고와 CRM의 시너지를 수치로 확인

| Sprint | 목표 | 담당 | 완료 |
|--------|------|------|------|
| [P5-S1](#p5-s1) | Meta Ads Insights 읽기 · meta_campaign_daily 적재 | Codex (백엔드/설계) | 0% |
| [P5-S2](#p5-s2) | 캠페인/광고세트 성과 프론트 UI | Claude Code (프론트/UXUI) | 0% |
| [P5-S3](#p5-s3) | Meta Conversions API 서버사이드 전환 전송 | Codex (백엔드/설계) | 0% |

> **Claude Code 남은 작업**: P5-S2 캠페인/광고세트 성과 대시보드 전체. Codex P5-S1에서 `meta_campaign_daily` API가 완성되면 진행. 캠페인별 비용/노출/클릭/CPA 테이블 + 기간별 추이 차트.

### Phase 6 — 카카오 CRM 실행 레이어

> 왜: 한국 시장 리텐션 핵심 채널. 원장 완성 후 붙여야 의미 있음
>
> **사용자 베네핏:**
> - **대표(TJ)**: 한국 고객 도달률이 가장 높은 카카오톡으로 재구매/윈백 메시지 발송. 채널톡+알리고+카카오 3채널 체계 완성
> - **운영팀**: 대시보드에서 카카오 채널 친구 대상자를 미리보기하고, 동의 상태/실패 사유를 바로 확인
> - **고객**: 익숙한 카카오톡으로 검사 결과 안내, 영양제 추천, 리커버리랩 소식을 받아 자연스럽게 재방문

| Sprint | 목표 | 담당 | 완료 |
|--------|------|------|------|
| [P6-S1](#p6-s1) | 카카오 고객파일 export · 발송 로그 적재 | Codex (백엔드/설계) | 0% |
| [P6-S2](#p6-s2) | 발송 대상 미리보기 · 상태/실패 UI | Claude Code (프론트/UXUI) | 0% |

> **Claude Code 남은 작업**: P6-S2 카카오 발송 대상 미리보기, 발송 상태/실패 UI 전체. Codex P6-S1 완료 후 진행. P3-S4(알리고)와 UI 패턴 공유 가능.

### Phase 7 — 1차 증분 실험 라이브

> 왜: 실제 control/treatment 실험 → Incremental Gross Profit / iROAS 첫 산출
>
> **사용자 베네핏:**
> - **대표(TJ)**: "CRM 메시지가 실제로 추가 매출을 만들었는가?"에 처음으로 인과적 근거를 갖고 답변 가능. 경영 회의에서 데이터 기반 의사결정
> - **운영팀**: 체크아웃 이탈/미구매/윈백 등 시나리오별 실험을 직접 운영하고 결과를 실시간으로 확인. 효과 없는 시나리오는 빠르게 중단
> - **리커버리랩**: 서울 거주 고객에게 방문 쿠폰을 보내고, 실제 방문 전환과 후속 구매를 추적하여 오프라인 확장의 ROI를 처음으로 측정

| Sprint | 목표 | 담당 | 완료 |
|--------|------|------|------|
| [P7-S1](#p7-s1) | 실험 배정 · conversion window · iROAS 계산 API | Codex (백엔드/설계) | 0% |
| [P7-S2](#p7-s2) | 실험 운영 대시보드 · 대조군/실험군 비교 차트 | Claude Code (프론트/UXUI) | 0% |
| [P7-S3](#p7-s3) | 코호트에 실험 라벨 얹기 (treatment/control/campaign_id) | Codex (백엔드/설계) | 0% |
| [P7-S4](#p7-s4) | 리커버리랩 방문 쿠폰 CRM 실험 — 세그먼트/콘텐츠/발송/측정 | Codex (백엔드/설계) | 0% |
| [P7-S5](#p7-s5) | 리커버리랩 방문 쿠폰 실험 프론트 — 대상자 확인/발송/성과 UI | Claude Code (프론트/UXUI) | 0% |
| [P7-S6](#p7-s6) | 더클린커피 리드 마그넷 "1분 커피 타입 진단" 설계 · 구현 | Codex (백엔드/설계) | 0% |
| [P7-S7](#p7-s7) | 리드 마그넷 랜딩/결과 페이지 · 퍼널 프론트 구현 | Claude Code (프론트/UXUI) | 0% |

> **Claude Code 남은 작업**: P7-S2 실험 운영 대시보드 — 대조군/실험군 비교 차트, 실시간 상태 배지. 로컬 SQLite 실험 데이터 기반으로 바로 구현 가능. P7-S5 리커버리랩 캠페인 UI — 서울 고객 세그먼트 미리보기, 쿠폰 발급/사용 현황. Codex P7-S4 설계 후 진행. P7-S7 리드 마그넷 랜딩/결과 페이지 — "1분 커피 타입 진단" 퍼널 프론트(랜딩 1장 + 결과 페이지 4개 + 첫 구매 제안). Codex P7-S6 설계 후 진행.

### Phase 8 — UX 정성 데이터 · 도구 도입 판단

> 왜: AI Agent가 전환 저해 요인 가설을 만들려면 정성 신호 필요. BigQuery/Amplitude/Mixpanel은 실험 규모와 분석 니즈에 따라 검토
>
> **사용자 베네핏:**
> - **대표(TJ)**: "왜 체크아웃에서 이탈하는가?"에 대해 히트맵/리플레이/설문 기반 정성 가설을 매주 받음. AI가 "이 버튼이 안 보여서 이탈할 가능성이 높다"는 식으로 구체적 개선안 제시
> - **기획팀**: 퍼널 분석을 SQL 없이 self-serve로 돌리고, 실험 결과와 UX 인사이트를 같은 맥락에서 비교
> - **개발팀**: GA4 raw event를 BigQuery에서 직접 SQL로 조회하여, (not set) 귀속 문제나 전환 누락을 원인 수준까지 추적

| Sprint | 목표 | 담당 | 완료 |
|--------|------|------|------|
| [P8-S1](#p8-s1) | Contentsquare/Hotjar 트래킹 삽입 · 계측 | Claude Code (프론트/UXUI) | 0% |
| [P8-S2](#p8-s2) | Amplitude/Mixpanel/Braze MCP 도입 필요 여부 판단 | Codex (백엔드/설계) | 20% |
| [P8-S3](#p8-s3) | BigQuery 도입 필요 여부 판단 | Codex (백엔드/설계) | 0% |

> **Claude Code 남은 작업**: P8-S1 Contentsquare/Hotjar 트래킹 스니펫 삽입, 핵심 CTA 클릭/폼 오류/스크롤 depth 계측. 도입 결정 후 즉시 진행 가능.

#### P8-S3 BigQuery 도입 검토 기준

**BigQuery가 필요해지는 신호:**
- GA4 raw event를 직접 SQL로 분석해야 하는 질문이 반복될 때 (GA4 UI의 탐색/보고서만으로 부족)
- GA4 데이터와 내부 원장(주문/실험/CRM)을 조인해서 봐야 할 때
- 일별/주별 자동 리포트를 SQL 파이프라인으로 만들어야 할 때
- 실험 수가 늘어나 `(not set)` 귀속 문제를 raw event 레벨에서 진단해야 할 때
- Meta/카카오 광고 비용과 GA4 전환 이벤트를 한 테이블에서 비교해야 할 때

**현재 BigQuery 없이 가능한 것:**
- 상담사 가치 분석 → 운영 DB 직접 조회 (callprice API)
- CRM 실험 원장 → 로컬 SQLite (crm-local API)
- 재구매 코호트 → 운영 DB 직접 조회
- 북극성 지표 → callprice overview API로 근사치 산출

**BigQuery가 있으면 추가로 가능한 것:**
- GA4 raw event 기반 퍼널 분석 (page_view → begin_checkout → purchase 이탈률)
- `(not set)` 매출의 실제 유입 경로 역추적 (session_start → page_view → transaction 조인)
- 광고 클릭 → 세션 → 구매까지 attribution 정밀 분석
- 대규모 사용자 행동 패턴 클러스터링

**도입하지 않아도 되는 조건:**
- 실험 수가 3개 미만이고
- GA4 UI + 내부 원장 SQL로 의사결정이 충분하며
- `(not set)` 비중이 낮거나 PG 직결로 설명 가능할 때

**권장 시점:** Phase 7(1차 증분 실험 라이브) 이후. 실험을 실제로 돌리면서 GA4 raw data 분석이 반복적으로 필요해지면 그때 도입.

**비용 참고:** GA4 → BigQuery export는 무료 (GA4 설정에서 활성화). BigQuery 쿼리 비용은 월 1TB 무료 → 이후 $6.25/TB. 초기에는 사실상 무료.

### Phase 9 — AI Agent 고도화 · Exponential Growth OS (0403 신규)

> 왜: Phase 0~8이 **데이터 통합 → 실험 → 실행 채널 → 코호트 → 광고 → UX**를 닫는다면, Phase 9는 이 모든 것 위에서 **AI Agent가 스스로 가설을 세우고, 검증하고, 진화하는 피드백 루프**를 완성하는 단계
>
> **사용자 베네핏:**
> - **대표(TJ)**: AI가 매주 "이번 주 가장 에너지 높은 액션 3개"를 제안하고, 지난 주 실험의 증분 결과와 함께 보고. 감이 아닌 **반복 검증된 시나리오**로 의사결정
> - **운영팀**: AI가 발송 대상, 템플릿, 타이밍을 자동 추천하고, 실행 후 결과를 스스로 학습. 운영자는 **승인/기각만** 하면 됨
> - **전략팀**: 여러 AI CSO 페르소나가 동일 데이터를 보고 교차 의견을 내며, 팩트와 추론을 분리하여 **합리적 비판과 보완**이 가능

#### Growth OS 프레임워크: Unify → Hypothesize → Uncover → Evolve

```
STEP 01 — Unify (데이터 분석)
  흩어진 주문/상담/CRM/광고/결제를 고객 단위로 통합.
  같은 사람을 같은 사람으로 보는 정본 구축.
  [Phase 0~2에서 달성: customer_key, 상담 원장, 주문 매칭]
      ↓
STEP 02 — Hypothesize (가설 수립)
  에너지 준위가 높은 액션 플랜 도출.
  여러 페르소나의 에이전트가 교차하며 임팩트 큰 기회를 식별.
  [Phase 9에서 AI Agent가 자동화]
      ↓
STEP 03 — Uncover (실행 및 검증)
  본질에 포커스하는 증분 방식.
  "보냈다"가 아니라 "보냈더니 원래 없던 매출이 생겼는가"를 실험으로 판정.
  [Phase 7에서 1차 증분 실험, Phase 9에서 자동 실험 루프]
      ↓
STEP 04 — Evolve (진화)
  검증에서 진실로. Working 하는 시나리오를
  AI Agent 피드백 루프를 태워 지속적으로 고도화.
  [Phase 9 핵심 — 선형이 아닌 기하급수적 성장]
```

**= 선형적 성장이 아닌, 기하급수적 성장을 위한 AI 네이티브 조직의 OS**

| Sprint | 목표 | 담당 | 완료 | 선행 |
|--------|------|------|------|------|
| [P9-S1](#p9-s1) | 제1원칙 AI CSO — 팩트/추론 분리 엔진 | Codex (백엔드/설계) | 0% | P7 완료 |
| [P9-S2](#p9-s2) | 멀티 페르소나 교차 임팩트 — AI CSO 간 토론/강화/비판 | Codex (백엔드/설계) | 0% | P9-S1 |
| [P9-S3](#p9-s3) | 자동 가설 생성 → 실험 배정 → 결과 수집 루프 | Codex (백엔드/설계) | 0% | P7, P9-S1 |
| [P9-S4](#p9-s4) | AI 피드백 루프 대시보드 — 가설/실험/결과/진화 시각화 | Claude Code (프론트/UXUI) | 0% | P9-S3 |
| [P9-S5](#p9-s5) | Working 시나리오 자동 스케일 — 검증된 시나리오 확대 적용 | Codex + Claude Code | 0% | P9-S3 |

#### P9-S1: 제1원칙 AI CSO — 팩트와 추론의 분리

**핵심 개념**: AI CSO(Chief Strategy Officer)가 의견을 낼 때, **팩트(데이터에서 직접 확인 가능한 것)**와 **추론(데이터에서 유추한 해석)**을 명시적으로 분리한다.

```
AI CSO 의견 구조:

[팩트] 90일 재구매율 21.5%, 1회 구매 고객 78.3%, 재구매 p75 = 21일
[팩트] SMS 동의율 47.5% (83,017명 중 39,440명)
[팩트] 채널톡 캠페인 유입 → ₩34,825 결제 1건 포착

[추론] 첫 구매 후 17-21일 시점에 재구매 유도 알림톡을 넣으면
       재구매율이 5%p 개선될 가능성이 있다
       근거: p75 시점과 일치, 정보성 알림톡으로 consent 불필요

[강화/비판] 다른 AI CSO 의견 "전면 가격 인상"에 대해:
  - 동의: 케냐/디카페인 등 고가라인은 원가 압박이 높아 선별 인상 합리적
  - 비판: 콜롬비아를 동시에 올리면 코어 유입 감소 위험, 팩트 근거 부족
  - 보완: 가격 인상 전 CRM 재구매 실험 결과를 먼저 확인해야 함
```

**왜 제1원칙인가**: 일론 머스크의 제1원칙 사고법처럼, 기존 관행("경쟁사가 올렸으니 우리도 올리자")이 아니라 **우리 데이터의 팩트에서 출발**하여 추론을 쌓는 방식. AI CSO가 여러 명(마케터 CSO, 재무 CSO, 운영 CSO)일 때, 각자의 팩트 기반이 다르면 **교차 비판**이 가능하고, 이것이 단일 AI보다 훨씬 강한 의사결정을 만든다.

#### P9-S2: 멀티 페르소나 교차 임팩트

| AI 페르소나 | 관점 | 주요 데이터 소스 | 예시 의견 |
|------------|------|----------------|----------|
| **Growth CSO** | 매출 성장 | 코호트, LTR, 재구매율 | "17-21일 알림톡이 가장 에너지 높은 액션" |
| **Finance CSO** | 마진/비용 | PG 수수료, 원가, CPA | "현재 인상안은 1kg에서 과함, 8-12% 상한 권장" |
| **Operations CSO** | 실행 가능성 | consent, 화이트리스트, 템플릿 상태 | "정보성 11개 활성, 홍보성은 320명만 가능" |
| **Customer CSO** | 이탈/만족 | NPS, 상담 데이터, 이탈 시점 | "가격 인상 전 재구매 구조 강화가 먼저" |

각 CSO가 같은 데이터를 보고 **독립적으로** 의견을 내고, 다른 CSO의 의견에 대해:
- **동의**: 팩트로 뒷받침되면 강화
- **비판**: 추론이 팩트와 맞지 않으면 합리적 반론
- **보완**: 놓친 관점이 있으면 추가

#### P9-S3: AI 피드백 루프 — 자동 실험 사이클

```
주간 자동 사이클:

월요일: AI가 지난 주 실험 결과 수집 (증분 매출, iROAS)
          ↓
화요일: 멀티 CSO가 결과 해석 + 다음 주 가설 3개 제안
          ↓
        [팩트/추론 분리 리포트 자동 생성]
          ↓
수요일: 운영자가 가설 승인/기각/수정
          ↓
목요일: 승인된 가설 → 자동 실험 배정 (treatment/control)
          ↓
금~일:  실험 실행 (알림톡/채널톡 자동 발송)
          ↓
다음 월요일: 결과 수집 → 루프 반복
```

#### 현재 로드맵에서 이미 AI 피드백 루프를 준비하고 있는 것

| Phase | 피드백 루프 기여 | 현재 상태 |
|-------|----------------|----------|
| **P0** (Ontology) | AI가 읽을 수 있는 공용 언어 고정 | ✅ 완료 |
| **P1** (실험 원장) | assignment-first 실험 장부 → AI가 결과를 읽을 수 있는 구조 | ✅ 완료 |
| **P1-S1A** (결제 추적) | 유입→전환 연결 → AI가 "이 채널이 실제 매출을 만들었는가" 판단 가능 | ✅ 완료 |
| **P2** (상담 가치) | 상담사별 증분 가치 → AI가 "이 상담사의 리드를 우선 배정" 추천 가능 | ✅ 완료 |
| **P3** (실행 채널) | 알림톡/SMS/채널톡 자동 발송 → AI가 직접 실행 가능한 채널 | ✅ 거의 완료 |
| **P4** (코호트) | 90일 재구매 지표 → AI의 성과 평가 기준 | ✅ 95% |
| **P7** (증분 실험) | control/treatment 비교 → AI가 "이 시나리오가 진짜 효과 있었는가" 판정 | ⬜ 계획 |
| **P8** (UX 정성) | 히트맵/리플레이 → AI가 "왜 이탈하는가" 가설 생성 | ⬜ 계획 |
| **P9** (AI Agent 고도화) | 위 모든 것을 연결하는 **자동 피드백 루프** | ⬜ 신규 |

**핵심 인사이트**: P0~P8이 **루프의 각 부품**이라면, P9는 **부품을 연결하여 루프를 돌리는 엔진**이다. P0의 ontology가 AI의 언어, P1의 실험 장부가 AI의 기억, P3의 실행 채널이 AI의 손, P7의 증분 판정이 AI의 눈이 되어, P9에서 비로소 **스스로 학습하고 진화하는 AI 운영 시스템**이 완성된다.

#### P9 진입 조건

P9는 아래가 충족된 후 시작:
1. P7에서 **첫 증분 실험 1건 이상 완료** (실험 결과 데이터가 있어야 AI가 학습)
2. P3에서 **알림톡 자동 발송 안정화** (AI가 실행할 채널이 준비)
3. P4에서 **북극성 지표가 신뢰 가능한 상태** (AI의 성과 평가 기준)

---

## 0-1. 지표 체계 (0329 확정)

> 출처: `gptprofeedback0101.md` + TJ님 확인

### 회사 북극성 지표

**90일 재구매 순이익 (Repeat Gross Profit 90D)**

- 재구매율만 보면 객단가/마진이 빠진다
- 총매출만 보면 acquisition/할인/자기잠식이 섞인다
- 90일 재구매 순이익은 "충성고객이 실제로 남기는 가치"를 본다
- 마진 계산이 아직 어려우면 임시 대체지표: **환불 반영 90일 재구매 순매출**

### 솔루션 팀 OMTM

**Incremental Gross Profit (증분 공헌이익)**

- 현재 callprice 대시보드의 "상담 효과 추정 매출"이 이 개념의 1차 근사치
- 정확한 Incremental Gross Profit은 비용 원장 + 순증분 추정 구조가 완성되어야 함

### 실행 지표 체계

| 구분 | 지표 | 현재 상태 |
|------|------|-----------|
| 회사 북극성 | 90일 재구매 순이익 (Repeat Gross Profit 90D) | 마진 데이터 필요 → 임시로 환불 반영 90일 재구매 순매출 |
| 팀 OMTM | Incremental Gross Profit | callprice에서 1차 근사치 산출 중 |
| 실행 지표 1 | iROAS (증분 광고수익률) | 비용 원장 필요 |
| 실행 지표 2 | unsubscribe/complaint rate | 채널톡/알리고 운영 데이터에서 추출 예정 |
| 실행 지표 3 | identity match rate | 전화번호 매칭률 41.7% (callprice 기준) |
| 진단 지표 | 재구매 코호트 (M+1, M+2, M+3) | 내부 주문 데이터로 즉시 구축 가능 |

### 실행 전략: 내부 원장 우선 + 좁은 범위 병행

**A. 먼저 고정 (내부 데이터)**
- `customer_key` 식별 체계
- 주문/환불/취소 원장
- 실험 배정 원장
- 비용 원장

**B. 동시에 저위험 병행**
- 채널톡 SDK 이벤트/사용자 upsert (래퍼 준비 완료)
- 알리고 알림톡 발송 (senderKey 확보, apikey/userid 추가 필요)
- Meta 비용 ingest
- GA4 보조 분석

**C. 첫 라이브 실험 시나리오 (채널톡 Campaign 또는 알리고 알림톡)**
1. 체크아웃 이탈 6시간 vs 24시간
2. 상품 조회 후 미구매
3. 첫 구매 후 21일/30일 윈백

- 실행: 채널톡 Campaign 또는 알리고 알림톡
- 판정: 내부 실험 원장에서 Incremental Gross Profit / iROAS

**D. 재구매 코호트는 지금 바로 시작**
- 내부 주문 데이터만으로 먼저 구축
- 최소 항목: 첫 구매 코호트별 M+1/M+2/M+3 재구매율, 코호트별 재구매 순매출
- 나중에 실험 원장이 붙으면: treatment/control, 메시지 노출 여부, campaign id를 얹어서 CRM 타깃 선정 + holdout 검증 화면으로 승격

### 채널 우선순위 (확정)

1. **내부 주문/환불/체크아웃 이벤트** — 측정 원장 (source of truth)
2. **채널톡** — 실행/운영 레이어 (미니 Braze 역할, 내장 지표는 운영 참고용)
3. **알리고 알림톡** — 한국형 대규모 리치 채널 (senderKey 확보 완료)
4. **GA4 + BigQuery** — 보조 분석 레이어
5. **Meta Marketing API + Conversions API** — 광고 비용/전환 연동
6. **카카오모먼트** — 추후 확장

---

## 1. 한 줄 결론

`revenue` 프로젝트는 이미 주문/매출/운영 대시보드가 있는 상태다. 지금 필요한 것은 새 대시보드 추가보다, **실험 배정 → 발송 → 노출/클릭 → 구매 → 환불 → 비용**을 한 줄로 잇는 **CRM 실험 원장(ledger)** 이다.

- 프론트엔드 실제 구현: Claude Code 담당
- 알고리즘/백엔드/API/실험 설계: Codex 담당
- UX/UI 요구사항, 계측 포인트, acceptance criteria 정의: Codex 담당
- Meta 광고는 이미 집행 중이므로 **연동하는 것이 맞다**
- 다만 순서는 `광고 API`보다 먼저 `식별키/이벤트 스키마/원장` 고정이다
- ChannelTalk는 이미 사용 중이므로 **v1 실행 레이어는 ChannelTalk 우선**이 맞다
- 운영 DB 재확인 결과, **상담 후속 CRM은 더 이상 백로그가 아니라 병행 실험 후보**다
- 단, 상담 기능성 테이블 `tb_cs_*`는 거의 비어 있고 실제 원장은 `tb_consultation_records` 기준으로 봐야 한다
- 카카오 API 키 3종 확보됨 (REST API/JavaScript/Admin)
- **알리고(Aligo) 알림톡 대행 API** — Sender Key 확보됨. 알리고를 통해 카카오 알림톡/브랜드메시지 발송 가능
- 로컬 SEO backend 기준 Aligo 자격증명은 이미 읽히고 있다
- 지금 Aligo의 핵심 blocker는 키 부족이 아니라 `승인 템플릿 본문/버튼`과 실제 렌더링의 exact-match 불일치다
- 알림톡 발송에는 **승인된 템플릿**이 필요 (알리고 관리자 페이지에서 등록/검수)
- Amplitude/Mixpanel은 초반 필수 도구가 아니다
- Hotjar 계열은 AI Agent가 **UX 개선 가설**을 만드는 데 유효하지만, **전환율 상승의 증명 도구는 아니다**

### 1-1. 현재 기준 가장 파급력 큰 다음 액션

~~현재 기준 다음으로 가장 파급력 큰 작업은 실제 고객 사이트에 P1-S1A live row를 붙이는 것이다.~~ → **✅ 완료 (0402)**

P1-S1A live row + UTM이 더클린커피에서 완성되었으므로, 다음 우선순위가 바뀐다.

우선순위는 아래 4줄로 읽는다.

- **회사 전체 다음 행동:** 더클린커피 전환 원장이 열렸으므로, **바이오컴(biocom.kr) 확장**과 **커피 Toss Secret Key 확보**로 크로스 검증을 닫는다.
- **Codex 다음 행동:** 커피 Toss Secret Key 확보 후 paymentKey 크로스 검증 API를 추가하고, 바이오컴 결제완료 URL 패턴을 확인한다.
- **Claude Code 다음 행동:** Cloudflare Tunnel 고정 endpoint(named tunnel) 전환, 바이오컴용 푸터 코드 준비, `/crm` 결제 귀속 탭에서 live row 실데이터 연동.
- **외부 의존 blocker:** 운영 DB cutover, 커피 Toss Secret Key, 바이오컴 결제완료 URL 패턴 확인.

이유:

1. ~~`live / replay / smoke` 중 아직 `live`만 비어 있어 `(not set)` 원인을 확정할 수 없다~~ → **live row 달성 (0402)**
2. P1-S1A가 ~~닫혀야~~ 닫혔으므로 checkout abandon 실험과 상담 후속 실험이 같은 전환 원장 위에서 읽을 수 있다
3. 커피에서 검증된 구조를 바이오컴으로 확장하면 양쪽 사이트의 전환 원장이 통합된다
4. Cloudflare Tunnel을 named tunnel로 전환하면 URL 고정 + 재시작 안정성이 확보된다

현재 구현 완료 API:

- `GET /api/consultation/summary`
- `GET /api/consultation/managers`
- `GET /api/consultation/order-match`
- `GET /api/consultation/product-followup`
- `GET /api/consultation/candidates`

즉시 참조할 문서:
- `/Users/vibetj/coding/seo/roadmap0327.md`
- `/Users/vibetj/coding/seo/Phase1.md`
- `/Users/vibetj/coding/seo/codex/codexfeedback_0331_2reply.md`

검증 메모:
- Claude Code의 ChannelTalk 프론트 v1은 `build` 통과
- Codex의 상담 CRM read-only API는 `typecheck`, `17개 테스트`, 실제 `curl` 검증 통과
- 프론트 `lint`는 기존 `AiReportTab.tsx`, `TrendSection.tsx` 선행 이슈로 실패
- 따라서 다음 턴은 백엔드 신규 구현보다 **프론트 운영 화면 연결**의 파급력이 더 크다

> Revenue 프로젝트 구조/데이터 현실은 `/Users/vibetj/coding/seo/revenue.md`로 분리함

## 3. 이번 0327 로드맵의 핵심 원칙

### 3-1. 가장 먼저 만들 것

`gptprofeedback_0327.md`의 방향이 맞다. 제일 먼저 필요한 것은 아래 3개다.

1. `Apple-to-Apple` 증분 실험 설계
2. 사용자 단위 CRM 이벤트 원장
3. iROAS 계산 SQL/API

즉, Braze 같은 오케스트레이션 도구보다 먼저 아래 원장이 필요하고, **실행은 ChannelTalk / 판정은 내부 DB**로 분리하는 게 맞다.

- `experiment_assigned`
- `message_prepared`
- `message_sent`
- `message_delivered`
- `message_clicked`
- `purchase`
- `cancel/refund`
- `channel_cost`

### 3-2. 역할 분담

| 구분 | Codex Backend | Codex UX/UI Spec | Claude Code Frontend |
|------|---------------|-------------------|----------------------|
| 운영 콘솔 화면 | API/권한/데이터 계약 | IA/검수 기준 정의 | 실제 구현 |
| 랜딩/체크아웃 UXUI | 이벤트/전환 정의 | 페이지 흐름/계측 포인트 | 실제 구현 |
| 대시보드 시각화 | 데이터 모델/API | KPI 카드/필터 기준 | 실제 구현 |
| 트래킹 스니펫 | 이벤트 명세 | 삽입 위치 정의 | 실제 삽입 |
| 이벤트/실험 스키마 | 담당 | 검수 | 협업 |
| DB 모델/API/배치 | 담당 | 미담당 | 미담당 |
| 실험 배정 알고리즘 | 담당 | 검수 | 미담당 |
| iROAS 계산 로직 | 담당 | 검수 | 미담당 |
| Meta/Kakao/ChannelTalk 서버 연동 | 담당 | 검수 | 미담당 |
| QA 시나리오 | 담당 | 담당 | 담당 |

### 3-3. 승인 필요 항목

실행 단계에 들어가기 전에 TJ님 승인 필요:

- 신규 DB 테이블/스키마 추가
- 광고/CRM 외부 자격증명 연결
- 카카오 메시지 발송 채널/템플릿 정책 확정
- 운영 데이터에 영향을 주는 자동 발송 활성화

## 4. 핵심 백엔드 설계안

초기 1차 스키마 제안:

- `crm_identity_map`
  - `customer_key`, `phone_hash`, `email_hash`, `iamweb_user_id`, `meta_click_id`, `ga_client_id`, `kakao_channel_user_key`
- `crm_experiments`
  - 실험 정의, 전환 윈도우, 채널, holdout 비율
- `crm_audience_snapshot`
  - 특정 시점 세그먼트 스냅샷
- `crm_assignment_log`
  - user 단위 control/treatment 배정 이력
- `crm_message_log`
  - 발송 요청/실제 발송/전달/실패/클릭 상태
- `crm_conversion_log`
  - 주문/구매/구독/환불 매핑 결과
- `crm_cost_ledger`
  - 메시지 비용, 쿠폰 비용, 광고 비용
- `meta_campaign_daily`
  - 캠페인/광고세트/광고 단위 spend, impressions, clicks
- `consultation_status_map`
  - `tb_consultation_records.consultation_status` 표준화 사전
- `consultant_cost_monthly`
  - 상담사별 월 인건비/평균 상담시간
  - 승인 이후에만 생성

초기 KPI:

- incremental revenue
- incremental gross profit
- iROAS
- 메시지당 순증분 매출
- 실험군/대조군 CVR 차이
- 환불 반영 순매출
- 상담 완료 후 구매 전환율
- 상담사별 평균 LTR 격차
- 상담사 1인당 월 순증분 매출

## 5. 상세 실행 로드맵


## Phase 0 상세 — 구조 고정 및 데이터 계약

기간: 2026-03-30 ~ 2026-04-03

목표:
- 실험/식별/전환 이벤트 스키마 고정
- 운영 첫 주문형 시나리오를 `체크아웃 이탈`로 확정
- 상담형 시나리오를 `상담 완료 후 영양제 후속`과 `부재/변경 고객 리콜` 두 축으로 병행 정의
- 기존 Revenue API와 충돌 없는 방식으로 CRM 레이어 설계

### P0-S1
> customer_key 규칙 · 이벤트 명세서 · DB 스키마 초안 | Codex

- `revenue` 주문/매출 데이터와 연결되는 `customer_key` 규칙 설계
- `tb_consultation_records.customer_contact` 정규화 규칙 설계
- 실험 이벤트 명세서 작성
- 신규 테이블/인덱스/배치 흐름 설계
- Meta/Kakao 연동에 필요한 필수 필드 정의
- 상담 상태 표준화 사전 설계
- 상담사 가치 분석에 필요한 join key 설계
- CRM 운영자 화면 정보구조 정의
- 실험 생성/대상자 확인/성과 조회 화면 acceptance criteria 정의
- Meta 유입 랜딩/체크아웃 UX 계측 포인트 정의
- 상담 후속 실험/상담사 가치 리포트의 정보구조 정의

2026-03-29 실제 개발 반영:
- `revenue backend`의 `GET /api/crm/phase0-blueprint`를 실데이터 기반 계약 API로 확장
- 포함 항목:
  - `customer_key draft`
  - 상담 연락처 정규화 규칙 + 실제 스냅샷
  - 상담 상태 표준화 사전 + 실제 스냅샷
  - ChannelTalk event blueprint + `memberId = customer_key` 계약
  - Meta/Kakao 필수 필드 계약
  - 상담사 가치 분석 join key + 실제 주문 매칭률 스냅샷
  - CRM 운영자 화면 IA
  - 실험 생성/대상자/성과 조회 acceptance criteria
  - 랜딩/체크아웃 계측 포인트
  - 상담 후속/상담사 가치 리포트 정보구조
- 로컬 검증 결과:
  - 상담 데이터 `113건`
  - 상태 분포 `완료 106 / 부재 4 / 시간변경 3`
  - 상담 연락처 숫자 정규화 가능 비율 `100%`
  - 상담 연락처 기준 유료 주문 매칭률 `77.9%`
- 회귀 검증:
  - `test_crm_phase0.py` 추가
  - `pytest` 기준 `4 passed`

### P0-S2
> CRM 운영자 화면 IA · 와이어프레임 | Claude Code

#### 무엇을 하는가

현재 프론트에 흩어진 3개 화면(`/`, `/callprice`, `/crm`)의 정보구조(IA)를 통합하고, 아직 없는 실험 운영/코호트/알림톡 발송 화면의 구조를 설계한다. 코드 구현이 아닌 **화면 설계 + 컴포넌트 구조 확정**이 산출물이다.

#### 왜 하는가

- 현재 `/callprice`와 `/crm`이 별도 라우트로 분리되어 있지만, 사용자 흐름(후보 확인 → 발송 → 성과 확인)이 연결되어 있지 않다
- Phase 1~7에서 만들 화면(실험 대시보드, 코호트, 알림톡 발송, 리커버리랩 캠페인 등)이 어디에 어떤 구조로 들어갈지 미리 정하지 않으면 화면이 난잡해진다
- Codex가 P0-S1에서 API 스키마를 확정할 때, 프론트에서 어떤 데이터를 어떤 화면에 보여줄지 알아야 API 설계도 맞출 수 있다

#### 어떻게 하는가

**Step 1. 현재 화면 인벤토리 정리**

현재 구현 완료된 라우트와 대메뉴:

| 라우트 | 대메뉴 탭 | 상태 | 핵심 파일 |
|--------|-----------|------|-----------|
| `/` | 오버뷰~솔루션 소개 (10탭) | 운영 중 | `app/page.tsx` |
| `/callprice` | "상담 분석" 탭에서 링크 | 90% | `app/callprice/page.tsx` |
| `/crm` | "CRM 관리" 탭에서 링크 | 70% | `app/crm/page.tsx` |

백엔드 API 그룹 (이미 구현):

| 그룹 | 엔드포인트 | 프론트 연결 |
|------|-----------|------------|
| callprice | options, overview, managers, analysis-types, scenario | `/callprice`에서 사용 중 |
| consultation | summary, managers, order-match, product-followup, candidates | `/crm`에서 candidates만 사용 중 |
| channeltalk | status, health | 미사용 (버튼 제거) |

아직 프론트에 연결되지 않은 API: `consultation/summary`, `consultation/managers`, `consultation/order-match`, `consultation/product-followup`

**Step 2. 목표 IA 설계**

통합 CRM 운영자 화면의 목표 구조:

```
/                          ← SEO 대시보드 (기존 유지)
/callprice                 ← 상담사 가치 분석 (기존 유지, UXUI 보강)
/crm                       ← CRM 관리 허브 (확장)
  ├─ 후속 관리 대상           ← 현재 구현 (candidates API)
  ├─ 상담 현황 요약           ← consultation/summary + managers 연결
  ├─ 알림톡 발송              ← P3-S4에서 구현
  ├─ 실험 목록/상세           ← P1-S2에서 구현
  └─ 코호트 뷰               ← P4-S2에서 구현
```

핵심 판단:
- `/crm`을 **CRM 관리 허브**로 확장하되, 한 페이지에 탭/섹션으로 묶는다
- `/callprice`는 분석 전용이므로 별도 유지
- 실험 대시보드는 `/crm` 안에 탭으로 넣을지, `/experiment`로 분리할지 Phase 1 시작 시 결정

**Step 3. `/crm` 페이지 확장 설계**

현재 `/crm`은 candidates만 보여주는데, 아래 섹션을 추가:

| 섹션 | 데이터 소스 | 구현 시점 |
|------|------------|-----------|
| 상담 현황 요약 (KPI 카드) | `consultation/summary` | P0-S2 (이번 스프린트) |
| 상담사별 성과 요약 | `consultation/managers` | P0-S2 |
| 주문 매칭 현황 | `consultation/order-match` | P0-S2 |
| 상품 후속 구매 현황 | `consultation/product-followup` | P0-S2 |
| 후속 관리 대상 (기존) | `consultation/candidates` | 이미 완료 |
| 알림톡 발송 | 알리고 API | P3-S4 |
| 실험 목록/성과 | 실험 원장 API | P1-S2 |
| 코호트 뷰 | 코호트 API | P4-S2 |

**Step 4. 핵심 파일 목록**

| 파일 | 용도 | 변경 내용 |
|------|------|-----------|
| `frontend/src/app/crm/page.tsx` | CRM 허브 메인 | 탭 구조 추가, 상담 현황/매칭/상품 후속 섹션 추가 |
| `frontend/src/app/crm/page.module.css` | CRM 스타일 | 탭/섹션 스타일 추가 |
| `frontend/src/types/consultation.ts` | (신규) consultation API 타입 | summary, managers, order-match, product-followup 응답 타입 |
| `frontend/src/hooks/useConsultationData.ts` | (신규) consultation 데이터 훅 | 4개 API 병렬 fetch |
| `frontend/src/app/callprice/page.tsx` | 상담사 가치 | UXUI 보강 (P2-S5와 연결) |
| `frontend/src/constants/pageData.ts` | 네비게이션 | 변경 없음 (이미 CRM 관리 탭 있음) |

**Step 5. 화면별 와이어프레임 기준**

`/crm` 확장 후 화면 흐름:

1. **상단**: 탭 네비게이션 (후속 관리 | 상담 현황 | 발송 | 실험 | 코호트)
2. **후속 관리 탭** (현재 구현): 시나리오 선택 → 대상자 테이블 → 추천 액션
3. **상담 현황 탭** (이번 추가):
   - KPI 카드: 기간 내 상담 건수, 완료율, 주문 매칭률
   - 상담사별 요약 테이블
   - 주문 매칭 분석 카드
   - 상품 후속 구매 분석 카드
4. **발송 탭** (P3-S4): placeholder → 알리고 연동 후 채움
5. **실험 탭** (P1-S2): placeholder → 실험 원장 완성 후 채움
6. **코호트 탭** (P4-S2): placeholder → 코호트 API 완성 후 채움

#### 완료 기준

- `/crm` 페이지에 탭 구조가 잡힘
- consultation summary/managers/order-match/product-followup API가 프론트에 연결됨
- 아직 없는 화면(발송/실험/코호트)은 "준비 중" placeholder로 자리를 잡아둠
- 향후 Sprint에서 각 placeholder를 실제 기능으로 교체할 수 있는 구조

산출물:
- 이벤트 사전
- DB 스키마 초안
- 화면 플로우 초안
- 구현 우선순위 문서

완료 기준:
- `customer_key` 생성 규칙 확정
- 첫 주문형 실험 use case 확정
- 상담형 실험 후보 2개 정의 완료
- DB 변경안 승인 요청 준비 완료

### P0-S3
> lead/콘텐츠/정책 온톨로지 · agent-readiness 계약 | Codex

- 왜 지금 필요한가:
  - 에이전트를 나중에 붙이더라도, 지금 `lead`, `customer`, `claim`, `policy`를 같은 이름으로 부르기 시작해야 한다
  - 프리-구매 리드 데이터를 주문 스키마에 억지로 끼워 넣지 않으려면 `lead_id`를 먼저 분리해야 한다
- 2026-03-31 실제 개발 반영:
  - `GET /api/crm/phase0-blueprint` 응답에 아래 항목 추가
    - `lead_ontology`
    - `phase1_lead_ledger`
    - `lead_magnet_mvp`
    - `content_claim_registry`
    - `agent_readiness`
  - 포함 원칙:
    - `lead_id != customer_key`
    - 리드 마그넷은 별도 시스템이 아니라 기존 experiment/ledger 위에 얹는다
    - 에이전트는 `single read-only -> draft -> limited execution -> multi-agent` 순으로 간다
- 이번 턴 검증:
  - `test_crm_phase0.py` 확장
  - `pytest -q test_crm_phase0.py` 결과 `7 passed`
- 실무 판단:
  - GraphRAG/그래프 DB는 아직 이르다
  - 지금 필요한 것은 `business ontology + registry + run log`다

## Phase 1 상세 — CRM 실험 원장 MVP

기간: 2026-04-04 ~ 2026-04-10

목표:
- 발송 여부와 무관하게 실험군/대조군을 배정할 수 있는 백엔드 준비
- 구매/환불 데이터를 실험 원장과 조인할 수 있게 만들기
- `(not set)` 검증용 checkout → payment success attribution 원장을 준비하기

현재 병목 해석:
- 운영 화면 부족보다 더 큰 병목은 아직 `P1-S1A` live signal이 `0건`이라는 점이다
- 따라서 Phase 1은 화면보다 먼저 `실제 결제 흐름에서 row가 들어오는지`를 닫아야 한다
- `P1-S1`은 승인 패키지 다음 단계로 `shadow experiment`를 잡고, `P1-S1A`는 실사이트 연동을 최우선으로 둔다

### P1-S1
> 실험/배정/전환 테이블 구현 · 매핑 배치 | Codex

- `crm_experiments`, `crm_assignment_log`, `crm_conversion_log` 구현
- 구매/환불 이벤트 매핑 배치 구현
- 상담 cohort를 같은 실험 원장에 연결할 수 있는 인터페이스 정의
- 실험 결과 기본 API 구현
- 스모크 테스트 및 샘플 리포트 SQL 작성
- 실험 목록/상세 정보 구조 정의
- control/treatment 노출 규칙 정의
- KPI/빈 상태/오류 상태 acceptance criteria 정의

2026-03-29 이번 턴 실제 반영:
- 운영 반영용 read-only 승인 패키지 초안 API 추가
  - `GET /api/crm/experiment-approval-package`
- 패키지 범위는 최소 4개 테이블로 고정
  - `crm_experiments`
  - `crm_assignment_log`
  - `crm_message_log`
  - `crm_conversion_log`
- 패키지에 아래 원칙을 코드로 고정
  - `holdout required`
  - `assignment first`
  - `ITT 1차 판정`
  - `assignment_version required`
  - `occurred_at / ingested_at 분리`
  - `purchase/refund late arrival 허용`
- variant naming도 운영 승인 문구 기준으로 고정
  - `experiment_control = 무메시지 대조군`
  - `treatment_a / treatment_b = 발송군`
  - `global_holdout = 이번 최소 범위에서는 개념만 열어둠`
- 운영 DB read-only 검증 결과, 현재 4개 테이블은 모두 미존재
  - `crm_experiments = false`
  - `crm_assignment_log = false`
  - `crm_message_log = false`
  - `crm_conversion_log = false`
- 이번 턴 추가 실제 개발:
  - `GET /api/crm/experiments/{experiment_key}/assignments`
  - `POST /api/crm/experiments/{experiment_key}/conversions/sync`
  - assignment 저장 시 `assigned_at` override 허용
  - `CRM_ORDER_SOURCE_DATABASE_URL`를 추가해 shadow target DB와 주문 source DB를 분리
  - 로컬 shadow Postgres에서 CRM 4개 테이블만 초기화하는 helper와 검증 스크립트 추가
    - `scripts/run_crm_phase1_shadow.py`

shadow 검증 결과:
- 로컬 shadow DB: `postgresql+asyncpg://postgres@localhost:5433/dashboard`
  - 위 값은 이번 세션에서도 실제로 재사용 가능했다. 다만 `lsof`에는 `ssh` listener가 같이 보여 세션별 포트 혼재 가능성은 있으므로, destructive test 전에는 `psql`과 `docker exec dashboard-postgres-local`로 같은 DB인지 다시 확인한다.
- source DB: 바이오컴 운영 read-only DB
- 통합 테스트:
  - `test_crm_phase1_readonly.py`
  - `test_crm_phase1_shadow.py`
  - 결과 `6 passed`
- 실데이터 shadow run:
  - seed customer `120명`
  - assignment `120건`
  - variant 분포 `control 50 / holdout 14 / treatment 56`
  - matched order `74건`
  - candidate event `78건`
  - live inserted conversion `78건`
  - variant summary
    - `control`: assignment `50`, purchaser `25`, net revenue `5,978,127`
    - `holdout`: assignment `14`, purchaser `8`, net revenue `1,534,546`
    - `treatment`: assignment `56`, purchaser `26`, net revenue `6,578,858`

이번 턴 판단:
- `P1-S1` 완료 기준이었던 `실험 생성 -> preview -> assignment 저장 -> order 기반 purchase/refund sync -> variant 결과 조회`를 local shadow mode에서 모두 닫았다
- 운영 DB schema 생성은 여전히 개발팀 handoff 항목이지만, Codex 개발 범위 기준 P1-S1은 `100%`로 올린다
- 남은 것은 구현이 아니라 운영 cutover다

운영 DB 반영 없이 TJ님 + Codex가 1차로 할 수 있는 일:
- `revenue/backend`의 shadow mode를 그대로 써서, 운영 DB는 source read-only로만 읽고 별도 local shadow DB에 실험 원장을 적재한다
- 현재 실제 코드 근거:
  - `/Users/vibetj/coding/revenue/backend/app/models/models.py`
  - `/Users/vibetj/coding/revenue/backend/app/services/crm_experiment_service.py`
  - `/Users/vibetj/coding/revenue/backend/app/api/crm.py`
  - `/Users/vibetj/coding/revenue/backend/scripts/run_crm_phase1_shadow.py`
  - `/Users/vibetj/coding/revenue/backend/test_crm_phase1_shadow.py`
- 이 방식으로 1차에 바로 얻을 수 있는 인사이트:
  - variant별 assignment 분포
  - purchase/refund/net revenue 차이
  - holdout 포함 ITT uplift 초안
  - 세그먼트별 반응 차이
- 주의:
  - 이번 세션에서는 `5433`이 실제 local Docker `dashboard` DB로 동작 확인됐다
  - 다만 포워딩/로컬 인스턴스가 섞일 수 있으니, destructive test 전에는 `psql current_database()`와 `docker exec dashboard-postgres-local`로 같은 DB인지 재확인한다
- 실무 판단:
  - 1차는 `우리 shadow DB + 운영 read-only source`
  - 2차는 `개발팀 운영 DB cutover`
  - 즉, 인사이트 획득 자체는 운영 DB 반영을 기다릴 필요가 없다

2026-03-29 이번 턴 재실행/검증:
- revenue 원본 코드를 건드리지 않고 다시 돌릴 수 있도록 래퍼 추가:
  - `/Users/vibetj/coding/seo/codex/run_p1s1_shadow_local.sh`
- 실험 기록:
  - `/Users/vibetj/coding/seo/codex/p1s1_shadow_local_20260329.md`
- local-only smoke:
  - `temp-shadow-20260329-b`
  - local source snapshot 한계로 seed `1명`
  - assignment `1건`
  - purchase `2건`, refund `1건`, net revenue `17만원`
- read-only source -> local shadow target:
  - `temp-shadow-20260329-readonly`
  - seed `120명`
  - assignment `120건`
  - variant `control 59 / holdout 10 / treatment 51`
  - matched order `130건`
  - purchase event `11건`
  - revenue
    - `control 354,431원`
    - `holdout 0원`
    - `treatment 983,390원`
- 해석 주의:
  - 이 run은 `message log 0건` 상태의 shadow validation이다
  - 따라서 위 숫자는 실제 uplift가 아니라 `assignment / conversion sync plumbing`이 read-only source에서도 닫히는지 보는 검증 수치다
- 추가 확인:
  - `pytest -q test_crm_phase1_shadow.py -q` 통과
  - 단, 이 테스트는 shadow 테이블을 drop/recreate 하므로 결과를 보존할 run 뒤에는 바로 돌리면 안 된다
- 이번 턴에서 드러난 다음 개선 포인트:
  - source fetch가 `tb_iamweb_users` 전체 rollup을 먼저 읽고 있어 read-only source run에 약 `27초`가 걸렸다
  - 반복 실행을 위해서는 `date pushdown` 또는 `seed source table` 최적화가 필요하다

### P1-S1B
> lead profile/event/consent ledger · pre_purchase 실험 확장 | Codex

- 왜 Phase 1에 들어가는가:
  - 리드 마그넷도 결국 실험의 한 종류로 봐야 `lead -> consultation -> purchase -> repeat purchase`를 같은 원장 계보로 본다
  - 구매 전 리드를 담을 장부가 없으면 acquisition와 CRM이 다시 끊긴다
- 2026-03-31 실제 개발 반영:
  - `seo/backend/data/crm.sqlite3`에 리드 원장 3개 추가
    - `crm_lead_profile`
    - `crm_lead_event_log`
    - `crm_consent_log`
  - 실험 객체 확장:
    - `funnel_stage`
    - `asset_id`
    - `lead_magnet_id`
  - 새 API:
    - `GET /api/crm-local/leads/overview`
    - `GET /api/crm-local/leads`
    - `POST /api/crm-local/leads`
    - `POST /api/crm-local/leads/events`
    - `POST /api/crm-local/leads/consents`
- 지금 확인된 것:
  - `/api/crm-local/leads/overview` 실제 응답 확인
  - `/api/crm-local/stats`에 `leads`, `lead_events`, `consents` 카운트 추가 확인
  - 현재 운영 데이터 적재 전이라 값은 모두 `0건`
- 검증:
  - `npm --prefix backend run typecheck` 통과
  - `node --import tsx --test tests/crm-local-lead.test.ts tests/crm-phase1.test.ts` 결과 `3 passed`
- 아직 안 된 것:
  - 실제 리드 마그넷 랜딩/퀴즈 UI는 없다
  - 운영 데이터가 아직 이 원장으로 들어오지 않는다
  - hard gate는 실행 코드가 생겼지만, 운영 실데이터와 실발송 로그에 아직 연결되지는 않았다

### P1-S1A
> PG attribution 원장 · success receiver · 토스 조인 진단 | Codex

왜 Phase 1에 들어가는가:
- 이 작업의 목적은 광고 리포트가 아니라 `checkout -> payment success -> toss approval`을 잇는 **전환 원장**을 만드는 것이다
- 즉 `Meta/TikTok/Google Ads` 이전에 필요한 계측/조인 레이어이므로 `Phase 5`가 아니라 `Phase 1`에 둔다
- 실험 원장과 별개처럼 보여도, 실제로는 이후 `P1-S1`의 conversion join 품질을 끌어올리는 선행 기반이다

이번 턴 실제 개발 결과:
- `seo/backend`에 표준 수신 엔드포인트 추가
  - `POST /api/attribution/checkout-context`
  - `POST /api/attribution/payment-success`
- capture mode 구분 추가
  - `live`
  - `replay`
  - `smoke`
- 원장 저장 방식:
  - 운영 DB가 현재 `read-only`라 `checkout_attribution_ledger` 테이블을 바로 만들 수 없었다
  - 대신 `seo/backend/logs/checkout-attribution-ledger.jsonl`에 append-only JSONL 원장으로 저장하도록 구현
- request context 저장 항목:
  - `ip`
  - `userAgent`
  - `origin`
  - `requestReferer`
  - `method`
  - `path`
- attribution payload 저장 항목:
  - `orderId`
  - `paymentKey`
  - `approvedAt`
  - `checkoutId`
  - `customerKey`
  - `landing`
  - `referrer`
  - `utm_*`
  - `ga_session_id`
  - `gclid/fbclid/ttclid`
- 진단 API 추가:
  - `GET /api/attribution/ledger`
  - `GET /api/attribution/toss-join`
  - `POST /api/attribution/replay/toss`
  - `GET /api/crm-phase1/ops`
- replay 보조 스크립트 추가:
  - `backend/scripts/attribution-replay-toss.ts`

현재 상태:
- workspace 코드 탐색 결과, 기존 `successUrl/server callback` 구현은 확인되지 않았다
- 따라서 위 2개 endpoint를 **표준 수신 진입점**으로 새로 만들었다
- `tb_sales_toss`는 운영 DB에서 조회 가능했고, 현재 확인치:
  - 전체 row `4,717`
  - `2026-03-01` 이후 row `1,701`
  - 최신 `approved_at` = `2026-03-29 03:32:18`
- smoke 검증 기준 JSONL 원장 row는 `2건`이다
  - `checkout_started 1건`
  - `payment_success 1건`
- replay 검증 기준 JSONL 원장 row는 `5건`이다
  - read-only `tb_sales_toss` 최근 승인건을 `payment_success` replay row로 적재
- 아직 고객 사이트가 새 receiver를 호출하지 않아 실제 live row는 `0건`이다
- 이번 턴 추가 개발:
  - GA4 `(not set)` 일자별 매출/구매 집계
  - 토스 승인 일자 집계와 receiver row를 같은 timeline으로 합치는 비교 로직
  - `/crm`의 `결제 귀속` 탭에서 `live / replay / smoke`를 분리한 카드와 표 추가
- 이번 턴 실측 결과:
  - `POST /api/attribution/replay/toss?startDate=2026-03-29&endDate=2026-03-29&limit=5&dryRun=false`
    - `tossRows 5`
    - `candidateRows 5`
    - `writtenRows 5`
  - 같은 조건 `dryRun=true` 재실행
    - `insertableRows 0`
    - `skippedExistingRows 5`
    - 즉 replay idempotency 동작 확인
  - `GET /api/crm-phase1/ops?startDate=2026-03-01&endDate=2026-03-30`
    - ledger total `7건`
    - capture mode 분포 `live 0 / replay 5 / smoke 2`
    - `payment_success` 기준 분포 `live 0 / replay 5 / smoke 1`
    - replay 기준 토스 조인 `5/5`
    - 전체 ledger coverage rate `83.3%`
    - replay ledger coverage rate `100%`
  - timeline 예시:
    - `2026-03-29`: GA4 `(not set)` 매출 `4,476,410원`, 토스 승인 `53건`, `payment_success 6건`, 이 중 `replay 5 / smoke 1 / live 0`
    - `2026-03-30`: GA4 `(not set)` 매출 `3,092,200원`, 토스 승인 `70건`, receiver row `0건`
    - `2026-03-28`: GA4 `(not set)` 매출 `7,530,007원`, 토스 승인 `34건`, receiver row `0건`

남은 일 (0401 시점):
- ~~실제 고객 사이트의 checkout 시작 시점과 payment success 시점에서 위 receiver를 호출해야 한다~~ → **✅ 완료 (0402)**
- DB write 권한 또는 승인 후 `JSONL -> DB ledger`로 승격한다
- ~~현재는 replay를 통한 조인 plumbing 검증까지 닫혔고, 최종적으로는 live receiver 1건 적재와 DebugView 수동 검증이 남아 있다~~ → **live row 3건 적재 완료**

### ★ P1-S1A Live Row + UTM 추적 달성 (0402)

**더클린커피(thecleancoffee.com)에서 live attribution 완성.**

달성 과정:
1. 아임웹 푸터에 V0 코드 삽입 → 결제완료 URL이 `shop_payment_complete`임을 확인 (기존 예상 `shop_order_done`과 달랐음)
2. ngrok free 경고 페이지가 시크릿 모드에서 fetch를 차단 → **Cloudflare Tunnel로 전환** (무료, 경고 페이지 없음)
3. V1 헤더 코드의 sessionStorage 키 불일치 발견 → 아임웹 자체 세션(`__bs_imweb_session`)에서 UTM을 직접 읽는 **V0.2 푸터 코드**로 개선
4. referrer URL에 결제 정보(paymentKey, amount, orderCode 등)가 포함됨을 발견 → **백엔드에 referrer 파싱 로직 추가**

live row 검증 결과:

| 항목 | 결과 |
|------|------|
| live row 수 | **3건** (orderId 3개) |
| orderId 자동 추출 | ✅ URL param `order_no`에서 |
| paymentKey 자동 추출 | ✅ referrer URL에서 |
| amount 자동 추출 | ✅ referrer URL에서 (`metadata.referrerPayment`) |
| source 필터링 | ✅ `?source=thecleancoffee_imweb&captureMode=live` |
| utmSource | ✅ `test` |
| utmMedium | ✅ `cpc` |
| utmCampaign | ✅ `p1s1a_verify` |
| gclid | ✅ `test_gclid_001` |
| landing | ✅ UTM 포함 전체 URL |

백엔드 변경:
- `attribution.ts`: `parseReferrerPaymentParams()` 추가, referrer→paymentKey fallback, source/clientObservedAt metadata 보존, `filterLedgerEntries()` 추가, `buildLedgerSummary`에 `countsBySource` 추가
- `routes/attribution.ts`: ledger GET에 `source`/`captureMode`/`limit` 쿼리 파라미터 필터링

인프라:
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:7020` → `*.trycloudflare.com` (무료, 경고 페이지 없음, CORS 정상)
- ngrok은 대체됨 (free 경고 페이지가 시크릿 모드에서 fetch 차단)

남은 것:
- 커피 Toss Secret Key 확보 → paymentKey 크로스 검증
- Cloudflare named tunnel (고정 URL) 전환
- 바이오컴(biocom.kr) 확장 — 결제완료 URL 패턴 확인 필요
- 운영 DB ledger 승격

### Toss API 연동 후 추가로 할 수 있는 것 (0401)

Toss 라이브 시크릿 키가 확보되어 아래가 **receiver 없이도 가능**해졌다:

**1. Toss API 직접 조회로 토스 조인 대체 (receiver 불필요)**
- `GET /v1/transactions?startDate=...&endDate=...` → 일별 전체 거래 목록
- `GET /v1/payments/orders/{orderId}` → 아임웹 orderId로 결제 상세 직접 조회
- 즉, 기존 `receiver → JSONL → toss-join` 경로 대신 **Toss API를 직접 호출하여 조인** 가능
- replay 없이도 orderId 매칭으로 토스 조인율을 산출할 수 있음

**2. PG 수수료 실비 확인 (정산 API)**
- `GET /v1/settlements` → 건별 `amount`, `fee`, `payOutAmount` 확인
- 현재 PG 수수료율: **3.63%** (카드 기준, 바이오컴 MID)
- 이 수치를 원가/이익 분석(커피 전략 Phase A/B)에 바로 활용 가능

**3. orderId 패턴 확인**
- orderId = `202603287152117-P1` (아임웹 주문번호 + `-P1` 결제 시퀀스)
- 이 패턴으로 `tb_iamweb_users.order_number`와 1:1 매칭 가능
- 가상계좌(amount=0) 건도 식별 가능

**4. 가상계좌 상태 추적**
- Toss 거래 목록에서 `method=가상계좌, amount=0` 건이 다수 확인
- 이 건들이 입금 완료/미입금/취소 중 어디인지 `GET /v1/payments/{paymentKey}`로 확인 가능

**현재 한계 (여전히 receiver가 필요한 것):**
- **UTM/referrer/landing 정보**: Toss API에는 결제 정보만 있고, 어디서 유입되었는지(UTM, gclid, fbclid)는 없음
- **GA4 session_id 연결**: Toss API만으로는 GA4 `(not set)` 원인을 확정할 수 없음
- **checkout 시작 시점**: Toss는 결제 승인만 기록. checkout 시작 → 이탈 추적은 receiver 필요

**결론:**
- Toss API 연동으로 P1-S1A의 **토스 조인 + PG 수수료 + 가상계좌 진단**은 receiver 없이도 가능해짐
- 하지만 **`(not set)` 원인 확정**과 **UTM attribution**은 여전히 live receiver가 필요
- ~~따라서 P1-S1A를 2단계로 분리하는 것이 현실적~~ → **A단계 + B단계 모두 완료 (0402)**
  - **A단계 (Toss API 기반)**: 토스 조인, PG 수수료, 가상계좌 진단 → ✅ 완료 (0401)
  - **B단계 (receiver 기반)**: UTM attribution, live row 적재 → ✅ **완료 (0402, 아임웹 푸터 코드 + Cloudflare Tunnel)**

실무 해석:
- `P1-S1A`는 receiver, JSONL ledger, 토스 조인, replay backfill, GA4 not-set 비교표, `/crm` 진단 화면, **live row + UTM 추적**까지 올라갔다
- A단계(Toss API)와 B단계(live receiver + UTM)가 **모두 닫혔다**
- 개발팀 배포 없이 **아임웹 푸터 코드 + Cloudflare Tunnel**로 B단계를 직접 해결
- 남은 것: 커피 Toss Secret Key 확보(크로스 검증), 바이오컴 확장, Cloudflare named tunnel(고정 URL), 운영 DB ledger 승격

### P1-S2
> 실험 목록/상세/KPI 화면 구현 | Claude Code

- 이번 턴 실제 개발:
  - `/crm` 페이지를 `후속 관리 / 실험 운영 / 결제 귀속` 중심의 Phase 1 운영 화면으로 고정
  - 실험 운영 탭:
    - `crm-local` 실험 목록/상세
    - 실험 생성 폼
    - 전환 동기화 버튼
    - variant KPI 테이블
    - variant 비교 recharts 차트
    - recent assignment 샘플 테이블
  - 결제 귀속 탭:
    - ledger rows / 토스 조인율 / GA4 `(not set)` 매출 / `(not set)` 랜딩 비율 카드
    - 날짜별 비교표
    - 다음 액션 체크리스트
  - UX 보강:
    - 선택된 실험이 없을 때 첫 실험 자동 선택
    - 새 실험 생성 후 바로 상세 화면으로 진입
- 현재 남은 blocker:
  - 화면 구현 자체는 닫혔다
  - 남은 것은 운영 배포와 실제 사용자 피드백 수집이다
  - `REVENUE_API_BASE_URL` bridge는 참고용 보조선이며, 현재 핵심 실험 화면은 `crm-local` 기준으로 이미 동작한다
- 검증:
  - `npm --prefix frontend run build` 통과
  - `/crm` 페이지 `HTTP 200`
  - `/api/crm-local/experiments` 실제 응답 확인
  - `/api/crm-phase1/ops` 실제 응답 확인

완료 기준:
- 특정 실험에 대해 `누가 control인지`, `누가 treatment인지`, `누가 구매했는지`를 조회 가능
- 운영자가 UI에서 실험 상태를 확인 가능
- 현재 판단:
  - UI와 로컬 검증 흐름은 이미 닫혔다
  - 남은 것은 운영 배포와 운영 기준 재검증이다

## Phase 2.5 상세 — 프리-구매 리드 마그넷 MVP

기간: 2026-04-14 ~ 2026-04-18

목표:
- 익명 방문자를 `lead_id` 기준으로 식별 가능한 리드 자산으로 전환
- 리드 마그넷 결과를 `problem_cluster`, `urgency_score`, `analysis_type_hint` 형태의 구조화 데이터로 남김
- 상담 예약, 첫 구매, 90일 가치까지 같은 계보로 추적

왜 별도 phase로 빼는가:
- 지금 로드맵은 주문/상담 이후가 강하고, 앞단 acquisition -> lead 구간이 비어 있다
- 이걸 별도 phase로 빼지 않으면 뒤로 밀릴 가능성이 높다
- PDF보다 진단형 퀴즈가 남기는 데이터 품질이 훨씬 높다

### P2.5-S1
> 리드 마그넷 ledger · 퀴즈 결과 저장 · consent/claim gate | Codex

- 현재 결정:
  - 1호 자산은 `3분 피로 원인 자가진단`
  - 결과는 `3~4개 problem_cluster`로 단순 분류
  - 다운로드 수가 아니라 `상담 예약률`, `첫 구매율`, `90일 순매출`로 평가
- 선행 조건:
  - `P0-S3` ontology 고정
  - `P1-S1B` lead ledger 실데이터 적재 시작
  - contact policy / quiet hours / suppression rule 확정

### P2.5-S2
> 진단형 리드 마그넷 랜딩/결과 화면 | Claude Code

- 필요한 화면:
  - 질문 시작 화면
  - 결과 요약 화면
  - 연락처 입력 후 상세 해석 화면
  - 상담 연결 CTA
- 중요한 원칙:
  - free PDF가 아니라 데이터 수집기처럼 설계
  - 결과 화면에서 claim review가 끝난 문구만 노출

### P2.5-S3
> 1호 자산 `3분 피로 원인 자가진단` 운영 실험 | Codex + Claude Code

- 측정 지표:
  - lead capture rate
  - consultation booking rate
  - first purchase rate
  - repeat net revenue 90d
- Phase 7과의 관계:
  - 구조는 지금 넣지만, 대규모 인과 실험은 checkout abandon / 상담 후속 측정이 더 안정화된 뒤에 확대한다

## Phase 2 상세 — 상담 원장 정규화 · 상담사 가치 분석

기간: 2026-04-07 ~ 2026-04-14

목표:
- `tb_consultation_records`를 CRM 실험과 상담사 가치 분석에 동시에 쓸 수 있게 정규화
- 상담 원장과 주문/LTR 원장을 customer 단위로 매칭
- 상담 후속 CRM과 상담사 채용 판단에 필요한 read-only 분석 API를 우선 확보

현재 실행 우선순위:
- 이 phase의 첫 구현 단위였던 `상담 CRM Read-only API`는 1차 구현 완료
- 상세 명세: `/Users/vibetj/coding/seo/docs/feature/spec-consultation-crm-readonly-1.0.md`

2026-03-27 구현 완료 범위:
- `GET /api/consultation/summary`
- `GET /api/consultation/managers`
- `GET /api/consultation/order-match`
- `GET /api/consultation/product-followup`
- `GET /api/consultation/candidates`
- 응답 shape/실측 `curl` 검증 완료
- 후보군 API는 DB 대형 join을 Node 집계 방식으로 바꿔 `completed_followup limit=3` 기준 약 `0.2s`까지 단축

### P2-S1
> 상담 상태 표준화 · 전화번호 정규화 · consultation API 5개 | Codex

- `tb_consultation_records.consultation_status` 표준화 규칙 구현 완료
- `customer_contact -> normalized_phone` 정규화/매칭 로직 구현 완료
- 상담 cohort coverage, 상담 완료 후 구매 전환율, 상담사별 건수/전환율/매출 집계 API 구현 완료
- `ltr_customer_cohort`에 `manager`를 넣는 변경안과 영향도 문서화
- `consultant_cost_monthly` 같은 비용 테이블 설계안 초안 작성

### P2-S2
> callprice 백엔드 API 5개 (overview/managers/analysis-types/scenario/options) | Codex

- 상담 후속 CRM 후보군 화면 기준 정의 완료
- 상담사 가치 분석 대시보드 KPI/필터/빈 상태 정의 완료
- `상담 완료`, `부재`, `변경` 상태별 운영 액션 acceptance criteria 정의 완료

### P2-S3
> `/callprice` 상담사 가치 분석 대시보드 프론트 | Claude Code

- 상담사 가치 분석 대시보드 구현 시작
- 상태 표준화 전/후를 운영자가 이해할 수 있는 UI 문구 적용
- `api/consultation/*` 필터, table, detail drawer 연결

### P2-S4
> `/crm` CRM 관리 페이지 (후속 관리 대상 리스트) | Claude Code

- 상담 후속 CRM 대상자 화면 구현 시작
- `api/consultation/*` 필터, table, detail drawer 연결

### P2-S5
> callprice 추가 UXUI (상품 믹스, 분포, 첫 구매일수) | Claude Code

- 상품 믹스 분석 화면
- 분포 시각화
- 첫 구매일수 분석 UI

완료 기준:
- 상담 원장 건수/상태/담당자 분포를 API로 재현 가능
- 상담 완료 고객과 주문/LTR 매칭률을 확인 가능
- DB 스키마 변경 승인 전에도 상담 가치 분석 1차 추정이 가능
- 운영자가 프론트에서 후보군 preview를 바로 확인 가능

## Phase 3 상세 — 실행 채널 연동 (채널톡 · 알리고)

기간: 2026-04-08 ~ 2026-04-17

메모:
- `gptprofeedback_0327_3.md`의 `Phase 3.5` 제안을 실제 실행상 더 앞당겨 배치했다.

목표:
- ChannelTalk를 v1 실행 레이어로 붙임
- `memberId = customer_key` 규칙과 Member Hash 체계를 고정
- 내부 원장과 ChannelTalk 이벤트명을 1:1로 연결
- stale 상태인 `channeltalk_users` 스냅샷을 신규 SDK/Open API 기준으로 복구
- 알리고 대행 API를 통해 카카오 알림톡/브랜드메시지를 CRM 대시보드에서 발송할 수 있게 함

우리 솔루션 기준 채널 선택 의견:
- **초기 실험 채널은 ChannelTalk 우선**이 맞다. 이유는 `customer_key`, 사이트 행동 신호, 상담 맥락과 가장 가깝기 때문이다.
- **운영 안내/대량 발송 채널은 Aligo 우선**이 맞다. 이유는 카카오 알림톡의 도달력, template 기반 운영 안정성, `mid/history` 기반 결과 추적이 분명하기 때문이다.
- ChannelTalk 장점: 고관여 후속, 상담 연결, 행동 기반 메시지, 실험 원장과의 연결성
- ChannelTalk 한계: 실제 사이트 삽입과 marketing on이 닫혀야 가치가 커진다
- Aligo 장점: 결과지/검체/예약/주문 안내 같은 정형 메시지, 대량 발송, 결과 추적
- Aligo 한계: template exact-match 제약이 강하고, 현재도 live 1건은 `메시지가 템플릿과 일치하지않음`으로 실패했다
- 내 판단: **고관여 실험은 ChannelTalk, 정형 운영 메시지는 Aligo**로 역할 분리가 가장 현실적이다

### P3-S1
> ChannelTalk SDK 래퍼 · identity/event 연동 규칙 | Codex

- 이번 턴 실제 반영:
  - Revenue 백엔드에 `GET /api/crm/channeltalk/sync-preview` 추가
  - Revenue 백엔드에 `POST /api/crm/channeltalk/sync-users` 추가
  - Revenue 백엔드에 `GET /api/crm/channeltalk/stale-users` 추가
  - Revenue 백엔드에 `POST /api/crm/channeltalk/campaign-preview` 추가
  - `crm_contact_policy_service.py` 추가
    - `consent`
    - `claim review`
    - `quiet hours`
    - `cooldown`
    - `frequency cap`
    - `recent purchase suppression`
    - `fallback channel`
- 지금 확인된 것:
  - `memberId = customer_key` 규칙이 preview/sync/campaign-preview 응답에서 고정된다
  - `dry_run`과 `live`가 분리돼 provider state 변경 없이 payload를 먼저 검증할 수 있다
  - stale 사용자 점검 query를 API로 바로 볼 수 있다
  - hard gate가 문서가 아니라 실행 코드로 올라왔다
- 아직 안 된 것:
  - 실제 고객 사이트 boot/updateUser/track live 삽입은 아직 프론트 배포가 남았다
  - `CHANNELTALK_LIVE_SYNC_ENABLED=true` 기준 provider live sync는 코드상 준비됐지만 운영 실행은 아직 안 했다
  - `marketing=false`라 campaign 실발송은 아직 blocked 상태다

### P3-S2
> ChannelTalk 프론트 래퍼 (boot/setPage/track/updateUser) | Claude Code

- ChannelTalk SDK boot 지점 확인 및 `memberId/memberHash/setPage/track` 삽입
- SPA 페이지명 명시
- 랜딩/체크아웃/구매완료 구간 이벤트 호출 추가

### P3-S3
> 알리고 알림톡 백엔드 전송 wrapper · 템플릿 관리 | Codex

현재 상태:
- SEO 백엔드에 아래 route 추가:
  - `GET /api/aligo/status`
  - `GET /api/aligo/health`
  - `GET /api/aligo/profiles`
  - `GET /api/aligo/templates`
  - `GET /api/aligo/quota`
  - `GET /api/aligo/history`
  - `GET /api/aligo/history/:mid`
  - `POST /api/aligo/test-send`
- `.env` alias 반영:
  - `ALIGO_Senderkey`
  - `ALIGO_KAKAOCHANNEL_ID`
- 실제 확인:
  - `7020 /health` 기준 `apiKey/userId/senderKey/senderPhone/kakaoChannelId = true`
  - `GET /api/aligo/health`는 provider `code=0`
  - `GET /api/aligo/templates`는 승인 템플릿 `42개`, 반려 `3개`
  - `GET /api/aligo/quota`는 `ALT_CNT=38119`
  - `POST /api/aligo/test-send`는 testMode 기준 `code=0`
  - `GET /api/aligo/history/1306113822`는 실제 발송 1건의 최종 결과를 반환
  - 같은 상세 조회에서 `rslt=U`, `메시지가 템플릿과 일치하지않음` 확인
- 해석:
  - 키 누락 단계도, 서버 IP whitelist 단계도 지났다
  - 지금 blocker는 **승인 템플릿과 실제 렌더링의 exact-match**다
- 아직 안 된 것:
  - live delivered 1건 성공
  - 발송 결과를 Phase 1/Phase 7 원장과 연결하는 로그 적재
  - `/crm` 발송 UI 연결

### P3-S4
> 알리고 알림톡 프론트 발송 UI (`/crm`에 통합) | Claude Code

- CRM 관리 화면(`/crm`)에 알림톡 발송 버튼/대화상자 추가
- 템플릿 선택 UI
- 발송 결과/잔여 포인트 표시

완료 기준:
- 내부 `customer_key`와 ChannelTalk `memberId`가 연결됨
- 첫 실험 시나리오를 ChannelTalk Campaign 또는 One-time message로 실행할 준비가 됨
- 테스트 모드로 알림톡 1건 발송 성공
- CRM 화면에서 대상자 선택 → 템플릿 선택 → 발송 흐름 동작

## Phase 4 상세 — 재구매 코호트 뷰 · 북극성 지표

기간: 2026-04-10 ~ 2026-04-17

목표:
- 내부 주문 데이터만으로 첫 구매 코호트 기반 재구매 뷰를 즉시 구축
- 북극성 지표(90일 재구매 순이익) 추적의 기본 화면

### P4-S1
> 코호트 재구매율/순매출 API · 결제채널/상품 분해 | Codex

- 첫 구매 월 코호트별 M+0/M+1/M+2/M+3 재구매율/주문수/순매출 API
- 첫 구매 결제채널별, 상품/카테고리별, 할인 사용 여부별 분해 필터
- 가능하면 gross profit 포함

2026-03-29 이번 턴 실제 반영:
- 기존 `GET /api/crm/repeat-purchase-cohorts`를 실사용 가능한 read-only API로 보강했다
- 핵심 변경:
  - `tb_iamweb_users`를 line-item 그대로 합산하지 않고 `order_number` 기준으로 먼저 dedupe
  - 응답에 `gross_revenue`, `refund_amount`, `net_revenue`, `repeat_net_revenue`를 분리
  - `segment_key`, `cohort_key`를 추가해 추후 `P7-S3` 실험 라벨을 얹을 수 있게 함
  - `north_star_proxy = repeat_net_revenue_90d` 임시 대체값을 summary에 추가
  - `first_purchase_channel` 명칭을 `first_payment_channel`로 정리하고 legacy alias만 남김
  - `fully_matured_cohort_only`, `mature_cohort_count`, `mature_customer_count`, `north_star_proxy_is_partial`를 추가해 최근 코호트 해석 사고를 막음
- 지원 필터:
  - `start_month`
  - `end_month`
  - `max_offset`
  - `first_payment_channel` (`pg_name/payment_method` 파생값)
  - `first_product`
  - `discount_used`
- 해석 규칙:
  - `first_payment_channel`은 acquisition source가 아니라 결제 레일이다
  - 진짜 유입채널은 추후 `acquisition_source` 또는 `first_touch_source`로 별도 분리해야 한다
- 이번 턴 보류:
  - `first_category`
    - 운영 DB에서 상품 카테고리 매핑키가 안정적으로 연결되지 않아 pending 처리
  - `gross profit`
    - 이번 턴 범위에서 제외

실데이터 확인치:
- 샘플 조건:
  - `start_month=2025-11`
  - `end_month=2026-01`
  - `max_offset=3`
  - `first_payment_channel=toss_card`
  - `discount_used=true`
- 결과:
  - cohort `3개`
  - customer `2,872명`
  - mature cohort `2개`
  - mature customer `1,831명`
  - `north_star_proxy_is_partial = true`
  - `repeat_net_revenue_90d = 45,134,699`
- 같은 조건에서 `fully_matured_cohort_only=true`로 다시 보면:
  - cohort `2개`
  - customer `1,831명`
  - `north_star_proxy_is_partial = false`
  - `repeat_net_revenue_90d = 45,134,699`

이번 턴 판단:
- `P4-S1`은 이제 운영자가 숫자를 잘못 읽을 가장 큰 위험인 `결제채널 vs 유입채널 혼동`과 `미성숙 코호트 섞임`을 대부분 막았다
- 남은 작업은 `first_category` 연결과 `gross profit`까지라서 진행률을 `95%`로 상향한다

reconciliation 메모:
- `2026-01` 기준 내부 주문 rollup net revenue는 `729,249,305`였다
- 같은 월 `sales summary grand_total`은 `828,322,954`였다
- 둘이 완전히 같지 않은 이유:
  - 코호트 API는 `tb_iamweb_users`만 쓰는 내부 주문 관점이다
  - `sales summary`는 토스/나이스/네이버/쿠팡/세금계산서/리커버리랩 등 채널 정산 집계다
  - 코호트 `M+0`는 `첫 구매가 그 달인 고객`만 포함하므로 월 전체 매출과 직접 같은 값이 아니다
  - 환불 반영 시점도 정산 테이블과 주문 테이블이 다를 수 있다

### P4-S2
> 코호트 히트맵/테이블 프론트 · 북극성 지표 카드 | Claude Code

- 코호트 히트맵/테이블 화면
- 기간/유입채널/상품 필터
- 북극성 지표 카드 (환불 반영 90일 재구매 순매출)

완료 기준:
- 월별 코호트 재구매율과 순매출을 한눈에 볼 수 있음
- 북극성 지표 임시 대체값 표시 가능

## Phase 5 상세 — Meta 광고 데이터 연동

기간: 2026-04-11 ~ 2026-04-24

목표:
- 광고비가 실제 실험/매출 분석과 연결되도록 함
- 최소한의 `campaign/adset/ad` 기준 비용 원장 확보
- Meta에 서버사이드 전환 신호를 보내 광고 최적화 품질을 높임

권장 순서:
1. Meta Marketing API/Ads Insights 읽기 연동
2. `utm_*`, `fbclid`, 랜딩 키 파라미터 정규화
3. 내부 캠페인 키와 Meta 캠페인 키 매핑

### P5-S1
> Meta Ads Insights 읽기 · meta_campaign_daily 적재 | Codex

- Meta spend sync 배치 구현
- `meta_campaign_daily` 적재
- Revenue 주문/실험 원장과 광고 캠페인 매핑 로직 구현
- 누락/권한 실패 시 fallback 로그 작성
- 캠페인/광고세트/소재 계층 구조 정의
- 필터/비교 규칙과 KPI 카드 정의
- 랜딩 소재 비교 화면 acceptance criteria 정의

### P5-S2
> 캠페인/광고세트 성과 프론트 UI | Claude Code

- 캠페인/광고세트 기준 성과 UI
- 랜딩 페이지/광고 소재별 비교 대시보드
- 마케터용 필터 UX 정리

### P5-S3
> Meta Conversions API 서버사이드 전환 전송 | Codex

기간: 2026-04-18 ~ 2026-04-24

- `lead`, `qualified_lead`, `purchase`, `subscribe`, `refund` 이벤트 정의
- Meta Conversions API 서버 전송 구현
- 이벤트 중복 방지 키 설계
- 주문 취소/환불 반영 정책 구현
- 랜딩/폼/체크아웃 전환 정의와 이벤트 naming rule 고정
- 운영 콘솔에서 실험별 전환 이벤트 표시 기준 정의
- 랜딩/폼/체크아웃 이벤트 발생 지점 정리
- 실험별 전환 이벤트 라벨을 운영 UI에 노출

왜 이 시점인가:
- 지금 Meta 광고가 이미 돌고 있으므로 광고비 원장이 늦어지면 iROAS 해석이 왜곡된다
- 그러나 `customer_key`와 실험 스키마가 먼저 없으면 광고 데이터는 단순 리포트에 그친다

완료 기준:
- 날짜별 광고비/노출/클릭이 DB에 쌓임
- 실험 결과 화면에서 최소 campaign 레벨 비용이 보임
- 서버에서 Meta로 핵심 전환 이벤트 전송
- 내부 원장과 Meta 전환 이벤트 naming이 일치

## Phase 6 상세 — 카카오 CRM 실행 레이어

기간: 2026-04-25 ~ 2026-05-02

핵심 판단:
- **카카오톡 "단일 CRM API"가 따로 있는 것은 아니다**
- 대신 아래를 조합해야 한다
  - 카카오톡 채널 고객파일 관리 API
  - 카카오톡 채널 관계 조회
  - 알림톡/브랜드메시지/친구톡 같은 발송 수단
- 일반 카카오 메시지 API는 서비스 사용자 간 메시지 전송 용도라 대규모 CRM 발송 주력 수단으로 보기 어렵다

권장 적용:
- 운영성 알림: 알림톡
- 재구매/리텐션 타겟팅: 카카오톡 채널 고객파일 기반 메시지

### P6-S1
> 카카오 고객파일 export · 발송 로그 적재 | Codex

- 카카오 대상자 export 포맷/고객파일 업로드 파이프라인 설계
- 카카오 발송 상태 로그를 `crm_message_log`에 적재
- 채널 관계/동의 상태 반영 로직 설계
- 카카오 실패 시 재시도/대체 채널 정책 설계
- 발송 대상 미리보기/실패 사유/동의 상태 노출 기준 정의
- 카카오 채널 가입/동의 UX acceptance criteria 정의

### P6-S2
> 발송 대상 미리보기 · 상태/실패 UI | Claude Code

- 발송 대상 미리보기
- 발송 상태/실패 사유 UI
- 카카오 채널 가입/동의 UX 연결 포인트 설계

왜 이 시점인가:
- 카카오는 발송 채널이지, 실험 원장을 대체하지 않는다
- 먼저 실험/비용/전환 구조를 만든 뒤 붙여야 의미가 있다
- 한국형 CRM에선 중요하지만, 너무 먼저 붙이면 운영 자동화만 생기고 측정 정확도는 안 생긴다

완료 기준:
- 최소 1개 시나리오에서 카카오 발송 로그가 실험 원장에 연결됨

## Phase 7 상세 — 1차 증분 실험 운영

기간: 2026-05-03 ~ 2026-05-16

목표:
- 실제 control/treatment 실험 1개를 라이브로 돌림
- iROAS를 처음 계산함
- 1차 실행 채널은 ChannelTalk를 우선 사용함

1차 추천 시나리오:
1. 체크아웃 이탈 6시간 리마인드 vs 24시간 리마인드
2. 상품 조회 후 24시간 미구매 재접촉
3. 첫 구매 후 21일 미재구매 윈백
4. 상담 완료 후 7일/14일 영양제 후속
5. 상담 부재/변경 고객 리콜
6. **서울 고객 리커버리랩 방문 쿠폰 실험** (P7-S4, P7-S5)

### P7-S1
> 실험 배정 · conversion window · iROAS 계산 API | Codex

- 실험 배정 로직 구현
- conversion window 처리
- 환불/취소 포함 iROAS 계산 API 구현
- 리포트 SQL 검증
- 주문형/상담형 실험을 같은 원장에서 비교 가능한지 검증
- 실험 운영 대시보드 구조 정의
- 실시간 상태 배지와 비교 차트 acceptance criteria 정의

### P7-S2
> 실험 운영 대시보드 · 대조군/실험군 비교 차트 | Claude Code

- 실험 운영 대시보드
- 실시간 상태 배지
- 대조군/실험군 비교 차트
- 운영자 액션 로그 UI

### P7-S3
> 코호트에 실험 라벨 얹기 (treatment/control/campaign_id) | Codex

- 첫 구매 월 코호트별 `M+0/M+1/M+2...` 재구매율/주문수/순매출 API 제공
- `treatment/control`, `message_exposed`, `channeltalk_campaign_id`를 얹을 수 있는 데이터 계약 정의
- 코호트 히트맵/라인차트/테이블 화면 기준 정의
- 메시지 노출 여부 비교 UX acceptance criteria 정의
- 코호트 히트맵/라인차트/테이블 화면 정리
- 메시지 노출 여부와 cohort 비교 UI 설계

### P7-S4
> 리커버리랩 방문 쿠폰 CRM 실험 — 세그먼트/콘텐츠/발송/측정 | Codex

목표:
- 서울 거주 고객 세그먼트에 리커버리랩 방문 유도 쿠폰/콘텐츠를 발송하고 방문 전환을 측정
- 온라인 구매 고객 → 오프라인 방문 전환 경로를 검증

왜 하는가:
- 오프라인 접점(리커버리랩)은 고객 LTV를 크게 높일 수 있는 채널이지만, 현재 온라인-오프라인 연결이 없음
- 서울 고객이라는 지역 세그먼트로 좁히면 대상이 명확하고 비용 통제가 쉬움
- 쿠폰/콘텐츠 A/B로 어떤 메시지가 방문을 더 잘 끄는지 데이터를 확보할 수 있음

세그먼트 설계:
- 조건: 주문 이력 있는 고객 중 배송지 또는 연락처 지역이 서울
- 추가 필터: 검사 완료 후 상담 경험 있는 고객 우선 (상담 후 영양제 구매 전환이 높으므로)
- 대조군: 같은 조건이지만 쿠폰/콘텐츠를 보내지 않는 holdout 그룹

실험 시나리오 후보:
1. **방문 쿠폰**: "리커버리랩에서 첫 바이오해킹 체험 30% 할인" 알림톡/채널톡 발송
2. **콘텐츠형**: "당신의 검사 결과로 맞춤 프로그램을 추천합니다" + 리커버리랩 소개 콘텐츠
3. **A/B 비교**: 쿠폰 vs 콘텐츠 중 방문 전환이 높은 쪽 확인

발송 채널:
- 1순위: 알리고 알림톡 (한국형 리치율 높음)
- 2순위: 채널톡 Campaign
- 쿠폰 코드를 발급하여 오프라인 방문 시 사용 여부로 전환 추적

측정 지표:
- 쿠폰 발급 수 / 쿠폰 사용(방문) 수 / 방문 전환율
- 방문 후 추가 구매 여부 (90일 윈도우)
- 발송 비용 대비 방문 고객 매출 (오프라인 iROAS)

- 배송지/연락처 기반 서울 고객 세그먼트 추출 쿼리
- 쿠폰 코드 생성/발급/사용 추적 테이블
- 방문 전환 로그를 실험 원장(`crm_conversion_log`)에 연결
- 오프라인 방문 확인 방법 설계 (쿠폰 코드 입력, QR, 수기 확인 등)

### P7-S5
> 리커버리랩 방문 쿠폰 실험 프론트 — 대상자 확인/발송/성과 UI | Claude Code

- CRM 관리 화면에 "리커버리랩 방문 캠페인" 섹션 추가
- 서울 고객 대상자 미리보기 · 쿠폰 발급 상태 표시
- 발송 후 쿠폰 사용/미사용 현황 대시보드
- 방문 전환율 · 방문 후 추가 구매 성과 카드

완료 기준:
- 1개 실험이 end-to-end로 동작
- `incremental revenue`, `iROAS`, `refund adjusted net revenue` 확인 가능
- 상담형 실험도 대상자 규모와 매칭률 기준으로 라이브 후보 여부를 판단 가능
- 코호트는 단순 참고 화면이 아니라 타깃 선정/holdout 검증 화면으로 확장 가능한 상태가 됨

## Phase 8 상세 — UX 정성 데이터 · 도구 도입 판단

기간: 2026-05-03 ~ 2026-05-31

목표:
- Meta 랜딩/체크아웃 페이지에서 왜 이탈하는지 정성 신호를 확보
- AI Agent가 UX 개선 가설을 만들 수 있게 함
- Amplitude/Mixpanel/Braze MCP 도입 필요 여부 판단

권장안:
- 신규 도입이면 Hotjar보다 **Contentsquare Free 우선 검토**
- 이유:
  - 2026-03-27 기준 Hotjar 문서에서 Contentsquare Free 전환을 적극 안내
  - Funnels, Error Monitoring, GA4/Mixpanel 연동, AI trial이 함께 제공됨

### P8-S1
> Contentsquare/Hotjar 트래킹 삽입 · 계측 | Claude Code

- 랜딩/체크아웃에 tracking snippet 설치
- 핵심 CTA 클릭/폼 오류/스크롤 depth 계측
- 설문/피드백 위젯 삽입
- 세션 ID와 내부 실험 ID 매핑 규칙 설계
- 주간 UX insight summary 파이프라인 설계
- AI Agent 입력용 요약 포맷 정의
- 설문/리플레이/히트맵에서 어떤 신호를 어떤 화면 개선으로 연결할지 기준 정의
- 랜딩/체크아웃 friction 유형 taxonomy 정의

### P8-S2
> Amplitude/Mixpanel/Braze MCP 도입 필요 여부 판단 | Codex

기간: 2026-05-17 ~ 2026-05-31

원칙:
- 초반에는 `GA4 + 내부 원장 + SQL/API`로 충분하다
- 아래 신호가 생길 때 도입 검토한다

도입 검토 신호:
- 마케터/기획자가 SQL 없이 퍼널/코호트/리텐션을 자주 보고 싶다
- 실험이 3개 이상 병행된다
- 세션 리플레이와 이벤트 분석을 한 화면에서 보고 싶다
- GA4만으로는 사용자 단위 실험 분석이 번거롭다

권장 우선순위:
1. `Amplitude` 우선 검토
2. `Mixpanel` 대안 검토
3. 둘 다 동시에 도입하지 않음

Amplitude를 먼저 보는 이유:
- 이후 Braze 계열로 갈 경우 연동 스토리가 상대적으로 자연스럽다
- 웹 분석, 세션 리플레이, 실험/성장 분석 연결이 편하다

Mixpanel을 보는 경우:
- 이벤트 퍼널 중심 팀이고 구현 속도를 더 중시할 때
- 비교적 단순하고 빠른 self-serve event analytics가 필요할 때

도입하지 않아도 되는 조건:
- 실험 수가 적고
- SQL/API 리포트로 의사결정이 충분하며
- Claude/Codex가 운영 리포트 자동화까지 커버할 수 있을 때

- 현재 내부 API/SQL 리포트로 커버 가능한 범위 측정
- Amplitude/Mixpanel/Braze MCP 도입 필요 조건 체크리스트 작성
- self-serve analytics가 필요한 화면/질문 목록 정의
- 어떤 분석이 현재 대시보드로 부족한지 UX 관점 기준 정의
- 도입 결정 전에는 실제 프론트 구현 없음, 도입 시 연결될 화면 후보만 정리

중요:
- AI Agent는 히트맵/리플레이/설문을 기반으로 **전환 저해 요인 가설**을 제시할 수 있다
- 그러나 "전환율이 실제로 올랐는지"는 반드시 A/B 실험과 iROAS 결과로 검증해야 한다

완료 기준:
- 매주 AI Agent가 UX 개선 가설 3~5개를 자동 정리
- 그중 최소 1개는 실험 설계로 이어짐

#### 0401 추가 판단 — Braze MCP / Salesforce 검토 의견

결론:
- **Braze MCP는 지금 당장 필수는 아니다.**
- 지금 바이오컴의 가장 큰 병목은 `메시지 오케스트레이션 도구 부족`이 아니라 `실험 원장`, `결제 귀속`, `실발송 exact-match`, `send log 적재`다.
- 따라서 권장 순서는 `P1/P3/P7 핵심 원장 닫기 -> Braze 자체 채택 필요성 검토 -> 그 다음 Braze MCP 판단`이다.
- **Braze를 아직 실행 source of truth로 쓰지 않는데 Braze MCP만 먼저 붙이는 선택은 권하지 않는다.**

왜 지금은 우선순위가 낮은가:
- 현재 실행 채널은 `ChannelTalk + Aligo + 내부 원장` 조합으로도 첫 operational live를 여는 데 충분하다.
- Braze MCP는 `Braze 안에 있는 캠페인/캔버스/세그먼트/콘텐츠`를 AI가 더 쉽게 읽고 점검하게 해 주는 보조 레이어에 가깝다.
- 즉, Braze MCP는 `지금 없는 핵심 데이터`를 대신 만들어 주지 않는다.
- 현재 필요한 것은 `누구에게 보냈고`, `무엇이 실패했고`, `그 사람이 실제로 샀는지`를 내부 장부로 먼저 닫는 일이다.

Braze MCP가 필요해질 수 있는 시점:
- 실행 채널이 `이메일 + SMS/알림톡 + 푸시 + 인앱/웹`처럼 3개 이상으로 늘어날 때
- 월 단위 active journey/campaign가 5개 이상으로 늘어 운영자가 자연어로 상태를 묻고 싶어질 때
- 마케터가 엔지니어 도움 없이 `현재 어떤 세그먼트가 어떤 메시지를 받고 있는지`를 AI에게 바로 묻고 싶을 때
- Braze가 실제 실행 source of truth가 되어 `캠페인/캔버스/세그먼트 메타데이터`를 AI가 직접 읽는 가치가 생길 때
- 내부 BI보다 `운영 QA 속도`와 `마케터 self-serve`가 더 큰 병목이 될 때

앞으로도 Braze MCP가 필요 없을 조건:
- 실행 채널이 계속 `ChannelTalk + Aligo + 내부 DB` 중심으로 유지될 때
- 모바일 앱/푸시/대규모 이메일 운영 계획이 없을 때
- active journey 수가 적어 운영자가 화면 2~3개만 봐도 충분할 때
- AI가 내부 API와 send log만으로도 운영 질문에 답할 수 있을 때

판단 기준:
1. **실행 source of truth가 어디인가**
   - 내부 장부가 정본이면 Braze MCP 우선순위는 낮다.
   - Braze가 정본이 되면 Braze MCP 가치가 커진다.
2. **채널 복잡도가 얼마나 높은가**
   - 채널이 늘수록 Braze 계열 가치가 커진다.
3. **운영팀 self-serve 요구가 얼마나 강한가**
   - 마케터가 SQL/API 없이도 상태를 바로 읽어야 하면 도입 검토 가치가 올라간다.
4. **현재 병목이 무엇인가**
   - attribution/identity/experiment rigor가 병목이면 Braze MCP보다 내부 원장이 우선이다.
   - journey 운영 QA가 병목이면 Braze MCP 가치가 올라간다.
5. **비용 대비 효과가 얼마나 빠른가**
   - 첫 90일 안에 운영 속도와 QA 품질이 눈에 띄게 오르지 않으면 보류가 맞다.

예상 효과:
- 운영팀이 `어제 어떤 대상에게 어떤 메시지가 나갔고 무엇이 실패했는가`를 더 빨리 확인할 수 있다.
- AI Agent가 세그먼트/메시지/캔버스 메타데이터를 바로 읽어 운영 QA, 체크리스트, 개선 제안을 자동화하기 쉬워진다.
- 다만 **Braze MCP만으로는** `(not set)` 귀속 문제, 실험 uplift 판정, PG exact-match 같은 현재 핵심 병목은 해결되지 않는다.

현재 권장 판단:
- **2026년 상반기에는 Braze MCP 도입을 보류하는 쪽이 맞다.**
- `P7-S1` 이후에도 채널이 복잡해지고 운영 화면만으로 감당이 안 될 때 다시 검토한다.
- 다시 말해 **필요할 수는 있지만, 지금은 아니다.**

Salesforce에서 검토할 만한 다른 솔루션:
1. **Marketing Intelligence**
   - 현재 Salesforce 계열에서 가장 먼저 검토할 가치가 있다.
   - 이유: 광고 성과 데이터 연결, 자동 정규화, attribution reporting 쪽이 지금 바이오컴 문제와 가장 가깝다.
   - 특히 `Google Ads / Meta / TikTok / Google Analytics` 데이터를 한 번에 조화롭게 보는 니즈가 커질 때 맞는다.
2. **Data Cloud**
   - `주문/상담/광고/채널톡/알리고`를 고객 단위로 강하게 묶어야 하고, identity resolution과 consent governance가 병목이 될 때 검토한다.
   - 지금은 내부 `customer_key`와 실험 원장을 먼저 닫는 것이 우선이다.
3. **Marketing Cloud Engagement**
   - 나중에 실행 채널을 `이메일/SMS/WhatsApp/웹 journey`까지 본격 확장하고, Salesforce를 실행 정본으로 삼을 때 검토한다.
   - 현재는 ChannelTalk/Aligo가 더 가볍고 빠르다.
4. **Salesforce Personalization**
   - 사이트/앱에서 실시간 추천, 콘텐츠 타게팅, 행동 기반 개인화가 핵심 과제가 될 때 검토한다.
   - 보통 Data Cloud 또는 별도 identity 체계가 먼저 정리된 뒤가 맞다.
5. **우선순위 낮음**
   - `Account Engagement`는 B2B 리드 육성 성격이 강해 현재 바이오컴의 D2C CRM 우선순위와는 거리가 있다.
   - `Loyalty Management`는 포인트/등급 프로그램을 실제로 운영할 때가 아니면 지금 당장 볼 필요는 없다.

## 5-A. Codex 담당 작업 계획 보강 (2026-03-29 추가)

정리 원칙:
- 상단 Sprint 표에서 `담당 = Codex`인 항목만 다시 분류한다
- 상태는 `즉시 착수`, `승인 패키지 준비`, `외부 자격증명 대기`, `후행`, `완료 후 지원`으로 나눈다
- 이미 구현된 항목은 재개발이 아니라 `종결 조건`, `프론트 handoff`, `후속 스키마 영향도` 중심으로 정리한다

### 5-A-1. Codex Sprint 분류표

| Sprint | 현재 분류 | Codex 다음 액션 | 선행조건 | 검증 기준 |
|--------|----------|-----------------|----------|-----------|
| `P0-S1` | 완료 | `phase0-blueprint` 실데이터 계약 API, 이벤트 사전, 필드 매핑 초안 완료 | 없음 | `customer_key/contact/status/channel/instrumentation` 계약을 API로 조회 가능 |
| `P1-S1` | 승인 패키지 준비 | 최소 원장 4개 테이블 우선 구현안과 migration 요청서 작성 | DB 스키마 승인 | 샘플 실험 1건에 대해 control/treatment/purchase 조회 가능 |
| `P1-S1A` | 진행 중 | `checkout/payment success` 표준 receiver와 토스 조인 진단 운영 | 실제 고객 사이트 receiver 호출 연결 | 원장 row 적재 + `paymentKey/orderId` 기준 조인율 확인 |
| `P2-S1` | 완료 후 지원 | `ltr_customer_cohort.manager` 변경안, `consultant_cost_monthly` 초안, 프론트 연동 질의 대응 | 없음 | 기존 consultation API 5개 회귀 이상 없음 |
| `P2-S2` | 완료 후 지원 | callprice 응답 계약 고정, 프론트 추가 요구 대응, 성능 이슈 대응 | 없음 | 기존 `/callprice` API와 대시보드 연결 유지 |
| `P3-S1` | 진행 중, backend 80% | ChannelTalk sync-preview/sync-users/stale-users/campaign-preview 운영 연결 | 실제 고객 사이트 SDK live 삽입, `CHANNELTALK_MARKETING_ENABLED`, optional `CHANNELTALK_MEMBER_HASH_SECRET` | preview/dry_run/live 구분 + live 이벤트 1건 확인 |
| `P3-S3` | 진행 중, 운영 blocker 확인 | 알리고 wrapper, 템플릿/잔액/결과조회, test send route 운영 연결 | 승인 템플릿 exact-match, send log 적재 | `history/:mid`에서 live delivery 성공 1건 확인 |
| `P4-S1` | 즉시 설계, 승인 전 read-only 구현 가능 | 코호트 API를 read-only로 먼저 열고 gross profit은 후행 | 기존 주문 데이터 read-only 접근 | 월 코호트 재구매율/순매출 집계가 기존 매출 기준과 일치 |
| `P5-S1` | 자격증명 대기, 사전 설계 가능 | Meta 비용 ingest 명세와 캠페인 매핑 규칙 확정 | Meta Marketing API 권한 | 일자별 spend 적재 + Ads Manager 표본 대조 |
| `P5-S3` | 후행 + 자격증명 대기 | 서버사이드 전환 이벤트와 dedupe key 설계 | Meta 권한 + P0/P1 이벤트 고정 | 내부 이벤트명과 Meta 전환 이벤트명이 일치 |
| `P6-S1` | 후행 | 카카오 고객파일 export와 발송 로그 계약 설계 | 카카오 운영 자산 + P1 원장 | 최소 1개 시나리오에서 발송 로그 연결 |
| `P7-S1` | 후행 | 첫 라이브 실험용 assignment/window/iROAS API 구현 | P1 원장 + P5 비용 + 첫 시나리오 확정 | 실험 1건 end-to-end 동작 |
| `P7-S3` | 후행 | 코호트 API에 `treatment/control/campaign_id` 라벨 계약 추가 | P4 코호트 API + P1 실험 라벨 | cohort 화면에서 실험 라벨 조회 가능 |
| `P7-S4` | 후행, 운영정책 결정 필요 | 서울 세그먼트/쿠폰 원장/오프라인 방문 확인 방식 설계 | P1 원장 + P3/P3-S3 채널 + 쿠폰 운영 정책 | 세그먼트 추출, 쿠폰 발급, 방문 매핑까지 닫힘 |
| `P8-S2` | 즉시 문서화 가능 | Amplitude/Mixpanel/Braze MCP 도입 판단 체크리스트 작성 | 없음 | 도입/보류 결론을 1페이지로 설명 가능 |

### 5-A-2. 다음 2주 Codex 실행 순서

1. `P0-S1`은 완료 처리한다. 이후 Meta/ChannelTalk/실험 원장은 `phase0-blueprint` 계약을 기준으로 이어간다.
2. 다음 우선순위는 `P3-S1`이다. 프론트 SDK v1과 백엔드 상태 API는 이미 있으므로, 지금은 `memberId = customer_key` 계약을 실제 boot/updateUser/track 호출과 묶어 닫으면 된다.
3. `P2-S1`, `P2-S2`는 신규 개발보다 종결 작업으로 전환한다. 즉, 프론트 handoff 대응, 성능 이슈 대응, `manager` 컬럼 변경안/비용 테이블 초안을 정리한다.
4. `P4-S1`은 승인 없이도 read-only API 프로토타입을 먼저 진행한다. 북극성 지표의 임시 대체값인 `환불 반영 90일 재구매 순매출`은 지금 데이터로 계산 가능하다.
5. 위 1~4가 정리되면 `P1-S1` 승인 패키지를 올린다. 여기서 최소 범위는 `crm_experiments`, `crm_assignment_log`, `crm_message_log`, `crm_conversion_log` 4개 테이블이다.
6. 외부 자격증명 의존 작업은 병렬로 체크리스트만 준비한다. `P5-S1`, `P5-S3`, `P6-S1`은 키가 열리는 즉시 착수할 수 있게 endpoint, env, 검증 절차를 문서로 먼저 묶는다. `P3-S3`는 이제 키/IP 단계가 아니라 템플릿 렌더링과 send log 적재 단계다.

### 5-A-3. 즉시 착수 대상 세부 메모

#### `P0-S1` 마감 계획

- `customer_key v1` 원칙:
  - 내부 주문/LTR 기준 식별자를 우선 키로 사용하고, `normalized_phone`, `normalized_email`은 매칭용 alias로 둔다
  - `ChannelTalk memberId`는 source of truth가 아니라 `customer_key`의 외부 투영값으로 취급한다
  - 결과물은 신규 테이블 생성 전에도 설명 가능한 `identity priority table` 형태로 먼저 고정한다
- 이벤트 사전 1차 범위:
  - `product_view`
  - `add_to_cart`
  - `checkout_started`
  - `checkout_abandoned`
  - `message_sent`
  - `message_clicked`
  - `purchase`
  - `refund_completed`
- DDL 초안 범위:
  - 즉시 필요한 테이블과 후행 테이블을 분리한다
  - 즉시 구현분: 실험, 배정, 메시지 로그, 전환 로그
  - 후행 구현분: 비용 원장, audience snapshot, 상담사 비용
- 검증:
  - 상담 API에서 이미 쓰는 전화번호 정규화 규칙과 충돌이 없는지 확인
  - `tb_consultation_records`, `tb_iamweb_users`, `ltr_customer_cohort`, `channeltalk_users`를 기준으로 필드 매핑표 작성

#### `P3-S1` 마감 계획

- 현재 확인된 현실:
  - `CHANNELTALK_ACCESSKEY`, `CHANNELTALK_ACCESS_SECRET`, `CHANNELTALK_PLUGIN_KEY`는 확인됨
  - `CHANNELTALK_MEMBER_HASH_SECRET`는 아직 없음
  - `/api/channeltalk/status`, `/api/channeltalk/health`는 이미 동작
- 따라서 v1 운영 방침:
  - 지금은 `memberHash optional`로 두고 `memberId = customer_key`를 먼저 고정한다
  - Member Hash는 프론트/백엔드 양쪽 배포 준비 후 활성화한다
- Codex 세부 작업:
  - boot/updateUser/track에서 공통으로 넘길 사용자 식별 필드 목록 정의
  - 페이지명 규칙과 이벤트 naming rule을 Claude Code가 바로 쓸 수 있게 표로 정리
  - `channeltalk_users.lastSeenAt` stale 상태를 신규 SDK/Open API 결과와 비교할 검증 쿼리 설계
  - Campaign 운영 화면에 필요한 최소 응답 shape를 `/crm` 기준으로 문서화
- 검증:
  - 백엔드 상태 API 2종 응답 확인
  - 프론트에서 샘플 이벤트 1개 이상을 내부 사전 이름과 일치하게 호출 가능한지 확인

#### `P4-S1` 선행 계획

- 구현 순서:
  1. 첫 구매일 기준 코호트 정의 SQL 고정
  2. `M+0/M+1/M+2/M+3` 재구매율, 주문수, 환불 반영 순매출 API 제공
  3. 유입채널/상품/카테고리/할인 사용 여부 필터 추가
  4. 성능이 부족할 때만 materialized view 또는 배치 캐시를 검토
- 범위 제한:
  - gross profit은 마진/비용 원장 없이는 추정 오차가 크므로 후행
  - 먼저 `Repeat Net Revenue 90D`를 북극성 임시 대체값으로 고정
- 검증:
  - 기존 매출 대시보드 총합과 코호트 합산 값이 기간 기준으로 크게 어긋나지 않는지 대조
  - 이후 `P7-S3`가 붙을 수 있게 응답에 cohort key를 남긴다

#### `P1-S1` 승인 패키지 계획

- 구현 우선순위:
  1. `crm_experiments`
  2. `crm_assignment_log`
  3. `crm_message_log`
  4. `crm_conversion_log`
- 최소 API 범위:
  - 실험 생성/조회
  - assignment 조회
  - conversion 요약 조회
- 배정 로직 원칙:
  - 발송 성공 여부와 분리된 `assignment first` 구조
  - `holdout_ratio`와 `assignment_version`을 저장하여 재현 가능성 확보
- 검증:
  - 샘플 실험 1건을 넣고 100명 정도의 모의 assignment 결과를 고정 시드로 재현
  - 구매/환불 샘플 이벤트를 넣어 실험 단위 집계가 닫히는지 확인

### 5-A-4. 승인/자격증명 선행 체크리스트

- DB 승인 필요:
  - `P1-S1` 원장 4개 테이블
  - `P2-S1`의 `ltr_customer_cohort.manager` 변경
  - `consultant_cost_monthly`
  - `P7-S4` 쿠폰 발급/사용 추적 테이블
- 자격증명 필요:
  - 알리고: 운영 환경에도 `ALIGO_API_KEY`, `ALIGO_USER_ID`, `ALIGO_SENDER_PHONE`가 같은 값으로 반영돼 있는지 재확인
  - Meta: Ads Insights 접근 토큰, 계정/광고계정 식별값, Conversions API 전송 키
  - 카카오: 고객파일 업로드 및 채널 운영 권한 확인
- 운영정책 필요:
  - 첫 라이브 실험을 `체크아웃 이탈`로 확정할지
  - 알림톡 템플릿 승인/검수 담당자 지정
  - 리커버리랩 방문 쿠폰의 발급 방식과 오프라인 사용 확인 방식 확정

## 6. 외부 연동별 최종 판단

### 6-1. Meta 광고 API

판단: **연동 추천, 단 2단계로 나눠서 진행**

1단계:
- Marketing API/Ads Insights로 광고비/노출/클릭 수집

2단계:
- Conversions API로 서버사이드 전환 전송

즉시 붙이는 이유:
- 현재 광고 집행 중이라 비용 데이터 없이 CRM 실험 해석이 반쪽짜리가 된다

바로 붙이면 안 되는 이유:
- 내부 원장과 식별키가 없으면 Meta API는 단순 매체 리포트로 끝난다

### 6-2. 카카오 CRM API

판단: **“있다/없다” 식으로 보면 안 되고, 목적별 조합형 연동으로 봐야 한다**

- 있다:
  - 카카오톡 채널 고객파일 관리 API
  - 카카오톡 채널 관계 조회
  - 알림톡/비즈메시지 계열
- 없다:
  - 이메일 CRM처럼 모든 것을 한 번에 처리하는 단일 공용 “카카오 CRM API”

연동 필요성:
- 한국 사용자 재구매/리텐션 채널로는 충분히 중요하다
- 다만 `실험 원장 + ChannelTalk 1차 루프` 이후에 붙여야 한다
- 채널 구독/동의/템플릿 운영체계가 없으면 먼저 붙여도 운영비만 증가할 수 있다

### 6-2.5. ChannelTalk 실행 레이어

판단: **지금 바로 붙일 1차 실행 채널**

- 이유:
  - 이미 사용 중일 가능성이 높다
  - 웹/앱 이벤트 기반 Campaign 운용이 빠르다
  - `memberId`와 사용자 프로필 동기화 구조를 만들면 내부 DB와 연결하기 쉽다
- 원칙:
  - 실행/운영: ChannelTalk
  - source of truth: 내부 DB
  - 내장 campaign 통계는 참고치, 최종 판정은 `incremental gross profit / iROAS`

### 6-3. Amplitude/Mixpanel

판단: **초기 필수 아님**

- Phase 0~5에서는 보류
- Phase 7 판단 게이트에서 검토
- 먼저 필요한 것은 event schema, ledger, incremental experiment

### 6-4. Hotjar/Contentsquare + AI Agent

판단: **정성 인사이트용으로 추천**

가능한 것:
- AI 요약 기반 UX 문제 후보 추출
- 설문/리플레이/히트맵 기반 개선 가설 생성
- 랜딩/폼/체크아웃 friction 탐지

불가능한 것:
- “AI가 좋다고 한 변경”만으로 전환 상승을 확정하는 것

정답 구조:
- 정성 인사이트는 Hotjar/Contentsquare
- 인과 검증은 control/treatment 실험 + iROAS

## 7. TJ님 의사결정 포인트

우선 확정이 필요한 것:

1. 첫 라이브 실험 시나리오를 `체크아웃 이탈`로 갈지 여부
2. 카카오 채널/알림톡 운영 자산이 이미 있는지 여부
3. Meta 자격증명 접근 권한을 언제 열 수 있는지
4. Hotjar 대신 Contentsquare Free로 바로 갈지 여부
5. DB 스키마 추가 승인을 언제 받을지

## 8. 참고한 공식 문서

- Meta Marketing API 공식 Postman 개요: https://www.postman.com/meta/facebook-marketing-api/documentation/0zr4mes/facebook-marketing-api-mapi
- Meta Marketing API 공식 Postman 엔드포인트 모음(v23.0 노출 확인): https://www.postman.com/meta/facebook-marketing-api/folder/peiudtv/adsets-api
- Meta Business Help, Meta Pixel과 Conversions API 병행 권장: https://www.facebook.com/business/help/742478679120153
- Channel Developers, Channel SDK 소개: https://developers.channel.io/en/articles/What-is-Channel-SDK-ff092122
- Channel Developers, memberId/memberHash/updateUser/track 문서: https://developers.channel.io/en/articles/ChannelIO-0b119290
- Channel Help, Marketing 소개: https://docs.channel.io/help/en/articles/What-is-Marketing-368b4bb5
- Channel Help, Campaign 운영 가이드: https://docs.channel.io/help/en/articles/Marketing-Campaigns--9064c609
- Kakao Developers, 카카오톡 채널 고객파일 관리/채널 조회 카테고리: https://developers.kakao.com/docs/latest/ko/reference/admin-key-api
- Kakao Developers, 카카오톡 메시지 API는 서비스 사용자 간 메시지 전송 용도: https://developers.kakao.com/docs/latest/en/kakaotalk-message/common
- Kakao Developers FAQ, 알림톡/브랜드메시지/친구톡 선택 가이드: https://developers.kakao.com/docs/latest/en/faq/kakaotalk-channel
- Hotjar/Contentsquare Free 전환 및 AI/Funnels 안내: https://help.hotjar.com/hc/en-us/articles/41819264240273-Explore-Contentsquare-Free-More-Data-New-Features-and-Still-Free
- Hotjar Tracking Code 문서: https://help.hotjar.com/hc/en-us/articles/115011639927-What-is-the-Hotjar-Tracking-Code
- Hotjar Events API 참고: https://help.hotjar.com/hc/de/articles/4405109971095-Ereignisse-API-Referenz
- Amplitude web analytics/session replay 방향성: https://amplitude.com/blog/web-analytics-reimagined
- Amplitude Session Replay 공식 페이지: https://amplitude.com/session-replay
- Mixpanel Product Analytics 공식 페이지: https://mixpanel.com/platform/product-analytics
- Mixpanel Session Replay 공식 페이지: https://mixpanel.com/platform/session-replay/

## 9. 2026-03-29 추가 보강 — GPT 피드백 반영 + Phase 0 실제 개발

출처:
- `/Users/vibetj/coding/seo/gptroadmapfeedback_1.md`
- `/Users/vibetj/coding/revenue/backend/app/api/crm.py`
- `/Users/vibetj/coding/revenue/backend/app/services/crm_identity_service.py`
- `/Users/vibetj/coding/revenue/backend/app/services/channeltalk_service.py`
- `/Users/vibetj/coding/revenue/backend/app/api/sales.py`
- `/Users/vibetj/coding/revenue/backend/app/api/dashboard.py`
- `/Users/vibetj/coding/revenue/backend/app/services/crm_cohort_service.py`
- `/Users/vibetj/coding/seo/frontend/src/components/common/ChannelTalkProvider.tsx`
- `/Users/vibetj/coding/seo/frontend/src/lib/channeltalk.ts`

### 9-1. 피드백 반영으로 바뀌는 우선순위

1. 첫 라이브 실험에는 반드시 `무메시지 holdout`이 들어간다.
   - 권장안 A: `holdout vs 6h vs 24h`
   - 권장안 B: `holdout vs 6h`를 먼저 돌리고, 다음 실험에서 `6h vs 24h`
   - 따라서 `P7-S1`의 기본 분석 단위는 `발송 성공자`가 아니라 `assignment first + ITT`로 고정한다.

2. Meta는 중요하지만 첫 실험의 차단 게이트가 아니다.
   - 첫 owned-channel CRM 실험은 `메시지 비용 + 쿠폰 비용 + 환불 반영 순매출`만으로도 판정 가능하다.
   - 따라서 순서는 `실험 원장 + ChannelTalk/알리고 -> 첫 증분 실험 -> Meta spend join -> CAPI`로 조정한다.

3. 재구매 코호트는 `Phase 4` 전용이 아니라 `Phase 0.5~1 병행 과제`로 당긴다.
   - 이미 `revenue` 코드에 `/api/crm/repeat-purchase-cohorts`가 있어 read-only 검증을 바로 시작할 수 있다.
   - 코호트는 보고용 화면이 아니라 `윈백 시점(21일/30일/90일)`과 `세그먼트 우선순위`를 정하는 입력값이다.

4. 실험 운영 규율을 명시적으로 추가한다.
   - `ITT 우선 분석`
   - `SRM 체크`
   - `mutual exclusion`
   - `sample size / MDE`
   - `stop rule`

5. ChannelTalk + 알리고 병행 전에는 `contact policy`가 먼저다.
   - 최소 정책: `channel priority`, `fallback`, `cooldown`, `quiet hours`, `suppression`, `consent`
   - 초기에는 별도 테이블 생성 전이라도 정책 문서와 suppression 규칙을 먼저 고정한다.

### 9-2. Phase 0 Codex 실제 개발 반영

이번 턴에서 승인 없이 가능한 Phase 0 실제 개발은 `preview/blueprint API` 방식으로 먼저 진행한다.

- `revenue backend`에 `GET /api/crm/phase0-blueprint` 추가
  - `customer_key` 초안
  - 주문/환불 원장 schema 초안
  - ChannelTalk 이벤트 catalog
  - `holdout_required`, `ITT`, `SRM` 등 실험 규율
  - `GA4 vs revenue 월별 매출 비교 계획`
- 기존 `GET /api/crm/customer-key-preview` 응답 확장
  - `version`
  - `normalized_phone`
  - `normalized_email`
  - `hash_basis`
  - `source_priority`
  - `stability_note`

의미:
- DB schema 승인 전에 `계약과 규칙`을 코드로 고정할 수 있다
- Claude Code / 운영자 / TJ님이 문서가 아니라 API로도 같은 초안을 확인할 수 있다
- 이후 실제 migration 승인이 나면 `preview -> persistent ledger`로 옮기기 쉽다

### 9-3. customer_key 초안 (Phase 0 기준)

원칙:
- `customer_key`는 내부 원장의 기준 키다
- 외부 채널 키(`memberId`, `ga_client_id`, `meta_click_id`)는 alias 또는 projection이다
- `전화번호/이메일 원문`을 그대로 키로 쓰지 않고, preview 단계에서는 정규화 후 해시를 사용한다
- Phase 1 승인 후에는 `crm_identity_map`에 저장되는 불변 surrogate key로 승격한다

현재 preview 규칙:
- 1순위: `normalized_phone`
- 2순위: `normalized_email`
- hash input 예시:
  - `phone:01012345678`
  - `email:user@example.com`
- key 예시:
  - `ck_<sha256 앞 24자리>`

Phase 1에서 추가될 identity 필드:
- `link_source`
- `confidence`
- `first_seen_at`
- `last_seen_at`
- `is_primary`

구현 위치:
- `/Users/vibetj/coding/revenue/backend/app/services/crm_identity_service.py`
- `/Users/vibetj/coding/revenue/backend/app/api/crm.py`

### 9-4. 주문/환불 테이블 schema 초안

이 항목은 **문서화 + preview API 반영까지만 진행**, 실제 테이블 생성은 TJ님 승인 이후 진행한다.

`crm_order_ledger` 초안:
- grain: `paid order event 1건당 1 row`
- 핵심 컬럼:
  - `order_id`
  - `customer_key`
  - `order_date`
  - `source_channel`
  - `payment_status`
  - `gross_order_amount`
  - `discount_amount`
  - `final_order_amount`
  - `currency`
  - `raw_order_key`
  - `occurred_at`
  - `ingested_at`

`crm_refund_ledger` 초안:
- grain: `cancel/refund event 1건당 1 row`
- 핵심 컬럼:
  - `refund_id`
  - `order_id`
  - `customer_key`
  - `refund_type`
  - `refund_reason`
  - `refund_amount`
  - `source_channel`
  - `raw_refund_key`
  - `occurred_at`
  - `ingested_at`

운영 원칙:
- 환불은 주문 row를 덮어쓰지 않고 별도 row로 남긴다
- `occurred_at`과 `ingested_at`을 분리해 late arrival을 추적한다
- refund-adjusted KPI는 `order_ledger - refund_ledger` 조합으로 계산한다

### 9-5. 현재 ChannelTalk boot/track 코드 3개

#### 코드 1 — 부트스트랩 컴포넌트

위치:
- `/Users/vibetj/coding/seo/frontend/src/components/common/ChannelTalkProvider.tsx`

현재 상태:
- 앱 마운트 시 `boot({ pluginKey })`
- pathname 변경 시 `setPage(resolvePageName(pathname))`
- `Plugin Key`가 없으면 아무 작업도 하지 않음

핵심 코드:

```tsx
useEffect(() => {
  if (!PLUGIN_KEY) return;
  boot({ pluginKey: PLUGIN_KEY });
  return () => shutdown();
}, []);
```

#### 코드 2 — SDK boot/setPage 래퍼

위치:
- `/Users/vibetj/coding/seo/frontend/src/lib/channeltalk.ts`

현재 상태:
- `memberId`, `memberHash`, `profile`은 옵션
- 지금은 `memberHash optional` 상태
- 향후 `memberId = customer_key`로 확장 가능

핵심 코드:

```ts
const bootOption: ChannelIOBootOption = { pluginKey: options.pluginKey };
if (options.memberId) {
  bootOption.memberId = options.memberId;
  if (options.memberHash) bootOption.memberHash = options.memberHash;
}
window.ChannelIO?.("boot", bootOption);
```

#### 코드 3 — 커스텀 이벤트 track 래퍼

위치:
- `/Users/vibetj/coding/seo/frontend/src/lib/channeltalk.ts`

현재 상태:
- `track(eventName, properties)` 래퍼는 준비 완료
- 실제 제품/체크아웃 이벤트 호출 지점은 아직 붙지 않음
- 따라서 `P3-S1`은 naming contract 고정, `P3-S2`는 실제 호출 삽입이 남아 있다

핵심 코드:

```ts
export function track(eventName: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !booted) return;
  window.ChannelIO?.("track", eventName, properties);
}
```

현재 backend 기준 이벤트 catalog:
- `product_view`
- `add_to_cart`
- `checkout_started`
- `checkout_abandoned`
- `order_paid`
- `refund_completed`
- `repeat_purchase`

구현 위치:
- `/Users/vibetj/coding/revenue/backend/app/services/channeltalk_service.py`

### 9-6. GA4와 revenue 월별 매출 비교 계획

비교 목적:
- GA4의 `grossPurchaseRevenue`와 revenue 코드의 월별 매출 집계를 **같은 월 기준**으로 비교해 차이 원인을 먼저 파악한다
- 이후 `북극성 지표`, `실험 원장`, `iROAS`에서 어떤 숫자를 source of truth로 쓸지 명확히 한다

비교에 사용할 현재 API:
- `seo`
  - `GET /api/ga4/revenue-kpi?startDate=YYYY-MM-01&endDate=YYYY-MM-DD`
  - metric: `grossPurchaseRevenue`
- `revenue`
  - `GET /api/sales/summary?month=YYYY-MM`
  - metric: `summary[].grand_total` 합계
- `revenue`
  - `GET /api/crm/repeat-purchase-cohorts?start_month=YYYY-MM&end_month=YYYY-MM&max_offset=0`
  - metric: cohort `M+0 net_revenue`
- `revenue`
  - `GET /api/dashboard/repurchase-monthly`
  - metric: `repurchase_amount`

비교 절차:
1. 동일 월을 `startDate/endDate`와 `month`로 고정한다
2. `GA4 revenue-kpi`에서 `grossPurchaseRevenue`를 가져온다
3. `revenue /api/sales/summary`에서 `grand_total` 합계를 만든다
4. 차이가 크면 아래를 순서대로 본다
   - 환불/취소 반영 시점 차이
   - 오프라인/세금계산서/리커버리랩 포함 여부
   - GA4 purchase event 누락
   - 광고비/비매출 row 혼입 여부
5. 월별 reconciliation 로그를 남기고, 문서상 `source of truth`를 매 항목마다 명시한다

중요한 해석 원칙:
- GA4 `grossPurchaseRevenue`는 이벤트 기반 gross 매출이다
- `revenue /api/sales/summary`는 정산/채널 집계 기준 매출이다
- `repeat-purchase-cohorts`의 `net_revenue`는 cohort 관점 매출이다
- `repurchase-monthly`의 `repurchase_amount`는 상담 관점 매출이다

즉, 네 API는 서로 대체 관계가 아니라 **측정 목적이 다른 숫자**다. 비교는 가능하지만, 같은 이름의 “월매출”로 섞어 쓰면 안 된다.

### 9-6-1. `(not set)` 매출 1.3억과 PG 리다이렉트 가설 검토

현 시점 결론:
- `(not set) = PG 리다이렉트`는 **유력 가설**이지만 아직 **확정 사실은 아니다**
- 현재 근거로 확정할 수 있는 것은 `GA4에서 source가 비어 있거나 세션 귀속이 끊긴 고매출 주문 묶음이 존재한다`는 점까지다
- 토스/나이스 데이터는 `결제 식별자`와 `결제 시각` 보강에는 도움되지만, 원래 유입채널을 직접 돌려주지는 않는다

2026-03-29 로컬 확인치:
- `seo backend`의 `queryGA4SourceConversion(2026-03-01 ~ 2026-03-28)` 기준
  - `sessionSource = (not set)`
  - 세션 `4,303`
  - 구매 `782`
  - 매출 `₩124,881,187`
  - 구매전환율 `18.17%`
- 같은 기간 `queryGA4DataQuality` 기준
  - `(not set) landing` 비율 `15.5%`
  - `14,117 / 91,293` 세션

이 수치가 시사하는 점:
- 일반 paid traffic 대비 `(not set)`의 구매전환율과 매출/세션이 비정상적으로 높다
- 따라서 `결제 완료 시점에 원래 세션/소스 귀속이 끊기는 문제`를 우선 의심할 이유는 충분하다
- 특히 외부 PG 이동, successUrl 처리, cross-domain 설정 누락, purchase event 발화 위치 문제와 패턴상 맞물릴 가능성이 있다

하지만 아직 확정할 수 없는 이유:
- `(not set)`은 PG 리다이렉트 외에도 `page_view`/`session_start` 누락, landing page 미기록, 서버사이드 purchase만 기록되는 구조, 브라우저/WebView 이슈로도 발생할 수 있다
- 현재 코드 기준 토스에는 `payment_key`, `order_id`, `approved_at`이 저장되고 나이스에는 `tid`, `order_no`, `approval_date`가 저장되지만, `seo` 쪽에는 `GA session id`, `utm`, `gclid`, `fbclid`, `ttclid`를 결제 직전 주문키와 함께 영구 저장하는 원장이 아직 없다
- 즉 과거 데이터만으로는 `이 주문이 원래 TikTok/Google/Meta였다`를 PG 데이터만 보고 역으로 증명할 수 없다

현재 코드 기준 확인된 PG 데이터 역할:
- 토스:
  - `revenue`에 토스 직접 API 동기화가 있고 `payment_key`, `order_id`, `approved_at`, `status`, `method`를 적재한다
  - 결제 완료 시각과 주문번호 조인은 가능하다
- 나이스:
  - 현재 저장소 기준 실시간 API보다는 정산 업로드 중심이며 `tid`, `order_no`, `approval_date`, `status` 중심으로 본다
  - 보조 검증 수단은 될 수 있지만 토스보다 선행 우선순위는 낮다

따라서 운영 판단:
- `(not set)` 매출은 우선 `pg_redirect_suspected` 같은 **내부 진단 분류**로 관리한다
- 단, 원채널 복원값으로 바로 덮어쓰지 않는다
- `확정 채널`, `GA4 채널`, `PG 리다이렉트 의심 여부`를 분리해 저장/표시해야 한다

검증 순서:
1. 결제 완료 successUrl/server endpoint에서 `orderId`, `paymentKey`, `approvedAt`, `landing`, `referrer`, `utm`, `ga_session_id`를 서버 로그 또는 원장에 남긴다
2. 토스 `orderId/paymentKey`와 내부 checkout 시점 attribution row를 조인한다
3. `(not set)` 매출이 큰 시간대와 토스 승인 시각 급증이 맞물리는지 비교한다
4. GA4 DebugView와 실제 결제 플로우에서 `begin_checkout -> purchase` 사이에 source/session 귀속이 끊기는지 확인한다
5. 위 1~4가 닫히기 전까지는 `(not set)`을 `PG 직결`로 확정 표기하지 않는다

Codex 수행 가능성 판단:
- 1번: **가능**
  - `seo` 또는 `revenue`에 successUrl/server endpoint 로깅, `checkout_attribution_ledger`, request context 저장 로직을 넣을 수 있다
  - 전제: 현재 실제 결제 완료 콜백/리다이렉트 진입점이 코드상 어디인지 먼저 식별해야 한다
- 2번: **가능**
  - 토스 `orderId/paymentKey`와 내부 attribution row를 조인하는 배치/API는 Codex가 구현 가능하다
  - 전제: 1번 원장 또는 동등한 서버 로그가 먼저 적재되어야 하며, 과거 데이터는 완전 복구가 어렵다
- 3번: **부분 가능**
  - 토스 승인 시각 집계와 `(not set)` 시간대 비교 리포트는 구현 가능하다
  - 다만 1~2번 데이터가 없으면 `상관관계`까지만 볼 수 있고 `원인 확정`은 어렵다
- 4번: **부분 가능**
  - 프론트 코드 점검, GA4 이벤트 발화 지점 추가, 실제 브라우저 플로우 점검 준비는 가능하다
  - 하지만 GA4 DebugView에서 live purchase를 끝까지 닫는 검증은 실제 결제 테스트 수단, 브라우저 환경, DebugView 접근 상태에 따라 Codex 단독으로는 제한될 수 있다
- 5번: **가능**
  - 문서/대시보드/내부 분류 규칙에서 `(not set)`을 `PG 직결`로 확정 표기하지 않는 governance는 지금 바로 반영 가능하다

현재 판단:
- Codex가 **지금 바로 완결 가능한 범위**는 1~3번의 계측/원장/조인/리포트 구현까지다
- 4번은 `코드 준비 + 확인 절차 설계`까지는 가능하지만, 실제 live flow/DebugView 검증은 운영 환경 확인이 함께 필요하다
- 따라서 로드맵 상 `(not set)` 이슈는 `개발로 줄일 수 있는 문제`이면서도, 최종 확정에는 `운영 검증`이 필요한 항목으로 취급한다

검증 관리 기준:
- `1~2번`은 Codex 단독 개발/검증 대상으로 본다
- `3번`은 Codex가 리포트까지 만들 수 있지만 해석은 운영 데이터 맥락과 함께 본다
- `4번`은 Codex 단독 완료 항목이 아니라 `운영 병행 검증` 항목으로 표시한다
- `5번`은 문서/대시보드/내부 용어 규칙으로 즉시 시행 가능하며, 1~4번이 닫히기 전까지 `(not set)`은 `PG 직결 확정`으로 쓰지 않는다

### 9-6-2. SEO 유입보다 purchase가 더 커 보이는 이유 진단 업데이트 (2026-03-29)

이번 턴에는 피드백 3차를 반영해, `왜 SEO 세션보다 purchase/key event가 더 커 보이는가`를 단일 카드에서 설명하는 진단 레이어를 추가했다.

추가 구현:
- backend
  - `GET /api/ga4/seo-conversion-diagnosis`
  - 범위: Organic Search 세션 scope, First user scope, `/shop_view` query string 분산, `(not set)` 랜딩, real funnel purchase 단절, transaction_id 품질을 한 번에 묶어 반환
- frontend
  - Overview 탭에 `SEO 유입보다 purchase가 더 커 보이는 이유 진단` 카드 추가
  - 각 원인 후보별 `왜 이런가`, `실무적으로 무엇을 확인할까`, `실측 신호`를 표시

2026-02-28 ~ 2026-03-28 실측:
- Organic Search 세션 `14,804`
- Organic Search 구매 `106`
- Organic Search key events `40,889`
- Organic Search 매출 `₩25,002,757`
- First user 기준 Organic 구매 `118`
- First user 기준 Organic 매출 `₩26,291,543`
- `(not set)` landing 비율 `15.3%`
- `runFunnelReport` purchase 단계 `0`, 같은 기간 실제 `ecommercePurchases 106`
- transaction_id 기준
  - 고유 `2,128`
  - purchase 이벤트 `2,227`
  - 중복 의심 `99`
  - 커버리지 `95.6%`

현재 진단 결론:
- `버그처럼 보이는 숫자` 중 일부는 실제로 `세션 vs 이벤트`, `First user vs Session` scope 혼합에서 나온다
- 하지만 `runFunnelReport purchase = 0`, `(not set) landing 15.3%`, 자사/Imweb/PG 이동 가능성은 여전히 강한 red flag다
- 따라서 해석상 1순위는 `정의 문제 분리`, 구현상 1순위는 `cross-domain/PG/landing not set 검증`이다

다음 액션:
1. Explore에서 `Session default channel group = Organic Search`, `Landing page + query string`, `Sessions / Entrances / Ecommerce purchases / Key events / Total revenue`로 같은 scope 표를 다시 만든다
2. `/shop_view`를 `Page path + query string` 또는 `Landing page + query string` 기준으로 제품 단위 분리한다
3. DebugView로 실제 purchase 1건을 태워 `source/medium`, `referral`, `transaction_id`, `begin_checkout -> purchase` 연속성을 확인한다
4. GA4 cross-domain 설정에 `biocom.kr`, `www.biocom.kr`, `biocom.imweb.me`, 실제 PG 완료 도메인을 모두 넣었는지 점검한다
5. 주문번호 기준 `transaction_id` 유니크 수와 GA4 purchase 수를 매월 대조한다

2026-03-29 구현 반영:
- 이 항목은 `Phase 1 / P1-S1A`로 배치한다
- 구현 완료:
  - `POST /api/attribution/checkout-context`
  - `POST /api/attribution/payment-success`
  - `GET /api/attribution/ledger`
  - `GET /api/attribution/toss-join`
- 저장 방식:
  - DB가 `read-only`라서 당장은 `seo/backend/logs/checkout-attribution-ledger.jsonl`에 append-only 저장
- 코드 탐색 결과:
  - 현재 workspace에는 기존 `successUrl/server callback` 구현이 보이지 않음
  - 따라서 실제 고객 사이트가 위 receiver를 호출하도록 붙여야 live row가 쌓인다
- 현재 운영 데이터 확인치:
  - `tb_sales_toss` 전체 `4,717건`
  - `2026-03-01` 이후 `1,701건`
  - 최신 승인시각 `2026-03-29 03:32:18`
  - 새 ledger 현재 row `0건`
- 해석:
  - step 1, 2를 시작할 서버 진입점은 확보했다
  - 하지만 아직 실제 payment success 호출이 안 들어오므로 `(not set)` 원인에 대한 실증 데이터는 다음 단계에서 쌓아야 한다

후속 개발 항목:
- `seo/revenue` 공통으로 `checkout_attribution_ledger` 또는 동등한 원장 추가
- 토스는 `orderId` 규칙 또는 `metadata`를 활용해 attribution join key를 심는다
- 나이스는 `MOID/MallReserved` 계열 필드에 같은 attribution key를 싣는 방안을 검토한다
- 대시보드에는 `ga4_source`, `resolved_source`, `resolution_source`, `is_pg_redirect_suspected`를 함께 노출한다

### 9-7. Sprint 순서 조정 메모

업데이트 후 Codex 실무 순서는 아래가 맞다.

1. `P0-S1` 마감
   - `customer_key`
   - 이벤트 사전
   - 주문/환불 schema 초안
   - 실험 규율
2. `P4-S1` 일부 선행
   - 코호트 read-only API/검증
   - `90일` 윈도우 검증
3. `P1-S1`
   - approval package
   - ledger 구현
4. `P3-S1`
   - `memberId = customer_key`
   - event naming contract
5. 첫 라이브
   - `holdout vs 6h vs 24h`
   - ITT 기준 판정
6. 그 다음 병행
   - 알리고
   - Meta spend sync
   - Recoverylab 오프라인 쿠폰

메모:
- `Recoverylab 방문 쿠폰 실험`은 여전히 유효하지만 attribution noise가 커서 `1차 라이브`보다 `2~3차 실험`이 더 안전하다
- 첫 실험은 measurement noise가 가장 적은 `체크아웃 이탈 holdout 실험`이 맞다
