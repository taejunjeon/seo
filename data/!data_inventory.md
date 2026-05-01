# SEO 데이터 위치 인벤토리

작성 시각: 2026-05-01 10:30 KST
문서 성격: 데이터 위치 관리 기준판
적용 범위: `seo` 저장소의 주요 분석 데이터 파일, 외부 데이터 소스, 운영 DB/로컬 DB 위치
관리 원칙: 데이터 파일을 하나로 합치지 않는다. 위치, 용도, 정본성, 신선도, 개인정보 민감도를 관리한다.

## 왜 필요한가

현재 프로젝트는 GA4 BigQuery, Imweb API, 운영 Postgres, 로컬 SQLite, 아임웹 엑셀, 광고 CSV가 같이 쓰인다. 파일 위치를 문서로 고정하지 않으면 같은 데이터를 다시 요청하거나, stale 파일을 정본으로 쓰는 실수가 생긴다.

따라서 이 문서를 “데이터가 어디에 있는지” 보는 기준판으로 둔다.

## 더클린커피 아임웹 엑셀

확인 명령:

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const XLSX = require('./backend/node_modules/xlsx');
for (const file of fs.readdirSync('data/coffee').filter(f => f.endsWith('.xlsx')).sort()) {
  const p = path.join('data/coffee', file);
  const wb = XLSX.readFile(p, { sheetRows: 10 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const header = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })[0] || [];
  console.log(file, Math.max(0, range.e.r - range.s.r), header.slice(0, 6).join(' / '));
}
NODE
```

| 파일 | 종류 | 데이터 행 | 고유 주문 | 기간 | 용도 | 상태 |
|---|---|---:|---:|---|---|---|
| `data/coffee/coffee_orders_2025.xlsx` | 아임웹 주문내역 | 16,454 | 11,018 | 2025-01-01 ~ 2025-12-31 | 2025 주문/LTV/배송/상품 원장 | 사용 가능 |
| `data/coffee/coffee_payments_2025.xlsx` | 아임웹 결제내역 | 11,341 | 11,018 | 2025-01-01 ~ 2026-01-01 | 2025 결제수단/환불/정산 원장 | 사용 가능 |
| `data/coffee/coffee_orders_2024.xlsx` | 아임웹 주문내역 | 2,800 | 1,987 | 2024-11-01 ~ 2024-12-31 | 2024 주문/LTV 원장 | 사용 가능 |
| `data/coffee/coffee_payments_2024.xlsx` | 아임웹 결제내역 | 2,044 | 1,987 | 2024-11-01 ~ 2024-12-31 | 2024 결제수단/환불/정산 원장 | 사용 가능 |
| `data/coffee/coffee_orders_2023.xlsx` | 아임웹 주문내역 | 0 | 0 | 없음 | 헤더 확인용 | 실제 데이터 없음 |
| `data/coffee/coffee_payments_2023.xlsx` | 아임웹 결제내역 | 0 | 0 | 없음 | 헤더 확인용 | 실제 데이터 없음 |

판단:

- 2024/2025 주문내역과 결제내역 엑셀은 이미 존재한다.
- 2023 파일은 존재하지만 데이터 행이 0개다. 현재 기준 추가 분석 원장으로 쓰지 않는다.
- `!coffeedata`에서 “2025 결제내역, 2024 주문/결제 엑셀 다운로드 필요”라고 되어 있으면 오래된 문구다.

## 더클린커피 주요 외부/DB 소스

| 소스 | 위치/식별자 | 역할 | 정본성 | 주의 |
|---|---|---|---|---|
| Imweb v2 API | `IMWEB_API_KEY_COFFEE`, `IMWEB_SECRET_KEY_COFFEE` | 최신 주문 header/payment/channel_order_no | 운영 incremental primary | read-only 조회만 허용 |
| GA4 BigQuery | `project-dadba7dd-0229-4ff6-81c.analytics_326949178` | GA4 raw purchase, already_in_ga4 guard | GA4 raw primary | 광고 전송 판단에는 actual order와 대조 필요 |
| 운영 Postgres Toss | `public.tb_sales_toss`, `store='coffee'` | Toss/card cross-check | cross-check | 일부 sync gap 가능 |
| 운영 Postgres PlayAuto | `public.tb_playauto_orders`, `shop_name='아임웹-C'` | 상품명/배송상태 cross-check | cross-check | 결제금액 primary로 쓰지 않음 |
| 운영 Postgres Imweb users | `public.tb_iamweb_users` | biocom 중심 기존 원장 | coffee primary 금지 | coffee order_no match 0건 확인 |
| 로컬 SQLite | `backend/data/crm.sqlite3` | 로컬 분석/백필 결과 | fallback | stale 여부 확인 후 사용 |

## 더클린커피 분석 스크립트

| 스크립트 | 용도 | 쓰기 여부 |
|---|---|---|
| `backend/scripts/coffee-imweb-operational-readonly.ts` | Imweb API, GA4, 운영 DB read-only 대조 | write 없음 |
| `backend/scripts/coffee-ga4-robust-guard.ts` | order/channel id가 GA4 raw에 있는지 robust search | write 없음 |
| `backend/scripts/coffee-excel-import-dry-run.ts` | 엑셀을 DB에 넣지 않고 join/금액/결제수단/LTV 검증 | write 없음 |
| `backend/scripts/import-coffee-excel.cjs` | 로컬 SQLite 실제 주문 엑셀 import | local DB write, 승인 필요 |
| `backend/scripts/import-coffee-payment-excel.cjs` | 로컬 SQLite 실제 결제 엑셀 import | local DB write, 승인 필요 |

## 파일명 규칙

더클린커피 아임웹 엑셀은 아래 표준 파일명을 사용한다.

```text
data/coffee/coffee_orders_YYYY.xlsx
data/coffee/coffee_payments_YYYY.xlsx
```

예전 문서에 `기본_양식_...xlsx`, `결제_내역_...xlsx`가 나오면, 현재 표준 파일명으로 rename된 것으로 본다.

## 보안/PII 주의

아임웹 엑셀에는 이름, 전화번호, 이메일, 주소가 포함된다.

- 원본 엑셀 파일은 커밋/공유 정책을 별도 확인한다.
- 리포트에는 raw phone/email/address 샘플을 출력하지 않는다.
- local DB import apply는 백업, dry-run, 승인 후에만 한다.
- 운영 DB write와 외부 광고 전송은 이 문서 범위에서 금지다.

## 다음 관리 작업

| 작업 | 이유 | 담당 |
|---|---|---|
| 2024/2025 통합 dry-run 결과 문서화 | 24개월 LTV/재구매 기준을 닫기 위해 | Codex |
| 2025 amount mismatch 397건 reason 분해 | 주문금액/결제금액 차이를 이해해야 LTV가 정확함 | Codex |
| 2023 헤더-only 상태 유지 또는 제거 판단 | 분석 대상이 아니면 혼동을 줄여야 함 | TJ + Codex |
| 신규 엑셀 다운로드 시 이 문서 갱신 | 중복 요청과 stale source 오판 방지 | 다운로드 수행자 |
