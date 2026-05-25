import type { CoupangAccount, CoupangRgOrder, CoupangRgOrderItem } from "../src/coupangClient";
import { getRgOrders, isCoupangConfigured } from "../src/coupangClient";

type ProductClass = "coffee_hint" | "teamketo_hint" | "other_hint";

type CliOptions = {
  account: CoupangAccount;
  from: string;
  to: string;
  targetGapKrw: number;
  targetGapOrders: number;
};

type OrderAggregate = {
  orderKey: string;
  paidDateKst: string;
  coffeeAmountKrw: number;
  coffeeQuantity: number;
  coffeeItemCount: number;
};

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit?.slice(prefix.length);
}

function assertDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  return value;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function parseOptions(): CliOptions {
  const account = String(argValue("--account") ?? "teamketo") as CoupangAccount;
  if (account !== "teamketo" && account !== "biocom") {
    throw new Error("--account must be teamketo or biocom");
  }
  return {
    account,
    from: assertDate(String(argValue("--from") ?? "2026-04-25"), "--from"),
    to: assertDate(String(argValue("--to") ?? "2026-05-01"), "--to"),
    targetGapKrw: parsePositiveInt(argValue("--target-gap-krw"), 60_700),
    targetGapOrders: parsePositiveInt(argValue("--target-gap-orders"), 2),
  };
}

