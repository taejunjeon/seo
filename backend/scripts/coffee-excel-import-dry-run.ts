import path from "node:path";

import * as xlsx from "xlsx";

const SITE = "thecleancoffee";

type SheetRow = Record<string, unknown>;

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const parseArgs = () => ({
  ordersPath: path.resolve(argValue("orders") ?? path.resolve(__dirname, "..", "..", "data", "coffee", "coffee_orders_2025.xlsx")),
  paymentsPath: path.resolve(argValue("payments") ?? path.resolve(__dirname, "..", "..", "data", "coffee", "coffee_payments_2025.xlsx")),
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

const incGroup = (groups: Map<string, { rows: number; orders: Set<string>; amount: number }>, key: string, orderNo: string, amount: number) => {
  const group = groups.get(key) ?? { rows: 0, orders: new Set<string>(), amount: 0 };
  group.rows += 1;
  if (orderNo) group.orders.add(orderNo);
  group.amount += amount;
  groups.set(key, group);
};

const groupToRows = (groups: Map<string, { rows: number; orders: Set<string>; amount: number }>) =>
  [...groups.entries()]
    .map(([key, value]) => ({ key, rows: value.rows, orders: value.orders.size, amount: value.amount }))
    .sort((a, b) => b.amount - a.amount || b.orders - a.orders || a.key.localeCompare(b.key));

const sum = <T>(items: T[], pick: (item: T) => number) =>
  items.reduce((total, item) => total + pick(item), 0);

const uniq = <T>(items: T[]) => [...new Set(items)];

const buildOrderDryRun = (rows: SheetRow[]) => {
  const orders = new Map<string, {
    orderNo: string;
    channel: string;
    status: string;
    orderedAt: string;
    finalAmount: number;
    itemAmount: number;
    shipping: number;
    discount: number;
    points: number;
    phoneNorm: string;
    itemRows: number;
  }>();
  const channelGroups = new Map<string, { rows: number; orders: Set<string>; amount: number }>();
  const statusGroups = new Map<string, { rows: number; orders: Set<string>; amount: number }>();
  const productRows = new Map<string, { rows: number; qty: number; amount: number }>();

  for (const row of rows) {
    const orderNo = parseString(row["주문번호"]);
    if (!orderNo) continue;
    const channel = parseString(row["판매채널"]);
    const status = parseString(row["주문상태"]);
    const finalAmount = parseNumber(row["최종주문금액"]);
    const existing = orders.get(orderNo);
    if (existing) {
      existing.itemRows += 1;
    } else {
      orders.set(orderNo, {
        orderNo,
        channel,
        status,
        orderedAt: formatDateTime(row["주문일"]),
        finalAmount,
        itemAmount: parseNumber(row["총 품목합계금액"]),
        shipping: parseNumber(row["총 합계 배송비"]),
        discount: parseNumber(row["총 합계 할인금액"]),
        points: parseNumber(row["총 합계 포인트 사용액"]),
        phoneNorm: normalizePhone(row["주문자 번호"]),
        itemRows: 1,
      });
    }
    incGroup(channelGroups, channel || "(blank)", orderNo, existing ? 0 : finalAmount);
    incGroup(statusGroups, status || "(blank)", orderNo, existing ? 0 : finalAmount);

    const productName = parseString(row["상품명"]) || "(blank)";
    const product = productRows.get(productName) ?? { rows: 0, qty: 0, amount: 0 };
    product.rows += 1;
    product.qty += parseNumber(row["구매수량"]);
    product.amount += parseNumber(row["품목실결제가"]);
    productRows.set(productName, product);
  }

  const orderList = [...orders.values()];
  const completeMallOrders = orderList.filter((order) =>
    order.status === "거래종료" && order.channel.includes("더클린 커피") && order.phoneNorm,
  );
  const ltv = new Map<string, { orders: number; amount: number }>();
  for (const order of completeMallOrders) {
    const current = ltv.get(order.phoneNorm) ?? { orders: 0, amount: 0 };
    current.orders += 1;
    current.amount += order.finalAmount;
    ltv.set(order.phoneNorm, current);
  }
  const customers = [...ltv.values()];

  return {
    rows: rows.length,
    uniqueOrders: orders.size,
    firstOrderedAt: orderList.map((order) => order.orderedAt).filter(Boolean).sort()[0] ?? "",
    lastOrderedAt: orderList.map((order) => order.orderedAt).filter(Boolean).sort().at(-1) ?? "",
    uniquePhones: uniq(orderList.map((order) => order.phoneNorm).filter(Boolean)).length,
    maskedPhoneRows: orderList.filter((order) => order.phoneNorm.includes("*")).length,
    amountByUniqueOrder: sum(orderList, (order) => order.finalAmount),
    naverOrderChannelOrders: orderList.filter((order) => order.channel.includes("네이버페이")).length,
    naverOrderChannelAmount: sum(orderList.filter((order) => order.channel.includes("네이버페이")), (order) => order.finalAmount),
    channelSummary: groupToRows(channelGroups),
    statusSummary: groupToRows(statusGroups),
    topProducts: [...productRows.entries()]
      .map(([productName, value]) => ({ productName, ...value }))
      .sort((a, b) => b.amount - a.amount || b.qty - a.qty)
      .slice(0, 20),
    ltvSummary: {
      customers: customers.length,
      repeat2Plus: customers.filter((customer) => customer.orders >= 2).length,
      repeat3Plus: customers.filter((customer) => customer.orders >= 3).length,
      repeat6Plus: customers.filter((customer) => customer.orders >= 6).length,
      revenue100kPlus: customers.filter((customer) => customer.amount >= 100_000).length,
      revenue300kPlus: customers.filter((customer) => customer.amount >= 300_000).length,
      revenue500kPlus: customers.filter((customer) => customer.amount >= 500_000).length,
      revenue1mPlus: customers.filter((customer) => customer.amount >= 1_000_000).length,
      maxCustomerRevenue: Math.max(0, ...customers.map((customer) => customer.amount)),
      totalRevenue: sum(completeMallOrders, (order) => order.finalAmount),
    },
    orderMap: orders,
  };
};

const buildPaymentDryRun = (rows: SheetRow[], orderMap: Map<string, { finalAmount: number }>) => {
  const paymentsByOrder = new Map<string, { paid: number; refund: number; rows: number }>();
  const methodGroups = new Map<string, { rows: number; orders: Set<string>; amount: number }>();
  const statusGroups = new Map<string, { rows: number; orders: Set<string>; amount: number }>();
  const providerGroups = new Map<string, { rows: number; orders: Set<string>; amount: number }>();

  for (const row of rows) {
    const orderNo = parseString(row["주문번호"]);
    const method = parseString(row["결제수단"]);
    const status = parseString(row["결제상태"]);
    const kind = parseString(row["결제구분"]);
    const amount = parseNumber(row["금액"]);
    const pgTxNo = parseString(row["PG거래번호"]);
    const pgOrderNo = parseString(row["PG주문번호"]);
    const provider = pgTxNo.startsWith("iw_th")
      ? "toss"
      : pgTxNo.startsWith("IBclean")
        ? "inicis_billing"
        : pgOrderNo.startsWith("pa")
          ? "naverpay_or_unknown"
          : "(blank)";

    const current = paymentsByOrder.get(orderNo) ?? { paid: 0, refund: 0, rows: 0 };
    current.rows += 1;
    if (kind === "환불" || amount < 0) current.refund += amount;
    else if (status === "결제완료" && kind === "결제") current.paid += amount;
    paymentsByOrder.set(orderNo, current);

    incGroup(methodGroups, method || "(blank)", orderNo, status === "결제완료" && kind === "결제" ? amount : 0);
    incGroup(statusGroups, `${status || "(blank)"} / ${kind || "(blank)"}`, orderNo, amount);
    incGroup(providerGroups, provider, orderNo, status === "결제완료" && kind === "결제" ? amount : 0);
  }

  const paymentOrders = [...paymentsByOrder.entries()];
  const joinedOrders = paymentOrders.filter(([orderNo]) => orderMap.has(orderNo));
  const amountMismatch = joinedOrders.filter(([orderNo, payment]) => {
    const order = orderMap.get(orderNo);
    return order && Math.abs(order.finalAmount - payment.paid) > 0;
  });

  return {
    rows: rows.length,
    uniquePaymentOrders: paymentsByOrder.size,
    joinedOrders: joinedOrders.length,
    ordersWithoutPayment: [...orderMap.keys()].filter((orderNo) => !paymentsByOrder.has(orderNo)).length,
    paymentsWithoutOrder: paymentOrders.filter(([orderNo]) => !orderMap.has(orderNo)).length,
    amountMismatchOrders: amountMismatch.length,
    amountMismatchSample: amountMismatch.slice(0, 20).map(([orderNo, payment]) => ({
      orderNo,
      orderFinalAmount: orderMap.get(orderNo)?.finalAmount ?? 0,
      paymentPaidAmount: payment.paid,
      delta: payment.paid - (orderMap.get(orderNo)?.finalAmount ?? 0),
    })),
    methodSummary: groupToRows(methodGroups),
    statusSummary: groupToRows(statusGroups),
    providerSummary: groupToRows(providerGroups),
  };
};

const escapeCell = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const markdownTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(escapeCell).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
].join("\n");

const formatWon = (value: number) => `${Math.round(value).toLocaleString("ko-KR")}원`;

const renderMarkdown = (payload: Record<string, any>) => [
  "# 더클린커피 엑셀 Import Dry-run",
  "",
  `생성 시각: ${payload.checkedAt}`,
  `site: \`${payload.site}\``,
  "mode: `dry_run_read_only`",
  "",
  "## Summary",
  "",
  markdownTable(
    ["항목", "값"],
    [
      ["orders rows", payload.orders.rows],
      ["unique orders", payload.orders.uniqueOrders],
      ["order amount", formatWon(payload.orders.amountByUniqueOrder)],
      ["payment rows", payload.payments.rows],
      ["payment unique orders", payload.payments.uniquePaymentOrders],
      ["order-payment joined", `${payload.payments.joinedOrders}/${payload.payments.uniquePaymentOrders}`],
      ["orders without payment", payload.payments.ordersWithoutPayment],
      ["payments without order", payload.payments.paymentsWithoutOrder],
      ["amount mismatch orders", payload.payments.amountMismatchOrders],
      ["unique phones", payload.orders.uniquePhones],
    ],
  ),
  "",
  "## Channel Summary",
  "",
  markdownTable(
    ["channel", "orders", "amount"],
    payload.orders.channelSummary.map((row: Record<string, any>) => [row.key, row.orders, formatWon(row.amount)]),
  ),
  "",
  "## Payment Method Summary",
  "",
  markdownTable(
    ["method", "orders", "amount"],
    payload.payments.methodSummary.map((row: Record<string, any>) => [row.key, row.orders, formatWon(row.amount)]),
  ),
  "",
  "## LTV Aggregate",
  "",
  markdownTable(
    ["metric", "value"],
    Object.entries(payload.orders.ltvSummary).map(([key, value]) => [
      key,
      typeof value === "number" && ["maxCustomerRevenue", "totalRevenue"].includes(key) ? formatWon(value) : value,
    ]),
  ),
  "",
  "## Guardrails",
  "",
  "```text",
  "No DB write: YES",
  "No import apply: YES",
  "No PII sample output: YES",
  "Apply requires separate TJ approval.",
  "```",
].join("\n");

const main = () => {
  const args = parseArgs();
  const orderRows = readRows(args.ordersPath);
  const paymentRows = readRows(args.paymentsPath);
  const orders = buildOrderDryRun(orderRows);
  const payments = buildPaymentDryRun(paymentRows, orders.orderMap);
  const payload = {
    ok: true,
    checkedAt: new Date().toISOString(),
    site: SITE,
    mode: "dry_run_read_only",
    sources: {
      ordersPath: args.ordersPath,
      paymentsPath: args.paymentsPath,
    },
    orders: {
      ...orders,
      orderMap: undefined,
    },
    payments,
    guardrails: {
      dbWrite: false,
      importApply: false,
      piiSampleOutput: false,
    },
    nextApplyGate: {
      required: true,
      reason: "Local DB write/import apply requires backup, dry-run review, and explicit TJ approval.",
    },
  };
  console.log(args.markdown ? renderMarkdown(payload) : JSON.stringify(payload, null, 2));
};

main();
