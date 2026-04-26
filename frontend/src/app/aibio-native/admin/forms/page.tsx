import type { Metadata } from "next";
import { AibioNativeFormsAdmin } from "./AibioNativeFormsAdmin";

export const metadata: Metadata = {
  title: "AIBIO 입력폼 분석 | Native Admin",
  description: "아임웹 입력폼 엑셀을 업로드해 자체 리드 원장 필드와 대조하는 관리자 초안입니다.",
};

export default function AibioNativeFormsAdminPage() {
  return <AibioNativeFormsAdmin />;
}
