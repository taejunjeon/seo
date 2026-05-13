# Naver Organic And Search Tools

작성 시각: 2026-05-14 00:55 KST
site: biocom
window: 2026-05-01 <= KST < 2026-06-01

## 네이버 자연검색 판정

현재 로컬 dry-run 기준으로 주문 단위 네이버 자연검색 confirmed 매출은 0원이다.

VM Cloud `attribution_ledger`에서 네이버 referrer aggregate는 175건이지만 다음처럼 분리된다.

- 네이버 검색 referrer 144건: 모두 `NaPm` 또는 브랜드검색 표식이 있어 자연검색 제외.
- 유료 표식 없는 네이버 비검색 referrer 2건: 검색 referrer가 아니라 자연검색 매출 근거로 제외.
- Search Advisor: query/page/day aggregate만 제공하므로 주문 단위 매출 배정에는 사용하지 않음.

## 왜 중요한가

네이버 검색 화면에서 들어온 것처럼 보여도 `NaPm`이 있으면 네이버 광고/브랜드검색 쪽 evidence일 수 있다. 이걸 자연검색 매출로 올리면 광고와 오가닉 판단이 동시에 틀어진다.

## 도구별 역할

| 도구 | 주는 데이터 | 주문 단위 attribution | aggregate evidence | actual 매출 정본 | unknown 감소 영향 |
|---|---|---:|---:|---:|---|
| 운영DB 결제완료 spine | 실제 결제완료 매출 | NO | YES | YES | 매출 정본 |
| VM Cloud `attribution_ledger` | landing/referrer/UTM/click evidence | YES, key bridge 있을 때 | YES | NO | 가장 큼 |
| Naver Search Advisor | 네이버 검색어/page/day | NO | YES | NO | 중간, query 설명용 |
| Naver Analytics WCS | 방문/유입/페이지 로그 | NO | YES | NO | 낮음~중간, 세션 설명용 |
| Google Search Console | 구글 검색어/page/day | NO | YES | NO | 중간, Google organic 설명용 |
| GA4 BigQuery | 세션/이벤트/traffic source | 제한적 | YES | NO | cross-check |
| Braze MCP | CRM touchpoint | NO | YES | NO | CRM 보조 |
| Naver Ads API/export | 광고비/광고 성과 | 제한적 | YES | NO | paid_naver 검증 |

## Naver Analytics WCS 메모

TJ님이 준 `wcslog.js` 스크립트와 발급 ID는 네이버 애널리틱스 수집 태그다. 공식 도움말 기준 네이버 애널리틱스는 사이트 등록 후 분석 스크립트를 설치해 쓰는 방식이고, 유입/검색어/페이지 보고서는 화면에서 제공된다. 다만 도움말 기준 URL 파라미터는 상세 보존보다 path 중심 통계로 정리되는 제한이 있어 주문 단위 attribution source로는 부족하다.

따라서 네이버 애널리틱스는 다음처럼 쓰는 것이 맞다.

- 가능: 네이버 유입/검색어/페이지 aggregate 설명.
- 제한: 주문 단위 매출 배정, 광고비 ROAS 계산, 실제 결제완료 매출 정본.
- 권장: `/total`의 예산 판단 매출에는 더하지 말고, Search Advisor/GA4처럼 참고 evidence로만 붙인다.

참고 공식 문서:

- [네이버 애널리틱스 시작 방법](https://help.naver.com/service/9864/contents/15303?lang=ko)
- [네이버 애널리틱스 분석 가능한 지표](https://help.naver.com/service/9864/contents/15394?lang=ko)
- [네이버 애널리틱스 매개변수별 지표 수집 제한](https://help.naver.com/service/9864/contents/15478?lang=ko)

## 결론

네이버 오가닉을 예산 판단 매출로 쓰려면 VM Cloud 또는 first-party 장부에서 “유료 표식 없음 + 네이버 검색 referrer + 결제완료 bridge”가 닫혀야 한다. Search Advisor는 검색어 설명에는 좋지만 주문 매출을 직접 증명하지 못한다.
