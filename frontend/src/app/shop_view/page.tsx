import type { Metadata } from "next";
import { RecoveryLabOfferLanding } from "./RecoveryLabOfferLanding";

export const metadata: Metadata = {
  title: "AIBIO 리커버리랩 첫방문 체험 상담",
  description:
    "AIBIO 리커버리랩 첫방문 체험 상담 랜딩. /shop_view?idx=25 아임웹 고유입 랜딩을 자체 리드 원장과 연결하는 1차 실험 route입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ShopViewPage() {
  return <RecoveryLabOfferLanding />;
}
