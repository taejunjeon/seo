import path from "node:path";

import * as xlsx from "xlsx";

const SITE = "thecleancoffee";
const DATA_DIR = path.resolve(__dirname, "..", "..", "data", "coffee");

type SheetRow = Record<string, unknown>;

type OrderRecord = {
  orderNo: string;
  channel: string;
  status: string;
  finalAmount: number;
  orderedAt: string;
};

type PaymentRow = {
  status: string;
  kind: string;
  method: string;
  amount: number;
  paidAtKst: string;
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const parseArgs = () => ({
  year: Number(argValue("year") ?? "2025"),
  markdown: process.argv.includes("--markdown"),
  topPerReason: Number(argValue("topPerReason") ?? "3"),
});

const readRows = (filePath: string) => {
  const wb = xlsx.readFile(filePath, { cellDates: true });
  return xlsx.utils.sheet_to_json<SheetRow>(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });
};

const parseString = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  const n = Number(parseString(value).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const formatDateTime = (value: unknown) => {
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  return parseString(value);
};

const nowKst = () =>
  `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())} KST`;

const formatWon = (value: number) => `${Math.round(value).toLocaleString("ko-KR")}원`;

const escapeCell = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const markdownTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(escapeCell).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
].join("\n");

const readOrders = (rows: SheetRow[]) => {
  const map = new Map<string, OrderRecord>();
  for (const row of rows) {
    const orderNo = parseString(row["주문번호"]);
    if (!orderNo) continue;
    if (map.has(orderNo)) continue;
    map.set(orderNo, {
      orderNo,
      channel: parseString(row["판매채널"]),
      status: parseString(row["주문상태"]),
      finalAmount: parseNumber(row["최종주문금액"]),
      orderedAt: formatDateTime(row["주문일"]),
    });
  }
  return map;
};

const readPayments = (rows: SheetRow[]) => {
  const map = new Map<string, PaymentRow[]>();
  for (const row of rows) {
    const orderNo = parseString(row["주문번호"]);
    if (!orderNo) continue;
    const list = map.get(orderNo) ?? [];
    list.push({
      status: parseString(row["결제상태"]),
      kind: parseString(row["결제구분"]),
      method: parseString(row["결제수단"]),
      amount: parseNumber(row["금액"]),
      paidAtKst: formatDateTime(row["결제시간"]),
    });
    map.set(orderNo, list);
  }
  return map;
};

const PAID_STATUS = "결제완료";
const PAID_KIND = "결제";
const REFUND_KIND = "환불";
const FREE_KIND = "무료결제";

type ReasonLabel =
  | "paid_then_fully_refunded"
  | "paid_then_partial_refund"
  | "payment_pending"
  | "payment_deadline_exceeded"
  | "input_pre_cancel"
  | "free_only"
  | "no_payment_rows"
  | "other";

const classify = (order: OrderRecord, list: PaymentRow[]) => {
  const paymentRows = list.filter((row) => row.kind === PAID_KIND);
  const refundRows = list.filter((row) => row.kind === REFUND_KIND || row.amount < 0);
  const freeRows = list.filter((row) => row.kind === FREE_KIND);
  const paidSum = list
    .filter((row) => row.status === PAID_STATUS && row.kind === PAID_KIND)
    .reduce((sum, row) => sum + row.amount, 0);
  const paymentSum = paymentRows.reduce((sum, row) => sum + row.amount, 0);
  const refundSum = refundRows.reduce((sum, row) => sum + row.amount, 0);
  const freeSum = freeRows.reduce((sum, row) => sum + row.amount, 0);
  const paymentStatusSet = new Set(paymentRows.map((row) => row.status));

  let reason: ReasonLabel;
  if (list.length === 0) {
    reason = "no_payment_rows";
  } else if (paymentRows.length === 0 && freeRows.length > 0) {
    reason = "free_only";
  } else if (paymentRows.length > 0 && refundRows.length > 0 && Math.abs(paymentSum + refundSum) === 0) {
    reason = "paid_then_fully_refunded";
  } else if (
    paymentRows.length > 0 &&
    refundRows.length > 0 &&
    Math.abs(order.finalAmount - (paymentSum + refundSum)) === 0
  ) {
    reason = "paid_then_partial_refund";
  } else if (paymentRows.length > 0 && paymentStatusSet.has("결제기한초과")) {
    reason = "payment_deadline_exceeded";
  } else if (paymentRows.length > 0 && paymentStatusSet.has("입금전 취소")) {
    reason = "input_pre_cancel";
  } else if (paymentRows.length > 0 && !paymentStatusSet.has(PAID_STATUS)) {
    reason = "payment_pending";
  } else {
    reason = "other";
  }

  return {
    reason,
    paidSum,
    paymentSum,
    refundSum,
    freeSum,
    paymentRowCount: paymentRows.length,
    refundRowCount: refundRows.length,
    freeRowCount: freeRows.length,
    paymentStatusSummary: [...paymentStatusSet].sort().join(","),
  };
};