function shiftDate(date: string, deltaDays: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function kstDateFromEpochMs(value: unknown): string | null {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function classifyProduct(productName: string): ProductClass {
  const normalized = productName.toLowerCase();
  if (/커피|coffee|디카페|decaf|원두|콜드브루|드립|블렌드/.test(normalized)) {
    return "coffee_hint";
  }
  if (/키토|keto|mct|방탄|bulletproof|저탄|저당/.test(normalized)) {
    return "teamketo_hint";
  }
  return "other_hint";
}

function itemQuantity(item: CoupangRgOrderItem): number {
  const value = Number(item.salesQuantity ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function itemUnitPrice(item: CoupangRgOrderItem): number {
  const value = Number(item.unitSalesPrice ?? item.salesPrice ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

async function fetchOrders(account: CoupangAccount, from: string, to: string): Promise<{
  apiCallCount: number;
  apiOrdersSeen: number;
  coffeeOrders: Map<string, OrderAggregate>;
}> {
  const coffeeOrders = new Map<string, OrderAggregate>();
  let nextToken: string | undefined;
  let apiCallCount = 0;
  let apiOrdersSeen = 0;

  do {
    apiCallCount += 1;
    const response = await getRgOrders(account, from, to, { nextToken, timeoutMs: 30000 });
    const orders = Array.isArray(response.data) ? response.data : [];
    apiOrdersSeen += orders.length;
    for (const order of orders) {
      const paidDateKst = kstDateFromEpochMs(order.paidAt);
      if (!paidDateKst) continue;
      const orderKey = String(order.orderId ?? `missing-${apiOrdersSeen}`);
      const current = coffeeOrders.get(orderKey) ?? {
        orderKey,
        paidDateKst,
        coffeeAmountKrw: 0,
        coffeeQuantity: 0,
        coffeeItemCount: 0,
      };
      const items = Array.isArray(order.orderItems) ? order.orderItems : [];
      for (const item of items) {
        if (classifyProduct(String(item.productName ?? "")) !== "coffee_hint") continue;
        const quantity = itemQuantity(item);
        current.coffeeAmountKrw += quantity * itemUnitPrice(item);
        current.coffeeQuantity += quantity;
        current.coffeeItemCount += 1;
      }
      if (current.coffeeAmountKrw > 0) coffeeOrders.set(orderKey, current);
    }
    nextToken = response.nextToken || undefined;
  } while (nextToken);

  return { apiCallCount, apiOrdersSeen, coffeeOrders };
}

function summarizeOrders(orders: OrderAggregate[], from: string, to: string) {
  const inWindow = orders.filter((order) => order.paidDateKst >= from && order.paidDateKst <= to);
  const byDay: Record<string, { order_count: number; amount_krw: number; quantity: number }> = {};
  for (const order of inWindow) {
    const bucket = byDay[order.paidDateKst] ?? { order_count: 0, amount_krw: 0, quantity: 0 };
    bucket.order_count += 1;
    bucket.amount_krw += order.coffeeAmountKrw;
    bucket.quantity += order.coffeeQuantity;
    byDay[order.paidDateKst] = bucket;
  }
  return {
    order_count: inWindow.length,
    amount_krw: inWindow.reduce((sum, order) => sum + order.coffeeAmountKrw, 0),
    quantity: inWindow.reduce((sum, order) => sum + order.coffeeQuantity, 0),
    by_day: Object.fromEntries(Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b))),
  };
}

function amountHistogram(orders: OrderAggregate[]) {
  const histogram: Record<string, number> = {};
  for (const order of orders) {
    const key = String(order.coffeeAmountKrw);
    histogram[key] = (histogram[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(histogram).sort(([a], [b]) => Number(a) - Number(b)));
}

function findFixedSizeCombination(amounts: number[], target: number, size: number): number[] | null {
  const picked: number[] = [];
  function visit(start: number, remaining: number, left: number): boolean {
    if (left === 0) return remaining === 0;
    for (let i = start; i < amounts.length; i += 1) {
      const amount = amounts[i];
      if (amount > remaining) continue;
      picked.push(amount);
      if (visit(i + 1, remaining - amount, left - 1)) return true;
      picked.pop();
    }
    return false;
  }
  return visit(0, target, size) ? [...picked] : null;
}

async function main() {
  const options = parseOptions();
  if (!isCoupangConfigured(options.account)) {
    throw new Error(`Coupang ${options.account} credentials are not configured`);
  }

  const guardFrom = shiftDate(options.from, -1);
  const guardTo = shiftDate(options.to, 1);
  const [exact, guard] = await Promise.all([
    fetchOrders(options.account, options.from, options.to),
    fetchOrders(options.account, guardFrom, guardTo),
  ]);

  const exactOrders = [...exact.coffeeOrders.values()];
  const guardOrders = [...guard.coffeeOrders.values()];
  const guardOnlyTargetWindow = guardOrders.filter((order) =>
    order.paidDateKst >= options.from &&
    order.paidDateKst <= options.to &&
    !exact.coffeeOrders.has(order.orderKey),
  );
  const exactOnlyTargetWindow = exactOrders.filter((order) =>
    order.paidDateKst >= options.from &&
    order.paidDateKst <= options.to &&
    !guard.coffeeOrders.has(order.orderKey),
  );
  const sortedGuardOnlyAmounts = guardOnlyTargetWindow
    .map((order) => order.coffeeAmountKrw)
    .sort((a, b) => a - b);
  const gapCombination = findFixedSizeCombination(
    sortedGuardOnlyAmounts,
    options.targetGapKrw,
    options.targetGapOrders,
  );

  console.log(JSON.stringify({
    report: "reportcoffee_coupang_rg_window_diagnostic_v1",
    generated_at: new Date().toISOString(),
    source: {
      system: "coupang_rg_orders_api_readonly",
      account: options.account,
      raw_order_output: 0,
      raw_json_storage: 0,
    },
    window: {
      timezone: "Asia/Seoul",
      exact_from: options.from,
      exact_to: options.to,
      guard_from: guardFrom,
      guard_to: guardTo,
    },
    api: {
      exact_calls: exact.apiCallCount,
      exact_orders_seen: exact.apiOrdersSeen,
      guard_calls: guard.apiCallCount,
      guard_orders_seen: guard.apiOrdersSeen,
    },
    exact_query_target_window: summarizeOrders(exactOrders, options.from, options.to),
    guard_query_target_window: summarizeOrders(guardOrders, options.from, options.to),
    boundary_delta: {
      guard_minus_exact_order_count: guardOnlyTargetWindow.length - exactOnlyTargetWindow.length,
      guard_only_target_window: summarizeOrders(guardOnlyTargetWindow, options.from, options.to),
      exact_only_target_window: summarizeOrders(exactOnlyTargetWindow, options.from, options.to),
      guard_only_amount_histogram_krw: amountHistogram(guardOnlyTargetWindow),
    },
    target_gap_probe: {
      target_gap_krw: options.targetGapKrw,
      target_gap_orders: options.targetGapOrders,
      guard_only_combination_found: gapCombination !== null,
      guard_only_combination_amounts_krw: gapCombination ?? [],
      interpretation: gapCombination
        ? "remaining_gap_can_be_reconstructed_from_boundary_only_rg_orders"
        : "remaining_gap_not_directly_reconstructed_from_boundary_only_rg_orders",
    },
    guardrails: {
      read_only: true,
      db_write: 0,
      slack_send: 0,
      platform_send_or_upload: 0,
      raw_customer_identifier_output: 0,
      raw_order_identifier_output: 0,
      raw_payment_identifier_output: 0,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
