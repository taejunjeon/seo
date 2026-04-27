import type { Metadata } from "next";
import { ContactDashboard } from "./ContactDashboard";

export const metadata: Metadata = {
  title: "AIBIO 컨택 관리 대시보드",
  description: "접수 폼 리드의 컨택 시도, 고객 반응, 다음 액션을 시간순으로 관리하는 운영자 콘솔입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AibioContactDashboardPage() {
  return <ContactDashboard />;
}
