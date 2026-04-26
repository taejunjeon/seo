import type { Metadata } from "next";
import { AibioNativeAdmin } from "./AibioNativeAdmin";

export const metadata: Metadata = {
  title: "AIBIO 리드 관리자 MVP",
  description: "AIBIO 자체 홈페이지 전환 이후 리드, 예약, 방문, 결제 상태를 보는 운영자 화면 초안입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AibioNativeAdminPage() {
  return <AibioNativeAdmin />;
}
