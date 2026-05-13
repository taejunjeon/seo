/**
 * 네이버 검색광고 API 인증 검증 ping (gpt0508-49 단계 1).
 *
 * 1. env 3종 등록 확인
 * 2. listCampaigns()
 * 3. 첫 캠페인의 3d stats 호출
 * 4. 결과 sanitize 후 출력 (raw secret / raw 매출 / 상세 PII 출력 0)
 */
import { verifyNaverAdsAuth, isNaverAdsConfigured } from "../src/naverAdsClient";

const main = async () => {
  console.log("=== 네이버 검색광고 API ping ===");
  console.log("configured:", isNaverAdsConfigured());
  const result = await verifyNaverAdsAuth();
  // raw secret 등 민감 값 출력 안 함. campaigns_count / 1 sample 만.
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok && !result.configured) {
    console.error("env 미설정 — BIOCOM_NAVER_ADS_CUSTOMER_ID / ACESS / SECRET_KEY 확인");
    process.exit(2);
  }
  if (!result.ok) {
    console.error(`인증 실패 status=${result.status} error=${result.error}`);
    process.exit(3);
  }
  console.log(`PASS — 인증 헤더 + HMAC 서명 정상. 캠페인 ${result.campaigns_count}건 발견.`);
};

main().catch((e) => {
  console.error("script failed", e);
  process.exit(1);
});
