import type { Metadata } from "next";
import { Fira_Code, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BiocomAI - AEO/GEO 최적화 대시보드",
  description: "AI 기반 AEO/GEO 최적화로 검색 성과를 극대화하는 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${spaceGrotesk.variable} ${firaCode.variable}`}>
        {children}
      </body>
    </html>
  );
}
