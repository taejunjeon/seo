"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  boot,
  shutdown,
  setPage,
  resolvePageName,
} from "@/lib/channeltalk";

const PLUGIN_KEY = process.env.NEXT_PUBLIC_CHANNELTALK_PLUGIN_KEY ?? "";

/**
 * ChannelTalk SDK 부트스트랩 컴포넌트
 *
 * - layout.tsx에 한 번만 배치
 * - Plugin Key가 없으면 아무것도 하지 않음 (앱 정상 동작)
 * - pathname 변경 시 setPage 자동 호출
 * - 향후 memberId/memberHash 연동 시 이 컴포넌트에서 boot 옵션만 확장하면 됨
 */
export default function ChannelTalkProvider() {
  const pathname = usePathname();

  // Boot once on mount
  useEffect(() => {
    if (!PLUGIN_KEY) return;

    boot({ pluginKey: PLUGIN_KEY });

    return () => {
      shutdown();
    };
  }, []);

  // Track page changes
  useEffect(() => {
    if (!PLUGIN_KEY) return;

    const pageName = resolvePageName(pathname);
    setPage(pageName);
  }, [pathname]);

  // 렌더링 없음 — 사이드 이펙트 전용
  return null;
}