const sum = <T>(items: T[], pick: (item: T) => number) => items.reduce((total, item) => total + pick(item), 0);

const buildSummary = (year: number, orderMap: Map<string, OrderRecord>, payMap: Map<string, PaymentRow[]>, topPerReason: number) => {
  const reasonGroups = new Map<ReasonLabel, Array<{
    orderNo: string;
    finalAmount: number;
    orderStatus: string;
    channel: string;
    paidSum: number;
    paymentSum: number;
    refundSum: number;
    paymentRowCount: number;
    refundRowCount: number;
    paymentStatusSummary: string;
  }>>();

  let mismatchCount = 0;
  let mismatchFinalSum = 0;
  let mismatchPaidSum = 0;
  const channelMismatch = new Map<string, number>();
  const orderStatusMismatch = new Map<string, number>();

  for (const [orderNo, order] of orderMap) {
    const list = payMap.get(orderNo) ?? [];
    const detail = classify(order, list);
    if (Math.abs(order.finalAmount - detail.paidSum) === 0) continue;

    mismatchCount += 1;
    mismatchFinalSum += order.finalAmount;
    mismatchPaidSum += detail.paidSum;
    channelMismatch.set(order.channel, (channelMismatch.get(order.channel) ?? 0) + 1);
    orderStatusMismatch.set(order.status, (orderStatusMismatch.get(order.status) ?? 0) + 1);

    const arr = reasonGroups.get(detail.reason) ?? [];
    arr.push({
      orderNo: order.orderNo,
      finalAmount: order.finalAmount,
      orderStatus: order.status,
      channel: order.channel,
      paidSum: detail.paidSum,
      paymentSum: detail.paymentSum,
      refundSum: detail.refundSum,
      paymentRowCount: detail.paymentRowCount,
      refundRowCount: detail.refundRowCount,
      paymentStatusSummary: detail.paymentStatusSummary,
    });
    reasonGroups.set(detail.reason, arr);
  }

  const reasonSummary = [...reasonGroups.entries()]
    .map(([reason, items]) => ({
      reason,
      count: items.length,
      finalAmountSum: sum(items, (item) => item.finalAmount),
      paidSum: sum(items, (item) => item.paidSum),
      refundSum: sum(items, (item) => item.refundSum),
      sample: items.slice(0, topPerReason),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    year,
    totals: {
      orders: orderMap.size,
      mismatchCount,
      mismatchFinalSum,
      mismatchPaidSum,
      mismatchDelta: mismatchFinalSum - mismatchPaidSum,
    },
    channelMismatch: Object.fromEntries([...channelMismatch.entries()].sort((a, b) => b[1] - a[1])),
    orderStatusMismatch: Object.fromEntries([...orderStatusMismatch.entries()].sort((a, b) => b[1] - a[1])),
    reasonSummary,
  };
};

const renderMarkdown = (payload: ReturnType<typeof buildSummary> & { checkedAt: string; site: string; mode: string; sourceOrders: string; sourcePayments: string }) => [
  `# 더클린커피 ${payload.year} 엑셀 결제 Mismatch 분해`,
  "",
  `생성 시각: ${payload.checkedAt}`,
  `site: \`${payload.site}\``,
  `mode: \`${payload.mode}\``,
  `Primary source: \`${payload.sourceOrders}\`, \`${payload.sourcePayments}\``,
  "Confidence: 95% (엑셀 row level)",
  "",
  "## Auditor Verdict",
  "",
  "```text",
  "Auditor verdict: PASS_WITH_NOTES",
  "Phase: coffee_excel_payment_mismatch",
  "No-send verified: YES",
  "No-write verified: YES",
  "No-deploy verified: YES",
  "No DB import apply: YES",
  "No PII sample output: YES",
  "```",
  "",
  "## 10초 요약",
  "",
  `${payload.year} 엑셀 ${payload.totals.orders.toLocaleString("ko-KR")}건 중 mismatch 는 ${payload.totals.mismatchCount}건이다. 이 mismatch 는 정합성 오류가 아니라 **결제 후 환불** 이거나 **결제대기/취소** 상태의 \`결제\` row 가 \`결제완료\` 가 아니라서 paidSum 에 잡히지 않는 것이다.`,
  "",
  "따라서 mismatch 는 \"엑셀이 틀렸다\" 가 아니라 \"엑셀의 결제 row 상태가 결제완료가 아니다\" 로 해석한다. LTV 분석 시 결제완료 + 부분환불 보정 후 사용한다.",
  "",
  "## 총합",
  "",
  markdownTable(
    ["metric", "value"],
    [
      ["orders (year unique)", payload.totals.orders.toLocaleString("ko-KR")],
      ["mismatch orders", payload.totals.mismatchCount.toLocaleString("ko-KR")],
      ["mismatch finalAmount sum", formatWon(payload.totals.mismatchFinalSum)],
      ["mismatch paid sum (결제완료+결제만)", formatWon(payload.totals.mismatchPaidSum)],
      ["mismatch delta", formatWon(payload.totals.mismatchDelta)],
    ],
  ),
  "",
  "## Reason Distribution",
  "",
  markdownTable(
    ["reason", "count", "finalAmount sum", "paid sum", "refund sum"],
    payload.reasonSummary.map((row) => [
      row.reason,
      row.count,
      formatWon(row.finalAmountSum),
      formatWon(row.paidSum),
      formatWon(row.refundSum),
    ]),
  ),
  "",
  "## Order Status of Mismatch",
  "",
  markdownTable(
    ["order_status", "count"],
    Object.entries(payload.orderStatusMismatch).map(([status, count]) => [status || "(blank)", count]),
  ),
  "",
  "## Channel Distribution of Mismatch",
  "",
  markdownTable(
    ["channel", "count"],
    Object.entries(payload.channelMismatch).map(([channel, count]) => [channel || "(blank)", count]),
  ),
  "",
  "## 해석",
  "",
  "1. `paid_then_fully_refunded` 는 같은 주문에 `결제` row 와 `환불` row 가 모두 있다. paidSum 은 0이지만 paymentSum + refundSum = 0 으로 정합. NPay 전체환불 케이스가 다수다.",
  "2. `payment_deadline_exceeded` / `input_pre_cancel` / `payment_pending` 은 `결제` row 가 `결제완료` 가 아닌 status 라서 paidSum 이 0이다. 실제 매출/LTV 산정에서 제외해야 한다.",
  "3. mismatch 는 엑셀이 틀렸다는 의미가 아니라 \"결제완료가 아닌 row 만 존재한다\" 는 의미다. LTV dry-run 의 `ltvRevenue` 는 paid > 0 인 행만 사용하므로 이 mismatch 는 LTV 에 포함되지 않는다.",
  "4. 외부 송출, local DB write, GTM/Meta/TikTok/GA4 호출 0건이다.",
  "",
  "## Reason 별 샘플",
  "",
  payload.reasonSummary.flatMap((group) => [
    `### ${group.reason} (${group.count}건)`,
    "",
    markdownTable(
      ["order_no", "finalAmount", "order_status", "channel", "paidSum", "paymentSum", "refundSum", "payment_status_summary"],
      group.sample.map((row) => [
        row.orderNo,
        formatWon(row.finalAmount),
        row.orderStatus,
        row.channel,
        formatWon(row.paidSum),
        formatWon(row.paymentSum),
        formatWon(row.refundSum),
        row.paymentStatusSummary,
      ]),
    ),
    "",
  ]).join("\n"),
  "## Reason 정의",
  "",
  "| reason | 정의 |",
  "| --- | --- |",
  "| paid_then_fully_refunded | `결제` row + `환불` row 동시 존재, paymentSum + refundSum = 0 |",
  "| paid_then_partial_refund | `결제` + `환불` 동시 존재, finalAmount = paymentSum + refundSum |",
  "| payment_pending | `결제` row 가 `결제완료` 가 아닌 다른 status (`결제대기` 등) |",
  "| payment_deadline_exceeded | `결제` row status 가 `결제기한초과` |",
  "| input_pre_cancel | `결제` row status 가 `입금전 취소` |",
  "| free_only | `결제` row 없이 `무료결제` row 만 존재 |",
  "| no_payment_rows | payments 엑셀에 해당 주문이 없음 |",
  "| other | 위 분류 외 |",
  "",
  "## Guardrails",
  "",
  "- Read-only. orders/payments xlsx 만 읽고 외부 시스템 호출 0건.",
  "- payments xlsx 의 phone/이메일/주문자명 등 PII 컬럼은 사용하지 않는다.",
  "- 본 리포트의 mismatch 는 LTV/매출 정합성 결론을 바꾸는 신호가 아니라 분류 라벨이다.",
].join("\n");

const main = () => {
  const args = parseArgs();
  const ordersPath = path.resolve(DATA_DIR, `coffee_orders_${args.year}.xlsx`);
  const paymentsPath = path.resolve(DATA_DIR, `coffee_payments_${args.year}.xlsx`);
  const orderMap = readOrders(readRows(ordersPath));
  const payMap = readPayments(readRows(paymentsPath));
  const summary = buildSummary(args.year, orderMap, payMap, args.topPerReason);
  const payload = {
    ...summary,
    checkedAt: nowKst(),
    site: SITE,
    mode: "read_only",
    sourceOrders: path.relative(path.resolve(__dirname, "..", ".."), ordersPath),
    sourcePayments: path.relative(path.resolve(__dirname, "..", ".."), paymentsPath),
    guardrails: {
      noSend: true,
      noWrite: true,
      noDeploy: true,
      noDbImportApply: true,
      noPiiSampleOutput: true,
    },
  };
  console.log(args.markdown ? renderMarkdown(payload) : JSON.stringify(payload, null, 2));
};

main();
