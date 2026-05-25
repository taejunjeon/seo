# reportcoffee Naver Ads customer 2424664 auth check 20260525

작성 시각: 2026-05-25 09:32 KST
담당: Codex
문서 성격: 더클린커피 Naver Ads customer id 2424664 read-only 접근 확인

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - report/reportcoffee-naver-ads-campaign-full-audit-20260525.md
  lane: Green
  allowed_actions:
    - Naver Ads read-only auth check
    - Naver Ads listCampaigns read-only attempt
    - local markdown report output
  forbidden_actions:
    - Naver Ads state change
    - Naver Ads cache write
    - operating_db_write
    - Slack send
    - platform conversion send
    - GTM publish
    - raw secret output
  source_window_freshness_confidence:
    source: "local backend/.env BIOCOM_NAVER_ADS_* access/secret with X-Customer override 2424664"
    window: "listCampaigns auth check only"
    freshness: "2026-05-25 09:25 KST API response"
    confidence: "high for auth failure of current credential against customer 2424664"
```

## 사람 말 요약

TJ님이 준 더클린커피 Naver Ads 계정 `2424664`를 같은 API 키로 조회했지만, 현재 로컬에 있는 `BIOCOM_NAVER_ADS_*` access/secret은 이 customer에 접근 권한이 없다.

즉, 앞선 보고서에서 읽은 계정과 TJ님이 말한 더클린커피 계정은 같은 API 권한 범위가 아니다. 캠페인 목록까지 가지 못하고 인증 단계에서 막혔다.

## 실행한 것

- 같은 Naver Search Ad API를 사용했다.
- access/secret은 기존 로컬 `BIOCOM_NAVER_ADS_*` 값을 사용했다.
- 요청 헤더의 customer id만 `2424664`로 바꿨다.
- endpoint는 캠페인 목록 조회인 `GET /ncc/campaigns`만 호출했다.
- 광고 설정 변경, DB 저장, 캐시 저장, 전환 전송은 하지 않았다.

## 결과

- HTTP status: 403
- blocker: `auth_failed_for_customer_2424664`
- 해석: 현재 API key가 customer `2424664`에 연결되어 있지 않거나, 해당 customer에 대한 권한이 없다.
- 캠페인 목록: 미조회
- 광고비/클릭/전환값: 미조회

주의: API 오류 원문에는 API key 일부가 포함될 수 있어 문서와 채팅에 원문을 싣지 않는다.

## 영향

이 결과는 “더클린커피 광고가 없다”는 뜻이 아니다.

정확한 뜻은 “현재 repo에 들어있는 BIOCOM_NAVER_ADS credential로는 더클린커피 customer 2424664를 읽을 수 없다”이다.

따라서 더클린커피 네이버 광고비를 Slack 보고서에 포함하려면 customer `2424664`에 접근 가능한 Naver Ads API access/secret이 별도로 필요하다.

## 다음 확인

1. Naver Ads API 관리 화면에서 customer `2424664`에 연결된 API License와 Secret Key를 확인한다.
2. 이 repo에는 `COFFEE_NAVER_ADS_CUSTOMER_ID=2424664`, `COFFEE_NAVER_ADS_ACCESS`, `COFFEE_NAVER_ADS_SECRET_KEY`처럼 더클린커피 전용 env로 분리하는 것이 안전하다.
3. 같은 BIOCOM credential에 customer `2424664` 권한을 추가할 수 있다면, 권한 추가 후 read-only 재조회한다.
4. 권한이 열리기 전까지 Slack 보고서에는 `Naver: customer 2424664 API 권한 미연결`로 표시해야 한다.

## Auditor verdict

```text
Auditor verdict: PASS_WITH_BLOCKER
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
Naver Ads state change: 0
Raw secret output in report: 0
Remaining blocker: blocked_access
```
