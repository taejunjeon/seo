# TikTok firstTouch VM 배포 승인 검토서

작성 시각: 2026-04-28 00:23 KST
대상 문서: `tiktok/tiktokroasplan.md` v3.20
승인/진행 대상: TJ 관리 Attribution VM backend 배포

## 배포 결과

배포 완료 시각: 2026-04-27 21:07 KST
배포 대상: TJ 관리 Attribution VM `att.ainativeos.net` backend `seo-backend`
배포 방식: unrelated 로컬 변경을 피하기 위해 firstTouch 관련 backend 파일만 선별 반영

배포한 파일:

- `backend/dist/attribution.js`
- `backend/dist/routes/attribution.js`
- `backend/dist/tiktokRoasComparison.js`
- `backend/src/attribution.ts`
- `backend/src/routes/attribution.ts`
- `backend/src/tiktokRoasComparison.ts`
- `backend/tests/attribution.test.ts`

배포 전 백업:

- SQLite 백업: `/home/biocomkr_sns/seo/shared/backups/crm.sqlite3.pre_firsttouch_20260427_firsttouch_120610.bak`
- dist/source 백업: `/home/biocomkr_sns/seo/shared/deploy-backups/20260427_firsttouch_120610/backend-firsttouch-dist.prev.tgz`

배포 후 검증:

| 검증 | 결과 |
|---|---|
| PM2 `seo-backend` | online, restart count 30, created at `2026-04-27T12:07:06.840Z` |
| `https://att.ainativeos.net/health` | `status=ok` |
| ROAS API `first_touch_attribution` | 필드 노출 확인 |
| ROAS API firstTouch 현재 값 | 기존 과거 데이터 기준 후보 0행. 배포 후 신규 이벤트부터 채워지는 구조라 정상 |
| Attribution ledger read | `checkout_started=3022`, `payment_success=1724` |
| TikTok pixel event read | `CRM_LOCAL_DB_PATH#tiktok_pixel_events` 조회 200 |

현재 상태 판단:

- 배포는 성공했다.
- firstTouch 기능은 운영 backend에 반영됐다.
- 신규 가상계좌/카드 주문에서 `metadata_json.firstTouch` 생성이 확인됐다.
- TikTok UTM 또는 `ttclid`가 있는 실제 광고 유입 표본 검증은 아직 남아 있다.

## 배포 후 가상계좌 검증

검증 시각: 2026-04-27 22:58 KST  
주문 URL: `https://biocom.kr/shop_payment_complete?order_code=o2026042705c0da395af77&payment_code=pa20260427065cdaabb4f5a&order_no=202604275818534&rk=S`  
주문번호: `202604275818534`  
주문코드: `o2026042705c0da395af77`  
결제코드: `pa20260427065cdaabb4f5a`  
금액: 35,000원

확인 결과:

| 검증 | 결과 |
|---|---|
| TikTok Pixel Helper | `Purchase` 없음, `PlaceAnOrder`만 확인 |
| TJ 관리 Attribution VM `tiktok_pixel_events` | `purchase_intercepted`, `decision_received`, `blocked_pending_purchase`, `sent_replacement_place_an_order` 총 4행 |
| 결제 판정 | `pending / block_purchase_virtual_account / confidence=high / matchedBy=toss_direct_order_id` |
| Toss direct 상태 | `WAITING_FOR_DEPOSIT`, channel `가상계좌` |
| Attribution ledger `checkout_started` | 존재. `metadata_json.firstTouch` 저장됨 |
| Attribution ledger `payment_success` | 존재. `paymentStatus=pending`, `metadata_json.firstTouch` 저장됨 |
| firstTouch 매칭 | `checkout_id`, `order_id`, `order_id_base`, `ga_session_id`, `client_id`, `user_pseudo_id`, score 460 |
| firstTouch TikTok 근거 | 없음. 이번 테스트 유입은 `@direct`라서 `tiktokMatchReasons=[]` |

판정:

