import fs from "node:fs/promises";
import path from "node:path";

import { getGa4RevenueOpsPlan } from "../src/ga4RevenueOpsPlan";

const resolveArg = (name: string): string | undefined => {
  const exactIdx = process.argv.indexOf(name);
  if (exactIdx >= 0) {
    const value = process.argv[exactIdx + 1];
    return value && !value.startsWith("--") ? value : undefined;
  }

  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : undefined;
};

const escapeCell = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
const list = (items: string[]) => items.map((item) => `- ${item}`);

const toMarkdown = () => {
  const plan = getGa4RevenueOpsPlan();
  const lines: string[] = [];

  lines.push("# Codex Feedback 0329-5 Reply");
  lines.push("");
  lines.push("## 개발 산출물");
  lines.push("");
  lines.push("- `backend/src/ga4RevenueOpsPlan.ts`: 5차 피드백을 구조화한 정적 plan source");
  lines.push("- `backend/scripts/ga4-revenue-ops-plan.ts`: Markdown/JSON 출력 스크립트");
  lines.push("- `backend/tests/ga4-revenue-ops-plan.test.ts`: source of truth 회귀 테스트");
  lines.push("- `backend/src/routes/ga4.ts`: `/api/ga4/revenue-ops-plan` endpoint");
  lines.push("");
  lines.push("## 요청 반영 상태");
  lines.push("");
  lines.push("| 요청 항목 | 상태 | 비고 |");
  lines.push("| --- | --- | --- |");
  lines.push("| 1. 매출 정합성 체크 실행안 | 완료 | smoke 가능 이유, 3~7일 신뢰 구간, 일반/NPay/가상계좌 분리, pseudo-SQL 포함 |");
  lines.push("| 2. 과거 데이터 소급 가능성 평가 | 완료 | GA4 UI 한계, MP 72시간 한계, BI 보정 리포트 대안 포함 |");
  lines.push("| 3. 가상계좌 A안 구체화 | 완료 | GTM 가능/불가, backend/DB 신호, 상태값, 추천 순서 포함 |");
  lines.push("| 4. refund / cancel 설계 | 완료 | refund 기준, transaction_id, 미입금 취소 처리 원칙, ROAS/DB 영향 포함 |");
  lines.push("| 5. 아임웹 코드 이관안 | 완료 | live version 충돌, direct G-8 선행조건, footer gtag 의존 로직 dataLayer 이관안 포함 |");
  lines.push("| 6. 역할 분담 기준 | 완료 | GPT / Codex / 사용자 역할 고정 문구 반영 |");
  lines.push("| 7. 필수자료 / 참고자료 | 완료 | 이번 턴 기준 정말 필요한 자료만 재정리 |");
  lines.push("| live Imweb code version 직접 확정 | 부분 완료 | 2026-03-29 홈 HTML 실측은 했지만 page type별 export는 아직 없음 |");
  lines.push("| GTM/GA4 UI 직접 수정 및 publish | 미완료 | Codex 권한 범위 밖 |");
  lines.push("");

  lines.push("## 1) 10초 요약");
  lines.push("");
  lines.push(...list(plan.tenSecondSummary));
  lines.push("");

  lines.push("## 2) 역할 분담 기준");
  lines.push("");
  lines.push("### GPT 역할");
  lines.push(...list(plan.roleSplit.gpt));
  lines.push("");
  lines.push("### Codex 역할");
  lines.push(...list(plan.roleSplit.codex));
  lines.push("");
  lines.push("### 사용자 역할");
  lines.push(...list(plan.roleSplit.user));
  lines.push("");

  lines.push("## 3) 최신 확정 상태");
  lines.push("");
  for (const item of plan.latestStatus) {
    lines.push(`- [${item.type === "fact" ? "사실" : "추론"}] ${item.label}: ${item.detail}`);
  }
  lines.push("");

  lines.push("## 4) 매출 정합성 체크 실행안");
  lines.push("");
  lines.push("### 왜 지금 즉시 스모크 테스트는 가능한가");
  lines.push(...list(plan.revenueIntegrityCheck.smokeNow));
  lines.push("");
  lines.push("### 왜 운영 판단용 신뢰 구간은 3~7일인가");
  lines.push(...list(plan.revenueIntegrityCheck.trustWindow));
  lines.push("");
  lines.push("### GA4 데이터와 주문 DB 비교 기준");
  lines.push(...list(plan.revenueIntegrityCheck.comparisonStandard));
  lines.push("");
  lines.push("### 일반 구매 / NPay / 가상계좌 분리 기준");
  lines.push(...list(plan.revenueIntegrityCheck.splitPolicy));
  lines.push("");
  lines.push("### 최소 pseudo-SQL");
  lines.push("```sql");
  lines.push(...plan.revenueIntegrityCheck.pseudoSql);
  lines.push("```");
  lines.push("");

  lines.push("## 5) 과거 데이터 소급 가능성 평가");
  lines.push("");
  lines.push("### GA4 UI 과거 데이터 수정 가능 여부");
  lines.push(...list(plan.historicalBackfill.ga4Ui));
  lines.push("");
  lines.push("### Measurement Protocol 72시간 범위");
  lines.push(...list(plan.historicalBackfill.measurementProtocol));
  lines.push("");
  lines.push("### 왜 cutover 전/후 분리 해석이 맞는가");
  lines.push(...list(plan.historicalBackfill.reportingPolicy));
  lines.push("");
  lines.push("### DB/BI 대안");
  lines.push(...list(plan.historicalBackfill.biAlternative));
  lines.push("");
  lines.push("### 공식 근거");
  lines.push(...list(plan.historicalBackfill.sources));
  lines.push("");

  lines.push("## 6) 가상계좌 A안 구체화");
  lines.push("");
  lines.push("### 정책");
  lines.push(...list(plan.virtualAccountPlan.policy));
  lines.push("");
  lines.push("### GTM으로 가능한 부분");
  lines.push(...list(plan.virtualAccountPlan.gtmPossible));
  lines.push("");
  lines.push("### GTM만으로 어려운 부분");
  lines.push(...list(plan.virtualAccountPlan.gtmHard));
  lines.push("");
  lines.push("### backend / DB / admin 상태 신호");
  lines.push(...list(plan.virtualAccountPlan.backendDbNeeds));
  lines.push("");
  lines.push("### 필요한 상태값 예시");
  lines.push(...list(plan.virtualAccountPlan.statuses));
  lines.push("");
  lines.push("### 추천 구현 순서");
  lines.push(...list(plan.virtualAccountPlan.recommendedOrder));
  lines.push("");

  lines.push("## 7) refund / cancel 설계");
  lines.push("");
  lines.push("### 어떤 상황에 refund를 쏘는가");
  lines.push(...list(plan.refundCancelDesign.refundWhen));
  lines.push("");
  lines.push("### transaction_id 사용 방식");
  lines.push(...list(plan.refundCancelDesign.transactionIdRule));
  lines.push("");
  lines.push("### 가상계좌 미입금 취소를 어떻게 볼 것인가");
  lines.push(...list(plan.refundCancelDesign.nonDepositDecision));
  lines.push("");
  lines.push("### 광고 / ROAS 영향");
  lines.push(...list(plan.refundCancelDesign.roasImpact));
  lines.push("");
  lines.push("### DB reconciliation 영향");
  lines.push(...list(plan.refundCancelDesign.reconciliationImpact));
  lines.push("");
  lines.push("### 공식 근거");
  lines.push(...list(plan.refundCancelDesign.sources));
  lines.push("");

  lines.push("## 8) 아임웹 코드 이관안");
  lines.push("");
  lines.push("### 먼저 확정해야 하는 버전 충돌");
  lines.push(...list(plan.imwebMigration.versionConflict));
  lines.push("");
  lines.push("### 2026-03-29 홈 HTML 실측");
  lines.push(...list(plan.imwebMigration.liveHtmlToday));
  lines.push("");
  lines.push("### direct gtag G-8이 있었다는 버전");
  lines.push(...list(plan.imwebMigration.versionWithDirectG8));
  lines.push("");
  lines.push("### direct gtag G-8이 현재 홈 실측에서 안 보이는 버전");
  lines.push(...list(plan.imwebMigration.versionWithoutDirectG8));
  lines.push("");
  lines.push("### direct gtag 제거 전제 조건");
  lines.push(...list(plan.imwebMigration.preconditions));
  lines.push("");
  lines.push("### footer gtag 의존 로직 이관안");
  lines.push(...list(plan.imwebMigration.migrateFooterLogic));
  lines.push("");
  lines.push("### 지금 즉시 제거 가능한 것");
  lines.push(...list(plan.imwebMigration.removableNow));
  lines.push("");
  lines.push("### 지금은 건드리면 안 되는 것");
  lines.push(...list(plan.imwebMigration.doNotTouchYet));
  lines.push("");
  lines.push("### 최종 목표 구조");
  lines.push(...list(plan.imwebMigration.targetArchitecture));
  lines.push("");

  lines.push("## 9) 필수자료 / 참고자료");
  lines.push("");
  lines.push("### 필수자료");
  lines.push(...list(plan.materials.required));
  lines.push("");
  lines.push("### 참고자료");
  lines.push(...list(plan.materials.reference));
  lines.push("");

  lines.push("## 10) Day 0 / Day 1 / Day 3 실행 순서");
  lines.push("");
  for (const phase of plan.rollout) {
    lines.push(`### ${phase.day} — ${phase.purpose}`);
    lines.push(...list(phase.actions));
    lines.push("");
  }

  lines.push("## 11) 최종 리스크");
  lines.push("");
  for (const risk of plan.risks) {
    lines.push(`- [${risk.type === "fact" ? "사실" : "추론"}] ${risk.item}`);
  }
  lines.push("");

  lines.push("## 이번 턴에 직접 못한 것");
  lines.push("");
  lines.push(...list(plan.unresolvedConstraints));
  lines.push("");

  lines.push("## 검증");
  lines.push("");
  lines.push("- `npm run typecheck`");
  lines.push("- `npx tsx --test tests/*.test.ts`");
  lines.push("- `npx tsx scripts/ga4-revenue-ops-plan.ts --format md`");
  lines.push("- `curl http://localhost:7020/api/ga4/revenue-ops-plan`");
  lines.push("");

  return lines.join("\n");
};

const main = async () => {
  const format = resolveArg("--format") ?? "json";
  const outputPath = resolveArg("--output");
  const plan = getGa4RevenueOpsPlan();
  const output = format === "md" ? toMarkdown() : JSON.stringify(plan, null, 2);

  if (outputPath) {
    const resolved = path.resolve(process.cwd(), outputPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, output, "utf8");
    // eslint-disable-next-line no-console
    console.log(`Wrote ${format} to ${resolved}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(output);
};

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
