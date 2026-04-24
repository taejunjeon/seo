import type { Metadata } from "next";
import { Fira_Code, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BiocomAI - AEO/GEO 최적화 대시보드",
  description: "AI 기반 AEO/GEO 최적화로 검색 성과를 극대화하는 대시보드",
  // 내부 전략·실적 대시보드라 검색엔진 색인·스니펫 모두 차단
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": 0,
      "max-image-preview": "none",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${spaceGrotesk.variable} ${plusJakarta.variable} ${firaCode.variable}`}>
        {children}
      </body>
    </html>
  );
}