- 가상계좌 pending 주문에서 TikTok `Purchase`를 막고 `PlaceAnOrder`로 낮추는 Guard는 정상이다.
- firstTouch persistence도 정상이다. `payment_success.metadata_json.firstTouch`가 실제 운영 VM에 생성됐다.
- 다만 이번 테스트는 TikTok 광고 유입이 아니라 direct 유입이므로, “TikTok 유입값이 firstTouch로 보존된다”는 검증은 아직 아니다. 그 검증은 TikTok UTM 또는 `ttclid`가 있는 유입으로 신규 주문을 만들어야 한다.

## 배포 후 카드 검증

검증 시각: 2026-04-28 00:23 KST  
주문 URL: `https://biocom.kr/shop_payment_complete?order_code=o20260427016c28339089c&payment_code=pa20260427fe8ae66a5f5d0&order_no=202604289758373&rk=S`  
주문번호: `202604289758373`  
주문코드: `o20260427016c28339089c`  
결제코드: `pa20260427fe8ae66a5f5d0`  
금액: 11,900원

확인 결과:

| 검증 | 결과 |
|---|---|
| TikTok Pixel Helper | `Purchase` 확인, `event_id=Purchase_o20260427016c28339089c` |
| TJ 관리 Attribution VM `tiktok_pixel_events` | `purchase_intercepted`, `decision_received`, `released_confirmed_purchase` 총 3행 |
| 결제 판정 | `confirmed / allow_purchase / confidence=high / matchedBy=toss_direct_order_id` |
| Toss direct 상태 | `DONE`, channel `카드`, approvedAt `2026-04-28T00:20:15+09:00` |
| Attribution ledger `checkout_started` | 존재. `metadata_json.firstTouch` 저장됨 |
| Attribution ledger `payment_success` | 존재. `paymentStatus=confirmed`, `metadata_json.firstTouch` 저장됨 |
| firstTouch 매칭 | `checkout_id`, `order_id`, `order_id_base`, `ga_session_id`, `client_id`, `user_pseudo_id`, score 460 |
| firstTouch TikTok 근거 | 없음. 이번 테스트 유입은 direct라서 `tiktokMatchReasons=[]` |

상태 동기화 메모:

- 카드 결제 직후 `payment_success.paymentStatus`는 일시적으로 `pending`이었다.
- TJ 관리 Attribution VM status sync가 같은 주문을 `confirmed`로 승격했고, 최종 재조회 기준 `CRM_LOCAL_DB_PATH#attribution_ledger.payment_status=confirmed`다.
- 이 지연은 픽셀 실패가 아니라 원장 상태 동기화 타이밍 문제다.

판정:

- 카드 confirmed 주문에서 TikTok `Purchase` 허용은 정상이다.
- firstTouch persistence도 정상이다. 가상계좌와 카드 양쪽에서 `payment_success.metadata_json.firstTouch`가 생성됐다.
- 남은 검증은 TikTok UTM 또는 `ttclid` 유입값이 `firstTouch`에 보존되는지 보는 것이다.

## 결론

Codex 진행 추천: **승인 권고**
진행 추천 자신감: **96%**

이 작업은 TikTok ROAS 정합성 개선을 위해 `checkout_started`의 최초 유입 신호를 `payment_success`까지 보존하는 배포다. 개발팀 관리 운영DB PostgreSQL 스키마 변경이나 운영DB write는 없다. 변경 데이터 위치는 **TJ 관리 Attribution VM SQLite** `CRM_LOCAL_DB_PATH#attribution_ledger.metadata_json.firstTouch`다.

승인해도 되는 이유:

- strict TikTok confirmed 계산을 직접 부풀리지 않는다.
- `payment_success.utm_source`, `payment_success.ttclid` 같은 top-level attribution 필드는 덮어쓰지 않는다.
- firstTouch 후보는 `/ads/tiktok`에서 strict confirmed와 별도 카드로 표시된다.
- 로컬 타입체크, 백엔드 테스트, 프론트 빌드가 통과했다.
- DB 스키마 변경이 없어 롤백 부담이 낮다.

남은 리스크:

- 실제 TikTok 광고 유입에서 `utm_source=tiktok` 또는 `ttclid`가 checkout 단계에 들어오는지는 추가 표본으로 확인해야 한다.
- 과거 주문에는 `metadata_json.firstTouch`가 생기지 않는다. 이 배포는 미래 데이터 정합성을 높이는 작업이다.

