import type { Metadata } from "next";
import { AibioNativeAccessAdmin } from "./AibioNativeAccessAdmin";

export const metadata: Metadata = {
  title: "AIBIO 관리자 권한 | Native Admin",
  description: "AIBIO 자체 솔루션 운영자 역할과 접근 권한을 지정하는 관리자 초안입니다.",
};

export default function AibioNativeAccessAdminPage() {
  return <AibioNativeAccessAdmin />;
}
