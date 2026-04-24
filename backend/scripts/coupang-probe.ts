import {
  getSettlementHistories,
  isCoupangConfigured,
  listOrderSheetsByMinute,
} from "../src/coupangClient";

async function probe() {
  for (const account of ["biocom", "teamketo"] as const) {
    console.log(`\n═══ ${account.toUpperCase()} ═══`);
    if (!isCoupangConfigured(account)) {
      console.log("  env 미설정");
      continue;
    }

    // Test A · 정산 내역 (파라미터 1개, 서명·인증·권한 검증에 최적)
    try {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const list = await getSettlementHistories(account, yearMonth);
      console.log(`  [A] settlement ${yearMonth}: ${Array.isArray(list) ? list.length : 0}건 수신 ✅`);
    } catch (err) {
      console.log(`  [A] settlement: ❌ ${err instanceof Error ? err.message.slice(0, 300) : String(err)}`);
    }

    // Test B · v4 분단위 ordersheets (24시간 · searchType=timeFrame)
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      // 24시간 미만 (쿠팡 제약: "range should less than 1 day")
      const to = now;
      const from = new Date(now.getTime() - (24 * 3600 - 120) * 1000);
      const res = await listOrderSheetsByMinute(account, {
        createdAtFrom: fmt(from),
        createdAtTo: fmt(to),
        status: "ACCEPT",
      });
      console.log(`  [B] ordersheets 24h (status=ACCEPT): ${res.data.length}건 수신 ✅`);
      if (res.data.length) {
        const first = res.data[0];
        console.log(
          `      sample: shipmentBoxId=${first.shipmentBoxId} orderId=${first.orderId} orderedAt=${first.orderedAt} items=${first.orderItems?.length ?? 0}`,
        );
      }
    } catch (err) {
      console.log(`  [B] ordersheets: ❌ ${err instanceof Error ? err.message.slice(0, 300) : String(err)}`);
    }
  }
}

probe().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