## TJ님이 승인 전 검토할 것

1. **승인 범위가 맞는지**
   - 승인 포함: TJ 관리 Attribution VM backend 배포, health check, smoke 확인, 신규 주문 2건 검증.
   - 승인 제외: 개발팀 관리 운영DB PostgreSQL 스키마 변경, 개발팀 관리 운영DB write, 과거 주문 attribution backfill, TikTok 예산 증액.

2. **데이터 위치가 맞는지**
   - 운영DB: 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users`. 이번 작업 대상 아님.
   - 배포 대상: TJ 관리 Attribution VM `att.ainativeos.net`.
   - 저장 위치: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger.metadata_json.firstTouch`.
   - 화면 캐시: 로컬 개발 DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3#tiktok_ads_daily`.

3. **숫자 해석 방식이 안전한지**
   - `Attribution confirmed`: 계속 strict 기준이다.
   - `firstTouch 후보 confirmed`: checkout에는 TikTok 신호가 있었던 후보일 뿐, 확정 ROAS로 자동 승격하지 않는다.
   - 예산 증액 판단은 strict confirmed, GA4 교차검증, 개발팀 관리 운영DB 주문 상태를 함께 본 뒤 한다.

4. **실패 시 롤백 기준이 충분한지**
   - 배포 전 TJ 관리 Attribution VM backend dist 백업을 만든다.
   - 배포 전 TJ 관리 Attribution VM SQLite 파일 백업을 만든다.
   - 이상 발생 시 이전 dist로 되돌린다.
   - 이번 변경은 새 metadata 추가라서, 롤백 후 기존 결제 판정/guard 차단 로직이 계속 동작해야 한다.

5. **배포 후 검증이 명확한지**
   - 카드 결제 1건: TikTok Pixel Helper에 `Purchase`가 보여야 한다.
   - 가상계좌 생성 1건: TikTok Pixel Helper에 `Purchase`가 없어야 하고 `PlaceAnOrder`만 보여야 한다.
   - TJ 관리 Attribution VM ledger에서 카드 주문의 `payment_success.metadata_json.firstTouch`가 존재해야 한다.
   - `/ads/tiktok`에서 `firstTouch 후보 confirmed/pending` 카드가 API 오류 없이 표시되어야 한다.

## 배포 전 통과한 검증

| 검증 | 결과 |
|---|---|
| `npm --prefix backend run typecheck` | 통과 |
| `npm --prefix backend run build` | 통과 |
| `node --import tsx --test tests/attribution.test.ts` | 33/33 통과 |
| `npx eslint src/app/ads/tiktok/page.tsx` | 통과 |
| `npm --prefix frontend run build` | 통과 |
| `npm --prefix frontend run lint` | 실패. TikTok 페이지가 아니라 기존 다른 페이지 lint 오류 때문 |

## 승인 문구 추천

아래 문구로 승인하면 범위가 명확하다.

> 승인합니다. 범위는 TJ 관리 Attribution VM backend 배포, 배포 전 DB/dist 백업, health check, smoke 확인, 신규 카드/가상계좌 주문 검증까지입니다. 개발팀 관리 운영DB PostgreSQL 스키마 변경/write, 과거 주문 backfill, TikTok 예산 변경은 승인 범위에서 제외합니다.

## 배포 후 TJ님이 확인할 화면

- 로컬 화면: `http://localhost:7010/ads/tiktok`
- 운영 health: `https://att.ainativeos.net/health`
- firstTouch 확인 위치: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger.metadata_json.firstTouch`
- 픽셀 이벤트 확인 위치: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#tiktok_pixel_events`

## 판단

현재 자료와 테스트 기준으로는 **배포 완료 후 운영 검증 통과 96%**다.

조건은 다음과 같다.

- 배포 전 백업을 남긴다.
- 배포 직후 health check를 통과한다.
- 신규 주문 2건으로 card confirmed와 virtual-account pending 차단을 확인했다.
- firstTouch 후보를 strict confirmed에 합산하지 않는다.

위 조건은 충족됐다. 남은 것은 TikTok UTM 또는 `ttclid`가 있는 실제 광고 유입 표본으로 firstTouch에 TikTok 근거가 남는지 확인하는 일이다.
