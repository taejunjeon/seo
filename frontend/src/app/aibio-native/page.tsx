import type { Metadata } from "next";
import { AibioNativeExperience } from "./AibioNativeExperience";

export const metadata: Metadata = {
  title: "AIBIO Recovery Lab 자체 홈페이지 MVP",
  description:
    "AIBIO 리커버리랩스 자체 홈페이지 MVP. 상담예약, 프로그램 소개, 유입 측정, 예약금 결제 전 단계 검증용 페이지입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AibioNativePage() {
  return <AibioNativeExperience />;
}
