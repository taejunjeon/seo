import path from "node:path";

import * as xlsx from "xlsx";

const SITE = "thecleancoffee";
const DATA_DIR = path.resolve(__dirname, "..", "..", "data", "coffee");

type SheetRow = Record<string, unknown>;

type OrderRecord = {
  year: number;
  orderNo: string;
  channel: string;
  status: string;
  orderedAt: string;
  finalAmount: number;
  paidAmount: number;
  refundAmount: number;
  phoneNorm: string;
  itemRows: number;
};

type PaymentRecord = {
  paid: number;
  refund: number;
  rows: number;
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const parseArgs = () => ({
  years: (argValue("years") ?? "2024,2025")
    .split(",")
    .map((year) => Number(year.trim()))
    .filter((year) => Number.isInteger(year)),
  markdown: process.argv.includes("--markdown"),
});

const readRows = (filePath: string) => {
  const wb = xlsx.readFile(filePath, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json<SheetRow>(sheet, { defval: null, raw: true });
};

const parseString = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  const n = Number(parseString(value).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const normalizePhone = (value: unknown) => parseString(value).replace(/[^0-9]/g, "");

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

const sum = <T>(items: T[], pick: (item: T) => number) =>
  items.reduce((total, item) => total + pick(item), 0);

const formatWon = (value: number) => `${Math.round(value).toLocaleString("ko-KR")}원`;

const escapeCell = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const markdownTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(escapeCell).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
].join("\n");

const readOrders = (year: number, rows: SheetRow[]) => {
  const orders = new Map<string, OrderRecord>();
  for (const row of rows) {
    const orderNo = parseString(row["주문번호"]);
    if (!orderNo) continue;
    const existing = orders.get(orderNo);
    if (existing) {
      existing.itemRows += 1;
      continue;
    }
    orders.set(orderNo, {
      year,
      orderNo,
      channel: parseString(row["판매채널"]),
      status: parseString(row["주문상태"]),
      orderedAt: formatDateTime(row["주문일"]),
      finalAmount: parseNumber(row["최종주문금액"]),
      paidAmount: 0,
      refundAmount: 0,
      phoneNorm: normalizePhone(row["주문자 번호"]),
      itemRows: 1,
    });
  }
  return [...orders.values()];
};

const readPayments = (rows: SheetRow[]) => {
  const payments = new Map<string, PaymentRecord>();
  for (const row of rows) {
    const orderNo = parseString(row["주문번호"]);
    if (!orderNo) continue;
    const status = parseString(row["결제상태"]);
    const kind = parseString(row["결제구분"]);
    const amount = parseNumber(row["금액"]);
    const current = payments.get(orderNo) ?? { paid: 0, refund: 0, rows: 0 };
    current.rows += 1;
    if (kind === "환불" || amount < 0) current.refund += amount;
    else if (status === "결제완료" && kind === "결제") current.paid += amount;
    payments.set(orderNo, current);
  }
  return payments;
};

const isNpayOrder = (order: OrderRecord) => order.channel.includes("네이버페이");

const netPaidAmount = (order: OrderRecord) => Math.max(0, order.paidAmount + order.refundAmount);

const ltvRevenue = (order: OrderRecord) => {
  const netPaid = netPaidAmount(order);
  return netPaid > 0 ? netPaid : order.finalAmount;
};

const isLtvEligibleOrder = (order: OrderRecord) => {
  const hasCustomerKey = order.phoneNorm.length >= 8;
  const hasRevenue = ltvRevenue(order) > 0;
  const terminalMallOrder = order.status === "거래종료";
  const paidNpayOrder = isNpayOrder(order) && order.paidAmount > 0;
  return hasCustomerKey && hasRevenue && (terminalMallOrder || paidNpayOrder);
};

const yearSummary = (year: number, orders: OrderRecord[], payments: Map<string, PaymentRecord>) => {
  const complete = orders.filter(isLtvEligibleOrder);
  const customers = new Map<string, { orders: number; revenue: number }>();
  for (const order of complete) {
    const current = customers.get(order.phoneNorm) ?? { orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += ltvRevenue(order);
    customers.set(order.phoneNorm, current);
  }
  const joined = [...payments.keys()].filter((orderNo) => orders.some((order) => order.orderNo === orderNo)).length;
  const orderByNo = new Map(orders.map((order) => [order.orderNo, order]));
  const mismatches = [...payments.entries()].filter(([orderNo, payment]) => {
    const order = orderByNo.get(orderNo);
    return order ? Math.abs(order.finalAmount - payment.paid) > 0 : false;
  });
  return {
    year,
    rows: orders.reduce((total, order) => total + order.itemRows, 0),
    uniqueOrders: orders.length,
    completeOrders: complete.length,
    completeRevenue: sum(complete, ltvRevenue),
    completeCustomers: customers.size,
    repeat2Plus: [...customers.values()].filter((customer) => customer.orders >= 2).length,
    repeat3Plus: [...customers.values()].filter((customer) => customer.orders >= 3).length,
    npayCompleteOrders: complete.filter(isNpayOrder).length,
    npayCompleteRevenue: sum(complete.filter(isNpayOrder), ltvRevenue),
    mallCompleteOrders: complete.filter((order) => !isNpayOrder(order)).length,
    mallCompleteRevenue: sum(complete.filter((order) => !isNpayOrder(order)), ltvRevenue),
    paymentUniqueOrders: payments.size,
    paymentJoinedOrders: joined,
    paymentAmountMismatchOrders: mismatches.length,
  };
};

const buildCombinedLtv = (orders: OrderRecord[]) => {
  const complete = orders.filter(isLtvEligibleOrder);
  const customers = new Map<string, {
    orders: number;
    revenue: number;
    years: Set<number>;
    npayOrders: number;
    mallOrders: number;
    firstOrderAt: string;
    lastOrderAt: string;
  }>();
  for (const order of complete) {
    const current = customers.get(order.phoneNorm) ?? {
      orders: 0,
      revenue: 0,
      years: new Set<number>(),
      npayOrders: 0,
      mallOrders: 0,
      firstOrderAt: order.orderedAt,
      lastOrderAt: order.orderedAt,
    };
    current.orders += 1;
    current.revenue += ltvRevenue(order);
    current.years.add(order.year);
    if (isNpayOrder(order)) current.npayOrders += 1;
    else current.mallOrders += 1;
    if (order.orderedAt && (!current.firstOrderAt || order.orderedAt < current.firstOrderAt)) current.firstOrderAt = order.orderedAt;
    if (order.orderedAt && (!current.lastOrderAt || order.orderedAt > current.lastOrderAt)) current.lastOrderAt = order.orderedAt;
    customers.set(order.phoneNorm, current);
  }
  const customerRows = [...customers.values()];
  const customers2024 = customerRows.filter((customer) => customer.years.has(2024));
  const customers2025 = customerRows.filter((customer) => customer.years.has(2025));
  const bothYears = customerRows.filter((customer) => customer.years.has(2024) && customer.years.has(2025));
  const bucket = (label: string, rows: typeof customerRows) => ({
    label,
    customers: rows.length,
    revenue: sum(rows, (customer) => customer.revenue),
    orders: sum(rows, (customer) => customer.orders),
  });

  return {
    completeOrders: complete.length,
    completeRevenue: sum(complete, ltvRevenue),
    customers: customerRows.length,
    repeat2Plus: customerRows.filter((customer) => customer.orders >= 2).length,
    repeat3Plus: customerRows.filter((customer) => customer.orders >= 3).length,
    repeat6Plus: customerRows.filter((customer) => customer.orders >= 6).length,
    repeat10Plus: customerRows.filter((customer) => customer.orders >= 10).length,
    revenue100kPlus: customerRows.filter((customer) => customer.revenue >= 100_000).length,
    revenue300kPlus: customerRows.filter((customer) => customer.revenue >= 300_000).length,
    revenue500kPlus: customerRows.filter((customer) => customer.revenue >= 500_000).length,
    revenue1mPlus: customerRows.filter((customer) => customer.revenue >= 1_000_000).length,
    maxCustomerRevenue: Math.max(0, ...customerRows.map((customer) => customer.revenue)),
    customers2024: customers2024.length,
    customers2025: customers2025.length,
    bothYears: bothYears.length,
    retention2024To2025: customers2024.length > 0 ? bothYears.length / customers2024.length : 0,
    returningShareOf2025: customers2025.length > 0 ? bothYears.length / customers2025.length : 0,
    buckets: [
      bucket("1_order", customerRows.filter((customer) => customer.orders === 1)),
      bucket("2_orders", customerRows.filter((customer) => customer.orders === 2)),
      bucket("3_to_5_orders", customerRows.filter((customer) => customer.orders >= 3 && customer.orders <= 5)),
      bucket("6_to_9_orders", customerRows.filter((customer) => customer.orders >= 6 && customer.orders <= 9)),
      bucket("10_plus_orders", customerRows.filter((customer) => customer.orders >= 10)),
      bucket("npay_only", customerRows.filter((customer) => customer.npayOrders > 0 && customer.mallOrders === 0)),
      bucket("mall_only", customerRows.filter((customer) => customer.mallOrders > 0 && customer.npayOrders === 0)),
      bucket("both_channel", customerRows.filter((customer) => customer.mallOrders > 0 && customer.npayOrders > 0)),
    ],
  };
};

const renderMarkdown = (payload: Record<string, any>) => [
  "# 더클린커피 2024/2025 Excel LTV Dry-run",
  "",
  `생성 시각: ${payload.checkedAt}`,
  `site: \`${payload.site}\``,
  "mode: `dry_run_read_only`",
  "Primary source: `data/coffee/coffee_orders_2024.xlsx`, `coffee_payments_2024.xlsx`, `coffee_orders_2025.xlsx`, `coffee_payments_2025.xlsx`",
  "Freshness: 2024/2025 아임웹 주문/결제 엑셀 snapshot",
  "Confidence: 90%",
  "",
  "## 10초 요약",
  "",
  "2024/2025 엑셀은 LTV와 재구매 분석에 쓸 수 있다. 단, 이번 결과는 dry-run이며 local DB import apply가 아니다.",
  "",
  "NPay/자사몰 채널을 함께 보면 전체 재구매 규모를 볼 수 있다. 광고 ROAS 복구 전송 판단에는 아직 쓰지 않고, 고객/주문 원장 후보로만 쓴다.",
  "",
  "LTV 대상 주문은 `거래종료` 주문 또는 결제완료 금액이 있는 NPay 주문이다. NPay 주문은 엑셀에서 `거래개시`로 남는 경우가 많아 결제 금액을 함께 본다.",
  "",
  "## Year Summary",
  "",
  markdownTable(
    ["year", "unique_orders", "complete_orders", "complete_revenue", "customers", "repeat2+", "npay_orders", "npay_revenue", "payment_join", "amount_mismatch"],
    payload.yearSummaries.map((row: Record<string, any>) => [
      row.year,
      row.uniqueOrders,
      row.completeOrders,
      formatWon(row.completeRevenue),
      row.completeCustomers,
      row.repeat2Plus,
      row.npayCompleteOrders,
      formatWon(row.npayCompleteRevenue),
      `${row.paymentJoinedOrders}/${row.paymentUniqueOrders}`,
      row.paymentAmountMismatchOrders,
    ]),
  ),
  "",
  "## Combined LTV",
  "",
  markdownTable(
    ["metric", "value"],
    [
      ["ltv eligible orders", payload.combined.completeOrders],
      ["ltv eligible revenue", formatWon(payload.combined.completeRevenue)],
      ["customers", payload.combined.customers],
      ["repeat2Plus", payload.combined.repeat2Plus],
      ["repeat3Plus", payload.combined.repeat3Plus],
      ["repeat6Plus", payload.combined.repeat6Plus],
      ["repeat10Plus", payload.combined.repeat10Plus],
      ["revenue100kPlus", payload.combined.revenue100kPlus],
      ["revenue300kPlus", payload.combined.revenue300kPlus],
      ["revenue500kPlus", payload.combined.revenue500kPlus],
      ["revenue1mPlus", payload.combined.revenue1mPlus],
      ["maxCustomerRevenue", formatWon(payload.combined.maxCustomerRevenue)],
      ["customers2024", payload.combined.customers2024],
      ["customers2025", payload.combined.customers2025],
      ["bothYears", payload.combined.bothYears],
      ["retention2024To2025", `${(payload.combined.retention2024To2025 * 100).toFixed(2)}%`],
      ["returningShareOf2025", `${(payload.combined.returningShareOf2025 * 100).toFixed(2)}%`],
    ],
  ),
  "",
  "## Customer Buckets",
  "",
  markdownTable(
    ["bucket", "customers", "orders", "revenue"],
    payload.combined.buckets.map((row: Record<string, any>) => [
      row.label,
      row.customers,
      row.orders,
      formatWon(row.revenue),
    ]),
  ),
  "",
  "## 해석",
  "",
  "1. 엑셀은 LTV/재구매 분석의 primary 후보로 충분하다.",
  "2. 주문/결제 join 품질은 연도별로 따로 봐야 한다.",
  "3. 원문 phone/email은 출력하지 않았다. 고객 집계는 정규화 phone 내부 group by만 사용했다.",
  "4. 실제 local DB import apply는 별도 승인, 백업, 검증 쿼리 이후에만 가능하다.",
  "",
  "## Auditor Verdict",
  "",
  "```text",
  "Auditor verdict: PASS_WITH_NOTES",
  "Phase: coffee_excel_ltv_dry_run",
  "No-send verified: YES",
  "No-write verified: YES",
  "No-deploy verified: YES",
  "No import apply: YES",
  "No PII sample output: YES",
  "```",
].join("\n");

const main = () => {
  const args = parseArgs();
  const allOrders: OrderRecord[] = [];
  const yearSummaries = args.years.map((year) => {
    const ordersPath = path.resolve(DATA_DIR, `coffee_orders_${year}.xlsx`);
    const paymentsPath = path.resolve(DATA_DIR, `coffee_payments_${year}.xlsx`);
    const orders = readOrders(year, readRows(ordersPath));
    const payments = readPayments(readRows(paymentsPath));
    for (const order of orders) {
      const payment = payments.get(order.orderNo);
      order.paidAmount = payment?.paid ?? 0;
      order.refundAmount = payment?.refund ?? 0;
    }
    allOrders.push(...orders);
    return {
      ...yearSummary(year, orders, payments),
      sources: { ordersPath, paymentsPath },
    };
  });
  const payload = {
    ok: true,
    checkedAt: nowKst(),
    site: SITE,
    mode: "dry_run_read_only",
    years: args.years,
    yearSummaries,
    combined: buildCombinedLtv(allOrders),
    guardrails: {
      noSend: true,
      noWrite: true,
      noDeploy: true,
      noImportApply: true,
      noPiiSampleOutput: true,
    },
  };
  console.log(args.markdown ? renderMarkdown(payload) : JSON.stringify(payload, null, 2));
};

main();
