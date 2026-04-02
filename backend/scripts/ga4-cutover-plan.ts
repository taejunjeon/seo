import fs from "node:fs/promises";
import path from "node:path";

import { getGa4CutoverPlan } from "../src/ga4Cutover";

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
  const plan = getGa4CutoverPlan();
  const lines: string[] = [];

  lines.push("# GTM/GA4 실행 사양서");
  lines.push("");

  lines.push("## 10초 요약");
  lines.push("");
  lines.push(...list(plan.tenSecondSummary));
  lines.push("");

  lines.push("## 최신 확정 상태");
  lines.push("");
  for (const item of plan.latestStatus) {
    lines.push(`- [${item.type === "fact" ? "사실" : "추론"}] ${item.label}: ${item.detail}`);
  }
  lines.push("");

  lines.push("## 정본 구조 선언");
  lines.push("");
  lines.push(...list(plan.canonicalDeclaration));
  lines.push("");

  lines.push("## GTM 작업 사양서");
  lines.push("");
  lines.push("| 태그명 | 현재 상태 | 현재 목적지 | 바꿀 액션 | 이유 | 변경 후 기대 이벤트 | 검증 방법 |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const item of plan.gtmWorkSpec) {
    lines.push(
      `| ${escapeCell(item.tagName)} | ${escapeCell(item.currentState)} | ${escapeCell(
        item.currentDestination,
      )} | ${item.action} | ${escapeCell(item.reason)} | ${escapeCell(item.expectedEvent)} | ${escapeCell(
        item.validation.join(" / "),
      )} |`,
    );
  }
  lines.push("");

  lines.push("## page_view 중복 제거 실행안");
  lines.push("");
  lines.push(`- canonical page_view sender: ${plan.pageViewExecutionPlan.canonicalSender}`);
  lines.push("");
  lines.push("### GA4_픽셀2 pause 시점");
  lines.push(...list(plan.pageViewExecutionPlan.pauseGa4Pixel2When));
  lines.push("");
  lines.push("### [new]Google 태그 처리");
  lines.push(...list(plan.pageViewExecutionPlan.googleTagDecision));
  lines.push("");
  lines.push("### direct gtag G-8 제거 시점");
  lines.push(...list(plan.pageViewExecutionPlan.removeDirectGtagWhen));
  lines.push("");
  lines.push("### Preview 정상 판정");
  lines.push(...list(plan.pageViewExecutionPlan.previewHealthy));
  lines.push("");
  lines.push("### DebugView 정상 판정");
  lines.push(...list(plan.pageViewExecutionPlan.debugViewHealthy));
  lines.push("");

  lines.push("## purchase payload 정합성 사양");
  lines.push("");
  lines.push("| 필드명 | source 존재 여부 | 현재 실측 확인 상태 | 조치 |");
  lines.push("| --- | --- | --- | --- |");
  for (const item of plan.purchasePayloadSpec) {
    lines.push(
      `| ${item.fieldName} | ${escapeCell(item.sourceExists)} | ${escapeCell(
        item.measuredStatus,
      )} | ${escapeCell(item.action)} |`,
    );
  }
  lines.push("");

  lines.push("## items 검증/보강안");
  lines.push("");
  lines.push(`- source variable: ${plan.itemsValidationPlan.sourceVariable}`);
  lines.push("");
  lines.push("### expected items schema");
  lines.push(...list(plan.itemsValidationPlan.expectedSchema));
  lines.push("");
  lines.push("### Preview 확인");
  lines.push(...list(plan.itemsValidationPlan.previewChecks));
  lines.push("");
  lines.push("### dataLayer 확인");
  lines.push(...list(plan.itemsValidationPlan.dataLayerChecks));
  lines.push("");
  lines.push("### DebugView 확인");
  lines.push(...list(plan.itemsValidationPlan.debugViewChecks));
  lines.push("");
  lines.push("### items가 안 보일 수 있는 원인");
  lines.push(...list(plan.itemsValidationPlan.missingCauses));
  lines.push("");
  lines.push("### payload shape 보정안");
  lines.push(...list(plan.itemsValidationPlan.shapeFixes));
  lines.push("");

  lines.push("## HURDLERS core event 정본화 사양");
  lines.push("");
  lines.push(
    "| 이벤트 | 현재 sender | target sender | 현재 event name | target event name | 필요한 param | 관련 dataLayer/변수 | 검증 방법 |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const item of plan.hurdlersCanonicalSpec) {
    lines.push(
      `| ${escapeCell(item.eventLabel)} | ${escapeCell(item.currentSender)} | ${escapeCell(
        item.targetSender,
      )} | ${escapeCell(item.currentEventName)} | ${escapeCell(item.targetEventName)} | ${escapeCell(
        item.requiredParams.join(", "),
      )} | ${escapeCell(item.relatedVariables.join(" / "))} | ${escapeCell(
        item.validation.join(" / "),
      )} |`,
    );
  }
  lines.push("");

  lines.push("## add_payment_info 구현/정의안");
  lines.push("");
  lines.push("### 일반 결제");
  lines.push(...list(plan.addPaymentInfoSpec.generalDecision));
  lines.push("");
  lines.push("### NPay");
  lines.push(...list(plan.addPaymentInfoSpec.npayDecision));
  lines.push("");
  lines.push("### payment_type 표준값");
  lines.push(...list(plan.addPaymentInfoSpec.paymentTypeValues));
  lines.push("");
  lines.push("### purchase와 혼동되지 않게 하는 기준");
  lines.push(...list(plan.addPaymentInfoSpec.notPurchaseRule));
  lines.push("");
  lines.push("### DebugView 정상 예시");
  lines.push(...list(plan.addPaymentInfoSpec.debugViewExample));
  lines.push("");

  lines.push("## NPay 후속 검증안");
  lines.push("");
  lines.push("### 왜 현재 구조상 최종 완료를 W2에서 직접 보기 어려운지");
  lines.push(...list(plan.npayValidationPlan.hardReason));
  lines.push("");
  lines.push("### 지금 확보된 NPay 신호");
  lines.push(...list(plan.npayValidationPlan.currentSignals));
  lines.push("");
  lines.push("### 컷오버 후 다시 테스트할 시점");
  lines.push(...list(plan.npayValidationPlan.retestTiming));
  lines.push("");
  lines.push("### fired되어야 하는 태그");
  lines.push(...list(plan.npayValidationPlan.expectedFiredTags));
  lines.push("");
  lines.push("### DebugView에 보여야 하는 이벤트");
  lines.push(...list(plan.npayValidationPlan.expectedDebugView));
  lines.push("");
  lines.push("### 최종 완료 보완 방식");
  lines.push(...list(plan.npayValidationPlan.finalDbBackstop));
  lines.push("");

  lines.push("## 주문 DB reconciliation 초안");
  lines.push("");
  lines.push("### 필요한 테이블/컬럼 가정");
  lines.push(...list(plan.reconciliationPlan.tableAssumptions));
  lines.push("");
  lines.push("### 일반 구매 / NPay 분리");
  lines.push(...list(plan.reconciliationPlan.splitPolicy));
  lines.push("");
  lines.push("### 비교 포인트");
  lines.push(...list(plan.reconciliationPlan.comparisonPoints));
  lines.push("");
  lines.push("### pseudo-SQL");
  lines.push("```sql");
  lines.push(...plan.reconciliationPlan.pseudoSql);
  lines.push("```");
  lines.push("");

  lines.push("## 필수자료 / 참고자료");
  lines.push("");
  lines.push("### 필수자료");
  lines.push(...list(plan.materialRequests.required));
  lines.push("");
  lines.push("### 참고자료");
  lines.push(...list(plan.materialRequests.reference));
  lines.push("");

  lines.push("## Day 0 / Day 1 / Day 3 작업 순서");
  lines.push("");
  for (const phase of plan.rollout) {
    lines.push(`### ${phase.day} — ${phase.purpose}`);
    lines.push(...list(phase.actions));
    lines.push("");
  }

  lines.push("## 최종 리스크");
  lines.push("");
  for (const risk of plan.risks) {
    lines.push(`- [${risk.type === "fact" ? "사실" : "추론"}] ${risk.item}`);
  }
  lines.push("");
  lines.push("### 이번 턴에서 직접 못한 것");
  lines.push(...list(plan.unresolvedConstraints));
  lines.push("");

  return lines.join("\n");
};

const main = async () => {
  const format = resolveArg("--format") ?? "json";
  const outputPath = resolveArg("--output");
  const plan = getGa4CutoverPlan();
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
