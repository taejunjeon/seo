# Google Ads ROAS 정합성 체크 및 개선 계획

작성 시각: 2026-04-23 12:12 KST
기준일: 2026-04-23
버전: v1.0-gdn-roas-plan
문서 성격: 로드맵

## 10초 요약

이 문서는 Google Ads, 특히 GDN(구글 디스플레이 네트워크) 성과를 광고 관리자 숫자 그대로 믿어도 되는지 확인하고, 내부 확정매출 기준 ROAS로 맞추는 계획이다.
현재 결론은 `설치 여부`가 병목이 아니라 `구매 전환이 실제 결제 확정과 같은가`가 병목이다.
바이오컴은 Google Ads 태그와 GA4/GTM 경로가 존재하지만, NPay 버튼 클릭 전환과 GA4 구매 중복 발사 구조가 Google Ads ROAS를 과대 또는 왜곡할 수 있다.
다음 행동은 Google Ads 전환 액션 목록과 최신 GTM live 상태를 다시 확인한 뒤, 결제수단별 이벤트를 내부 주문 원장과 1:1로 맞추는 것이다.

쉬운 비유로 말하면, Google Ads 성적표와 실제 통장 입금 장부를 한 줄씩 대조하는 일이다.
GDN은 광고를 본 뒤 나중에 산 사람도 잡을 수 있어서, 클릭해서 산 사람과 보고만 산 사람을 반드시 나눠야 한다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase0 | [[#Phase0-Sprint1]] | 기준과 원천 고정 | Codex | 65% / 45% | [[#Phase0-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | Google Ads 전환 액션 실사 | TJ + Codex | 35% / 15% | [[#Phase1-Sprint2\|이동]] |
| Phase1 | [[#Phase1-Sprint3]] | GTM/GA4 구매 태그 정합성 확인 | Codex + Claude Code | 45% / 25% | [[#Phase1-Sprint3\|이동]] |
| Phase2 | [[#Phase2-Sprint4]] | 결제수단별 이벤트 대조 | TJ + Codex + Claude Code | 30% / 10% | [[#Phase2-Sprint4\|이동]] |
| Phase3 | [[#Phase3-Sprint5]] | 플랫폼 ROAS와 내부 ROAS 비교표 | Codex | 10% / 0% | [[#Phase3-Sprint5\|이동]] |
| Phase4 | [[#Phase4-Sprint6]] | 전환 오염 제거와 보정 | TJ + Codex + Claude Code | 10% / 0% | [[#Phase4-Sprint6\|이동]] |
| Phase5 | [[#Phase5-Sprint7]] | 운영 판단 룰 고정 | TJ + Codex | 5% / 0% | [[#Phase5-Sprint7\|이동]] |

## 문서 목적

이 문서는 Google Ads ROAS가 실제 확정매출과 얼마나 맞는지 확인하고, GDN 예산 판단에 쓸 운영 기준을 고정한다.

## 이 작업이 하는 일

이 작업은 `Google Ads 광고 노출/클릭 -> 사이트 방문 -> 주문 생성 -> 결제 확정 -> 취소/환불`을 한 줄로 이어 본다.
광고 관리자가 말하는 전환값과 내부 원장이 말하는 확정매출을 같은 날짜, 같은 캠페인, 같은 주문 기준으로 맞춘다.

## 왜 필요한가

Google Ads는 전환값이 있어야 ROAS 입찰과 전환가치 최적화가 의미 있다.
하지만 구매 버튼 클릭, 가상계좌 미입금, NPay 결제완료 리턴 누락, 중복 purchase 태그가 섞이면 Google Ads가 실제 매출이 아닌 신호로 학습한다.
GDN은 조회 후 전환(view-through conversion)도 중요한 보조 신호라서, 클릭 기반 ROAS와 조회 기반 보조성과를 분리하지 않으면 예산 판단이 흔들린다.

## 프로젝트 구조 파악 결과

| 위치 | 역할 | 이번 문서에서 쓰는 방식 |
|---|---|---|
| `backend/` | Express + TypeScript API, GA4 Data API, GTM audit, attribution 원장 조회 | Google Ads/GDN 대조 스크립트와 내부 confirmed 매출 계산 후보 |
| `frontend/` | Next.js 대시보드, 로컬 포트 7010 | `/ads` 화면에 Google Ads 정합성 카드 추가 후보 |
| `data/` | 정합성 계획, ROAS 증거, CSV/JSON 산출물 | 내부 매출 기준과 과거 ROAS 증거 참조 |
| `GA4/` | GTM/GA4 검증 문서, NPay 누락과 purchase 오염 추적 | Google Ads 구매 태그가 물려 있는 GA4 이벤트 품질 근거 |
| `tiktok/` | TikTok ROAS 정합성 로드맵 | 플랫폼 ROAS와 내부 confirmed ROAS를 분리하는 선례 |
| `gtmaudit/` | GTM API snapshot JSON | Google Ads 태그와 전환 라벨 정적 점검 근거 |
| `footer/` | 아임웹 삽입 코드와 자동 마케팅 코드 기록 | Google Ads 자동 NPay trace와 GTM 경로 중복 확인 |

## 현재 상태

### 현재 접근 권한 상태

2026-04-23 12:12 KST 기준으로 접근 권한은 세 시스템이 서로 다르다.

| 시스템 | 현재 접근 상태 | 내가 직접 할 수 있는 것 | 아직 못 하는 것 |
|---|---|---|---|
| GA4 | 서비스 계정 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`로 GA4 Data API 조회 가능 | `purchase`, `transaction_id`, `pay_method`, revenue 같은 집계 리포트 조회 | GA4 Admin UI를 사람처럼 클릭해서 설정을 바꾸는 일. BigQuery raw는 property/dataset별 권한에 따라 다름 |
| GTM | 서비스 계정으로 GTM API 접근 가능. 2026-04-23 실행 결과 계정 `바이오컴(최종)`과 컨테이너 `GTM-W2Z6PHN`, `GTM-5M33GC4`, `GTM-T8FLZNT` 조회 가능 | 태그, 트리거, 변수, 컨테이너 live version 확인. 2026-04-23 확인 기준 biocom live version은 `137` | GTM UI 자체를 사람이 보듯 클릭하는 일. `user_permissions.list`는 현재 scope 부족으로 실패해 정확한 역할명(관리자/사용자/publish 권한)을 API로 재확인하지 못함 |
| Google Ads | 2026-04-23 12:24 KST TJ가 서비스 계정 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`를 읽기 전용 사용자로 추가했다고 보고 | 현재 로컬 문서, GTM, footer, GA4 결과로 전환 label 후보를 추정. developer token이 들어오면 API read-only 조회를 시도 가능 | Google Ads 전환 액션 목록을 API로 직접 조회하는 일. Google Ads API developer token이 아직 필요 |

정리하면, **GTM과 GA4는 현재 Codex가 API로 읽을 수 있다.**
반면 **Google Ads는 서비스 계정 추가는 됐지만 아직 같은 수준으로 연결됐다고 볼 수 없다.**
Google Ads API로 전환 액션을 직접 조회하려면 Google 공식 절차상 Google Ads API developer token도 필요하다.
developer token은 일반 광고 계정이 아니라 Google Ads 관리자 계정(MCC)의 API Center에서 발급받는다.
2026-04-23 12:24 KST TJ 실측 기준 `https://ads.google.com/aw/apicenter` 접속 시 `관리자 계정만 API 센터에 액세스할 수 있습니다` 메시지가 떴다. 즉 현재 로그인한 `214-999-0943 바이오컴`은 **광고 계정의 관리자 권한은 있지만 MCC는 아닌 상태**로 해석한다.

### 확인된 것

- 바이오컴 GTM은 `GTM-W2Z6PHN`, Google Ads 계정은 `AW-304339096`, GA4 정본은 `G-WJFXN5E2Q1`로 본다.
- 2026-04-23 실행 결과 GTM API는 계정 `4703003246 / 바이오컴(최종)`과 컨테이너 3개를 조회했다. live version 확인 스크립트는 biocom `GTM-W2Z6PHN`의 published version을 `137 (vbank_exception_trigger_2026-04-21)`로 반환했다.
- `gtmaudit/gtm-audit-2026-04-16.json` 기준 바이오컴 컨테이너에는 Google Ads 전환 태그 `[248] TechSol - [GAds]NPAY구매 51163`가 있다.
- 이 태그는 `conversionId=304339096`, `conversionLabel=3yjICOXRmJccEJixj5EB`, `currencyCode=KRW`, `conversionValue={{TechSol - Custom Javascript 30698}}`, `orderId={{TechSol - Custom Javascript 65481}}`를 보낸다.
- 같은 snapshot에서 이 태그의 trigger `[249] TechSol - NPAY구매 61620`은 NPay 버튼 클릭과 장바구니/상품 금액 조건으로 발사된다.
- `footer/biocomimwebcode.md`에는 아임웹 자동 Google Ads NPay trace `AW-304339096/r0vuCKvy-8caEJixj5EB`도 있다. 즉 NPay Google Ads 전환 경로가 GTM과 아임웹 자동 코드로 나뉘어 있다.
- `GA4/GA4검증.md` 기준 2026-04-21 잔여 오염은 NPay 클릭 시점 발사 5건 `966,800원`, HURDLERS + 홈피구매 중복 6건 `1,941,324원`, 총 `2,908,124원`으로 분해됐다.
- 더클린커피 GTM `GTM-5M33GC4`는 Google Ads 태그 `AW-10965703590`와 리마케팅, 회원가입, 카톡채널 전환은 있으나 2026-04-16 snapshot 기준 구매용 Google Ads 전환 태그는 보이지 않는다.
- Data Check 기준 메인 매출과 ROAS는 `confirmed` 기준이어야 한다. `pending`, 가상계좌 미입금, 취소/환불은 별도 보정해야 한다.

### 아직 안 된 것

- Google Ads UI/API의 실제 전환 액션 목록, primary/secondary 여부, 전환 포함 여부, 집계 방식, 전환 기간, 조회 후 전환 기간이 아직 문서화되지 않았다. 서비스 계정은 추가됐지만 developer token이 없어 API 조회는 아직 못 했다.
- Google Ads API Center에 접근할 MCC가 아직 없다. 또는 회사에 이미 MCC가 있어도 현재 로그인 세션에서 그 MCC로 들어가지 못하고 있다.
- 2026-04-21 v137 publish 이후 최신 GTM API snapshot이 없다. `gtmaudit/gtm-audit-2026-04-16.json`은 v135 기준이므로 최신 정본으로 쓰면 안 된다.
- Google Ads 캠페인 리포트가 내부 원장과 같은 기간, 같은 campaign/action 기준으로 대조되지 않았다.
- GDN 조회 후 전환이 운영 판단 ROAS에 포함되는지, 보조 지표로만 둘지 아직 결정되지 않았다.
- 취소/환불을 Google Ads conversion adjustment로 보낼지 결정되지 않았다.

### 지금 막힌 이유

첫 번째 병목은 Google Ads 전환 액션 목록과 최신 GTM live 상태가 없어서, 어떤 전환 라벨이 실제 입찰과 ROAS에 쓰이는지 확정할 수 없다는 점이다.
두 번째 병목은 NPay가 결제 완료 후 biocom.kr로 돌아오지 않는 구조라서, 클릭 시점 전환과 실제 결제 완료 전환이 섞일 수 있다는 점이다.
세 번째 병목은 GDN 특유의 조회 후 전환을 내부 confirmed 매출과 같은 의미로 볼 수 없다는 점이다.

### 현재 주체

- TJ: Google Ads UI 확인, 관리자 승인, GTM publish, 실결제 테스트, Google Ads API 권한 승인.
- Codex: 로컬 파일과 API 기반 대조, 내부 원장 조인 설계, Google Ads API/CSV 리포트 파서 설계.
- Claude Code: GTM 태그 정리 초안, `/ads` 화면 문구와 정합성 카드, GA4 DebugView/Preview 검증 보조.

## 산출물

- Google Ads 전환 액션 장부: 전환 이름, ID/label, primary 여부, 전환값, 집계 방식, 전환 기간, view-through 포함 여부.
- GDN ROAS 비교표: Google Ads 플랫폼 ROAS, click-only ROAS, view-through 보조성과, 내부 confirmed ROAS.
- 구매 이벤트 블랙박스: 카드, 가상계좌, NPay, 무료 주문, 취소/환불별 이벤트 발사 결과.
- 개선안 승인 패키지: NPay 클릭 전환 제거/변경, 중복 purchase 태그 제거, transaction_id와 dynamic value 검증, conversion adjustment 도입 여부.
- 운영 판단 룰: 예산 증액/유지/감액에 어떤 ROAS를 쓰는지 고정한 문서와 화면 문구.

## 참고한 내부 문서

- [[tiktokroasplan|tiktok/tiktokroasplan.md]]: 플랫폼 ROAS와 내부 confirmed ROAS를 분리한 선례.
- [[!datacheckplan|data/!datacheckplan.md]]: Toss, Imweb, GA4, Attribution ledger의 역할 기준.
- [[GA4검증|GA4/GA4검증.md]]: v136/v137 이후 GA4 purchase 오염 감소와 잔여 이상치 분해.
- [[npay_return_missing_20260421|GA4/npay_return_missing_20260421.md]]: NPay 결제 완료 후 자사몰 리턴 누락과 Google Ads 클릭 전환 위험.
- [[googleadstictok|capivm/googleadstictok.md]]: 기존 Google Ads/TikTok 정합성 계획과 GTM audit 결과.
- [[biocomimwebcode|footer/biocomimwebcode.md]]: 아임웹 자동 Google Ads NPay trace와 삽입 코드 위치.

## 공식 근거

- [Google Ads 전환값 설명](https://support.google.com/google-ads/answer/13064207): 전환값은 ROAS 입찰과 전환가치 최적화의 기준이다.
- [Google Ads 전환 추적 데이터 이해](https://support.google.com/google-ads/answer/6270625): `Conv. value / cost`는 전환값을 광고비로 나눈 ROI 지표다.
- [거래별 전환값 추적](https://support.google.com/google-ads/answer/6095947): 구매처럼 주문마다 금액이 다른 액션은 dynamic value가 필요하다.
- [transaction_id로 중복 전환 줄이기](https://support.google.com/google-ads/answer/6386790): 같은 전환 액션과 같은 transaction_id의 두 번째 전환은 중복으로 처리된다.
- [GA4 전환을 Google Ads로 가져오기](https://support.google.com/google-ads/answer/2375435): Google Ads는 클릭 날짜 기준, GA4는 전환 날짜 기준으로 볼 수 있고 import 지연이 최대 24시간 생길 수 있다.
- [Google Ads 전환 조정](https://support.google.com/google-ads/answer/7686447): 취소/반품은 retraction 또는 restatement로 전환 수와 전환값을 조정할 수 있다.
- [Display 조회 후 전환](https://support.google.com/google-ads/answer/16542520): GDN은 광고를 봤지만 클릭하지 않은 사용자의 후속 전환을 별도 지표로 본다.
- [Google Ads API 서비스 계정 절차](https://developers.google.com/google-ads/api/docs/oauth/service-accounts): 서비스 계정을 Google Ads 사용자로 추가해야 API 접근이 가능하다.
- [Google Ads API OAuth 개요](https://developers.google.com/google-ads/api/docs/oauth/overview): Google Ads API 호출에는 OAuth 2.0 자격증명 외에 developer token도 필요하다.
- [Google Ads API v22 release notes](https://developers.google.com/google-ads/api/docs/release-notes): 2026-04-23 기준 최신 API 판단은 v22 문서를 기준으로 검토한다.

## Phase별 계획

### Phase 0

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 기준과 원천 고정

- 목표: Google Ads ROAS를 어떤 숫자와 비교할지 고정한다.
- 왜 지금 해야 하는가: 기준이 없으면 Google Ads ROAS, GA4 revenue, 내부 confirmed revenue가 서로 다른 말을 해도 무엇이 맞는지 판단할 수 없다.
- 산출물: ROAS 정의표, 원천별 신뢰 역할, GDN view-through 분리 원칙.
- 완료 기준: 문서와 `/ads` 화면에서 Google Ads 플랫폼 ROAS와 내부 confirmed ROAS를 다른 지표로 표시한다.
- 다음 Phase에 주는 가치: 전환 액션 실사와 태그 검증에서 무엇을 찾아야 하는지 명확해진다.

#### Phase0-Sprint1

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 기준과 원천 고정
**상태**: 우리 기준 65% / 운영 기준 45%

**무엇을 하는가**

Google Ads ROAS의 분자와 내부 ROAS의 분자를 분리한다.
Google Ads 플랫폼 ROAS는 Google Ads가 귀속한 `Conv. value / cost`이고, 내부 ROAS는 Attribution ledger와 운영 주문 DB에서 confirmed로 닫힌 매출을 광고비로 나눈 값이다.

**왜 필요한가**

GDN은 클릭 없이 광고를 본 뒤 산 사람도 조회 후 전환으로 잡을 수 있다.
이 값은 보조성과로 중요하지만, 내부 확정매출과 같은 의미로 섞으면 예산 판단이 과장될 수 있다.

**산출물**

- ROAS 정의표
- Google Ads vs GA4 vs 내부 원장 차이표
- GDN click-only / view-through 분리 기준

**우리 프로젝트에 주는 도움**

Google Ads를 끌지 말지 논의할 때, 광고 플랫폼 숫자와 실제 통장 기준 숫자를 섞지 않는다.

##### 역할 구분

- TJ: GDN 예산 판단에 view-through 전환을 어느 수준까지 참고할지 승인.
- Codex: ROAS 정의표와 내부 confirmed 기준 계산식 작성.
- Claude Code: `/ads` 화면 문구와 툴팁 초안.

##### 실행 단계

1. [Codex] Google Ads ROAS 정의를 `platform_roas`, `click_confirmed_roas`, `view_through_assist`, `internal_confirmed_roas`로 분리한다. 의존성: 병렬가능.
2. [Codex] 내부 원장 기준은 `confirmed`만 메인 매출로 쓰고 `pending`, `vbank_expired`, `canceled`, `FREE`는 보조 분류로 둔다. 의존성: 병렬가능.
3. [TJ] GDN view-through 전환을 예산 증액 근거로 단독 사용하지 않는 원칙을 승인한다. 의존성: 선행필수. 이유: 광고 운영 기준 결정이다.
4. [Claude Code] `/ads` 또는 문서 카드에 "Google Ads 숫자는 플랫폼 귀속, 내부 숫자는 확정매출" 문구를 넣는다. 의존성: 부분병렬.

### Phase 1

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 전환 액션과 태그 실사

- 목표: Google Ads에서 실제 ROAS에 쓰이는 전환 액션과 GTM/아임웹에서 발사되는 태그를 모두 찾는다.
- 왜 지금 해야 하는가: 같은 `AW-304339096` 안에 NPay 클릭 전환, 회원가입, 리마케팅, 임시 장바구니 태그가 함께 있다.
- 산출물: 전환 액션 장부, 최신 GTM live audit, 아임웹 자동 코드 점검표.
- 완료 기준: 어떤 label이 purchase이고 어떤 label이 보조 이벤트인지 1줄로 말할 수 있다.
- 다음 Phase에 주는 가치: 결제수단별 테스트에서 어떤 요청을 정상/오염으로 볼지 정할 수 있다.

#### Phase1-Sprint2

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: Google Ads 전환 액션 실사
**상태**: 우리 기준 35% / 운영 기준 15%

**무엇을 하는가**

Google Ads UI 또는 API에서 전환 액션 목록을 가져온다.
구매, NPay, 회원가입, 리마케팅, 임시 테스트 태그를 분리한다.

**왜 필요한가**

Google Ads ROAS는 primary 전환 액션과 전환값 설정에 크게 좌우된다.
NPay 버튼 클릭 전환이 primary purchase로 들어가 있으면, 실제 결제 완료가 아니라 클릭 의도만 보고 ROAS가 올라갈 수 있다.

**산출물**

- 전환 액션 장부
- primary/secondary 전환 구분표
- 구매 전환 label별 위험도

**우리 프로젝트에 주는 도움**

Google Ads가 어떤 신호로 학습하는지 알 수 있다.
이게 닫혀야 GDN 예산을 올려도 되는지 판단할 수 있다.

##### 역할 구분

- TJ: Google Ads 관리자 화면 접근, 전환 액션 목록 export 또는 API 권한 승인.
- Codex: export 파싱, label별 GTM/아임웹 코드 매칭, 위험도 분류.
- Claude Code: 전환 액션 장부 화면 또는 문서 표 정리.

##### 실행 단계

1. [Codex] 현재 로컬 증거에서 `AW-304339096`, `AW-10965703590`, `conversionLabel` 후보를 표로 정리한다. 의존성: 병렬가능.
2. [TJ] Google Ads UI에서 전환 액션 목록을 export한다. 필요한 컬럼은 전환 이름, 소스, 상태, primary/secondary, 카테고리, count, value, conversion window, view-through window, include in conversions다. 의존성: 선행필수. 이유: Google Ads 관리자 로그인과 2FA가 필요하다.
3. [Codex] export를 `gtmaudit`와 `footer` 기록에 매칭해 "실제 발사 경로"를 붙인다. 의존성: 선행필수.
4. [Codex] Google Ads API 사용 가능 여부를 확인하고, 가능하면 v22 `conversion_action` 조회 스크립트 초안을 만든다. 의존성: 부분병렬.
5. [Claude Code] 전환 액션 장부를 대표용 표로 정리한다. 의존성: 3번 이후 선행필수.

#### Phase1-Sprint3

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: GTM/GA4 구매 태그 정합성 확인
**상태**: 우리 기준 45% / 운영 기준 25%

**무엇을 하는가**

GTM과 아임웹 자동 삽입 코드에서 purchase 관련 태그가 몇 개 있고, 언제 발사되는지 확인한다.
GA4에서 이미 확인된 중복 purchase 구조가 Google Ads에도 영향을 주는지 본다.

**왜 필요한가**

GA4 v137 이후에도 NPay 클릭 발사와 HURDLERS + 홈피구매 중복은 남아 있다.
Google Ads 태그 `[248]`도 NPay 클릭 trigger를 쓰므로 같은 오염이 Google Ads ROAS로 들어갈 수 있다.

**산출물**

- 최신 GTM live audit
- purchase sender 중복표
- NPay 클릭 전환 위험 리포트

**우리 프로젝트에 주는 도움**

태그가 왜 틀렸는지 추측하지 않는다.
어떤 태그를 끄거나 바꿔야 하는지 승인 가능한 형태로 나온다.

##### 역할 구분

- TJ: GTM publish 승인과 Google Tag Manager 관리자 권한 확인.
- Codex: GTM API snapshot 재생성, JSON 정적 분석, 기존 GA4 검증 결과와 연결.
- Claude Code: GTM Preview, DebugView, 태그 변경 초안.

##### 실행 단계

1. [Codex] `cd backend && npx tsx scripts/gtm-audit.ts`로 최신 GTM snapshot을 만든다. 의존성: 병렬가능. 단, 현재 service account 권한이 살아 있어야 한다.
2. [Codex] 최신 snapshot에서 `awct`, `googtag`, `gaawe eventName=purchase`, NPay click trigger를 전수 추출한다. 의존성: 1번 선행필수.
3. [Claude Code] GA4 잔여 이상치 14건 분해 결과를 GTM 태그 ID와 연결한다. 의존성: 병렬가능.
4. [TJ] GTM publish가 필요한 변경은 승인한다. 의존성: 선행필수. 이유: 운영 태그 변경은 live 사이트 추적에 직접 영향이 있다.
5. [Codex] 변경 전/후 비교표를 만든다. `v135 snapshot`, `v137 기록`, 최신 snapshot을 분리해서 날짜를 붙인다. 의존성: 1번 선행필수.

### Phase 2

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 결제수단별 이벤트 대조

- 목표: 카드, 가상계좌, NPay, 무료 주문, 취소/환불이 Google Ads/GA4/내부 원장에서 어떻게 보이는지 확인한다.
- 왜 지금 해야 하는가: 전환 액션만 봐서는 실제 결제 완료와 맞는지 알 수 없다.
- 산출물: 결제수단별 이벤트 블랙박스, 주문번호별 대조표.
- 완료 기준: 카드 confirmed는 구매 1회, 가상계좌 미입금은 구매 0회, NPay는 실제 결제 기준 전환만 허용이라는 판단을 주문번호로 증명한다.
- 다음 Phase에 주는 가치: 플랫폼 리포트와 내부 원장 비교에서 gap 원인을 분류할 수 있다.

#### Phase2-Sprint4

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 결제수단별 이벤트 대조
**상태**: 우리 기준 30% / 운영 기준 10%

**무엇을 하는가**

실제 결제 플로우에서 Google Ads 요청, GA4 purchase, 내부 주문 상태를 같은 주문번호로 맞춘다.

**왜 필요한가**

TikTok에서 확인했듯이 주문 생성이나 입금 전 가상계좌를 구매로 보면 플랫폼 ROAS가 크게 부풀 수 있다.
Google Ads도 같은 구조가 있으면 GDN 자동입찰이 가짜 구매를 학습한다.

**산출물**

- 카드 결제 검증 로그
- 가상계좌 미입금 검증 로그
- NPay 클릭/결제완료 분리 로그
- FREE/내부 테스트 주문 제외 기준

**우리 프로젝트에 주는 도움**

전환 오염을 태그 이름이 아니라 주문 단위 증거로 닫는다.

##### 역할 구분

- TJ: 실결제 테스트, NPay/가상계좌 테스트 승인. 이유: 실제 결제와 외부 계정 작업은 사람만 할 수 있다.
- Codex: 운영 DB read-only 대조, Attribution ledger 조회, 요청 로그 정리.
- Claude Code: Playwright/Preview 캡처, DebugView 확인, 화면 문구 정리.

##### 실행 단계

1. [Codex] 로그인 없이 가능한 페이지에서 Google Ads 요청 패턴을 Playwright로 다시 캡처한다. 의존성: 병렬가능.
2. [TJ] 바이오컴 카드 결제 테스트 주문 1건을 만든다. 의존성: 선행필수. 이유: 실결제 발생.
3. [Codex+Claude Code] 카드 주문의 Google Ads conversion request, GA4 purchase, 운영 DB `PAYMENT_COMPLETE`, Attribution ledger `confirmed`를 대조한다. 의존성: 2번 선행필수.
4. [TJ] 바이오컴 가상계좌 미입금 테스트 주문 1건을 만든다. 의존성: 선행필수. 이유: 실결제 플로우와 미입금 상태 생성.
5. [Codex+Claude Code] 가상계좌 미입금에서 Google Ads purchase가 나가는지 확인한다. 나가면 오염 후보로 기록한다. 의존성: 4번 선행필수.
6. [TJ] NPay 테스트 또는 기존 NPay 주문 샘플 확인을 승인한다. 의존성: 선행필수. 이유: NPay 외부 결제와 관리자 확인.
7. [Codex] NPay 주문은 `pay_type=npay`, GA4 `purchase`, Google Ads NPay conversion label, 내부 주문번호를 맞춘다. 의존성: 부분병렬.
8. [Claude Code] 검증 결과를 주문번호 마스킹 표로 정리한다. 의존성: 3/5/7번 이후 선행필수.

### Phase 3

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 플랫폼 ROAS와 내부 ROAS 비교

- 목표: Google Ads/GDN 리포트와 내부 확정매출 ROAS를 같은 기간으로 비교한다.
- 왜 지금 해야 하는가: 태그 오염을 확인해도 실제 광고비 판단은 캠페인별 숫자로 해야 한다.
- 산출물: GDN ROAS 비교표, gap waterfall, 캠페인별 조치 의견.
- 완료 기준: Google Ads platform ROAS와 internal confirmed ROAS 차이를 전환액션, 날짜 기준, view-through, pending/취소, NPay, 중복 태그로 분해한다.
- 다음 Phase에 주는 가치: 무엇을 고치면 ROAS가 얼마나 바뀌는지 보인다.

#### Phase3-Sprint5

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 플랫폼 ROAS와 내부 ROAS 비교표
**상태**: 우리 기준 10% / 운영 기준 0%

**무엇을 하는가**

Google Ads 캠페인 리포트와 내부 확정매출을 날짜와 캠페인 기준으로 조인한다.
GDN은 click conversion과 view-through conversion을 분리해서 본다.

**왜 필요한가**

광고 관리자의 ROAS가 높아도, 그 매출이 실제 확정매출인지, 조회 후 전환인지, 중복 태그인지 모르면 예산을 올릴 수 없다.

**산출물**

- Google Ads CSV/API import 스크립트
- 캠페인별 ROAS gap table
- GDN view-through assist table

**우리 프로젝트에 주는 도움**

GDN 예산을 감으로 판단하지 않고, 내부 confirmed 기준으로 조정할 수 있다.

##### 역할 구분

- TJ: Google Ads 캠페인 리포트 export 또는 API 권한 승인.
- Codex: 리포트 파서, 내부 원장 조인, gap 계산.
- Claude Code: `/ads` GDN 카드와 표 UI.

##### 실행 단계

1. [TJ] Google Ads 리포트를 export한다. 필수 컬럼은 date, campaign, campaign_id, advertising_channel_type, cost, conversions, conv_value, conv_value_per_cost, all_conversions, all_conv_value, view_through_conversions, conversion_action이다. 의존성: 선행필수. 이유: Google Ads 관리자 접근 필요.
2. [Codex] CSV/API 파서를 만든다. 의존성: 부분병렬. 샘플 스키마는 먼저 만들 수 있지만 실제 컬럼 확정은 1번이 필요하다.
3. [Codex] 내부 Attribution ledger에서 `gclid`, `utm_source=google`, `campaign` 후보, confirmed revenue를 같은 기간으로 집계한다. 의존성: 병렬가능.
4. [Codex] Google Ads 비용과 내부 confirmed revenue를 캠페인 단위로 조인한다. 의존성: 1/3번 선행필수.
5. [Codex] gap을 `전환 액션`, `날짜 기준`, `view-through`, `NPay`, `중복 태그`, `pending/취소`, `unmapped`로 나눈다. 의존성: 4번 선행필수.
6. [Claude Code] `/ads`에 GDN 비교표 초안을 붙인다. 의존성: 5번 이후 부분병렬.

### Phase 4

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 전환 오염 제거와 보정

- 목표: Google Ads가 실제 결제 확정과 맞는 전환만 학습하게 만든다.
- 왜 지금 해야 하는가: 오염된 전환을 계속 primary로 두면 GDN 자동입찰이 잘못된 사용자와 지면을 학습한다.
- 산출물: GTM 변경안, conversion adjustment 설계, enhanced conversions 도입 판단.
- 완료 기준: purchase 전환은 dynamic value와 transaction_id를 갖고, 취소/환불은 보정 경로가 있으며, NPay 클릭 전환은 purchase로 쓰지 않는다.
- 다음 Phase에 주는 가치: 운영 판단 룰을 실제 시스템 상태에 맞춰 고정할 수 있다.

#### Phase4-Sprint6

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 전환 오염 제거와 보정
**상태**: 우리 기준 10% / 운영 기준 0%

**무엇을 하는가**

NPay 클릭 전환, 중복 purchase 태그, 가상계좌 미입금 purchase, 취소/환불 미반영을 줄인다.

**왜 필요한가**

Google Ads 공식 기준에서도 주문마다 금액이 다르면 dynamic value가 필요하고, 중복 방지에는 transaction_id가 필요하다.
취소/반품은 conversion adjustment로 조정할 수 있으므로, Google Ads ROAS가 gross 매출로만 부풀지 않게 할 수 있다.

**산출물**

- NPay 전환 변경 승인안
- 중복 purchase 태그 정리안
- transaction_id/dynamic value 검증 체크리스트
- conversion adjustment dry-run 설계
- enhanced conversions for web 적용 판단

**우리 프로젝트에 주는 도움**

Google Ads 자동입찰이 실제 매출과 더 가까운 신호로 학습한다.

##### 역할 구분

- TJ: GTM publish, Google Ads 전환 설정 변경, API/secret 발급 승인.
- Codex: conversion adjustment 설계, order_id 매칭, dry-run 파일 생성.
- Claude Code: GTM 변경 초안, Preview 검증, UI 문구.

##### 실행 단계

1. [Claude Code] NPay 클릭 전환 `[248]`과 아임웹 자동 NPay trace를 purchase에서 제외하거나 보조 전환으로 낮추는 변경안을 만든다. 의존성: Phase2 결과 선행필수.
2. [Claude Code] GA4 HURDLERS `[143]` + 홈피구매 `[48]` 중복 발사 제거안을 만든다. 의존성: 병렬가능.
3. [Codex] Google Ads purchase 전환에 `transaction_id`와 dynamic value가 안정적으로 들어가는지 주문 샘플로 검증한다. 의존성: Phase2 결과 선행필수.
4. [Codex] 취소/환불/가상계좌 만료 주문을 Google Ads conversion adjustment로 보낼 수 있는지 `order_id` 기준 dry-run을 설계한다. 의존성: 병렬가능.
5. [TJ] Google Ads 전환 액션 변경과 GTM publish를 승인한다. 의존성: 선행필수. 이유: 운영 태그와 입찰 신호 변경이다.
6. [Codex+Claude Code] 변경 후 7일 동안 Google Ads, GA4, 내부 confirmed 매출 차이를 모니터링한다. 의존성: 5번 선행필수.

### Phase 5

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 운영 판단 룰 고정

- 목표: GDN 예산을 늘릴지, 유지할지, 줄일지 판단하는 기준을 고정한다.
- 왜 지금 해야 하는가: 정합성 확인이 끝나도 어떤 숫자를 의사결정에 쓸지 정하지 않으면 운영자가 다시 헷갈린다.
- 산출물: 운영 룰, 승인 기준, 대시보드 문구.
- 완료 기준: 대표와 운영자가 같은 화면에서 "이 캠페인은 내부 confirmed 기준으로 증액 가능/보류/감액"을 판단할 수 있다.
- 다음 Phase에 주는 가치: Google Ads를 Meta/TikTok/CRM과 같은 매출 기준으로 비교할 수 있다.

#### Phase5-Sprint7

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 운영 판단 룰 고정
**상태**: 우리 기준 5% / 운영 기준 0%

**무엇을 하는가**

Google Ads 플랫폼 ROAS와 내부 confirmed ROAS의 사용처를 나눈다.
GDN view-through 전환은 보조성과로 보고, 예산 증액의 단독 근거로 쓰지 않는 기준을 세운다.

**왜 필요한가**

광고 플랫폼 숫자는 입찰 최적화에는 필요하지만, 회사 손익 판단은 확정매출 기준이어야 한다.

**산출물**

- GDN 예산 판단 룰
- 캠페인 상태 배지
- 승인 체크리스트

**우리 프로젝트에 주는 도움**

Google Ads 숫자가 좋아 보여도 실제 돈이 안 들어온 캠페인을 걸러낼 수 있다.

##### 역할 구분

- TJ: 최소 ROAS, 마진, 증액/감액 기준 승인.
- Codex: 캠페인별 판정 로직과 threshold 계산.
- Claude Code: `/ads` 운영 카드와 문구.

##### 실행 단계

1. [Codex] `internal_confirmed_roas`, `platform_roas`, `view_through_assist`, `conversion_quality_score`를 계산한다. 의존성: Phase3 선행필수.
2. [TJ] 상품군별 최소 ROAS와 마진 기준을 제공한다. 의존성: 선행필수. 이유: 사업 판단이다.
3. [Codex] 캠페인 상태를 `증액 가능`, `관찰`, `오염 의심`, `감액 후보`로 나누는 규칙을 만든다. 의존성: 1/2번 선행필수.
4. [Claude Code] `/ads`에 Google Ads/GDN 카드와 경고 배지를 붙인다. 의존성: 부분병렬.
5. [TJ] 운영 반영을 승인한다. 의존성: 선행필수. 이유: 광고 운영 기준 변경이다.

## 우리 프로젝트에 주는 도움

이 계획이 끝나면 Google Ads ROAS가 실제 확정매출과 얼마나 맞는지 알 수 있다.
GDN은 조회 후 전환을 보조 신호로 살리되, 예산 증액은 내부 confirmed 매출 기준으로 판단할 수 있다.
NPay 클릭 전환, 중복 purchase, 가상계좌 미입금 같은 오염이 줄어 Google Ads 자동입찰도 더 나은 신호를 학습한다.

## 다음 액션

### 지금 당장

1. [Codex] 최신 GTM snapshot을 재생성하고 v137 이후 Google Ads/NPay/purchase 태그 상태를 확인한다.
2. [TJ] Google Ads 전환 액션 목록을 export한다. 특히 `AW-304339096`의 NPay 관련 label 2개와 purchase primary 여부를 확인한다.
3. [Codex] Google Ads export 컬럼 템플릿과 내부 confirmed ROAS 조인 스키마를 만든다.

### 이번 주

1. [TJ+Claude Code] 카드, 가상계좌, NPay 결제수단별 Preview/DebugView 테스트를 한다.
2. [Codex] Google Ads 플랫폼 리포트와 내부 Attribution ledger를 같은 기간으로 대조한다.
3. [Claude Code] NPay 클릭 전환과 HURDLERS+홈피구매 중복 제거 GTM 변경안을 작성한다.

### 운영 승인 후

1. [TJ] GTM publish와 Google Ads 전환 설정 변경을 승인한다.
2. [Codex] conversion adjustment dry-run을 운영 데이터 write 없이 검증한다.
3. [Codex+Claude Code] `/ads`에 Google Ads/GDN 정합성 카드를 붙이고 7일 관찰한다.

## 승인 포인트

- Google Ads API 권한 또는 리포트 export 승인.
- GTM publish 승인.
- Google Ads 전환 액션 primary/secondary 변경 승인.
- NPay 클릭 전환 제거 또는 보조 전환 전환 승인.
- conversion adjustment 실제 업로드 승인.

## 업데이트 이력

| 시각 | 변경 | 근거 |
|---|---|---|
| 2026-04-23 12:12 KST | 최초 작성. Google Ads/GDN ROAS 정합성 체크와 개선 계획을 별도 문서로 분리 | `tiktok/tiktokroasplan.md`, `data/!datacheckplan.md`, `GA4/GA4검증.md`, `GA4/npay_return_missing_20260421.md`, `capivm/googleadstictok.md`, Google 공식 문서 확인 |
| 2026-04-23 12:24 KST | Google Ads 접근 상태 갱신. TJ가 서비스 계정을 읽기 전용으로 추가했고, 남은 조건은 Google Ads API developer token임을 명시 | 사용자 보고, Google Ads API developer token/service account 공식 문서 |
| 2026-04-23 12:24 KST | API Center 접근 불가 원인 추가. 현재 `214-999-0943 바이오컴`은 광고 계정 관리자이지만 MCC가 아니라서 developer token 페이지가 열리지 않음을 기록 | TJ 스크린샷, Google Ads API developer token 공식 문서 |
