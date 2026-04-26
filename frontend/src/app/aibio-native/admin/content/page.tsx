import type { Metadata } from "next";
import { AibioNativeContentAdmin } from "./AibioNativeContentAdmin";

export const metadata: Metadata = {
  title: "AIBIO 상세페이지 편집 | Native Admin",
  description: "AIBIO 첫 실험 랜딩의 문구, 이미지, CTA를 편집하는 관리자 초안입니다.",
};

export default function AibioNativeContentAdminPage() {
  return <AibioNativeContentAdmin />;
}
