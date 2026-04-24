const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '/Users/vibetj/coding/seo/backend/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

async function main() {
  const norm = (p) => (p||'').toString().replace(/[^0-9]/g,'');
  const byPhone = {};  // { phone: { biocom, coffee, aibio, total } }

  // 1) 바이오컴 12개월
  console.log('[1/3] Loading biocom (tb_iamweb_users, 12mo)...');
  const bio = await pool.query(`
    select regexp_replace(customer_number,'[\\- ]','','g') phone, sum(paid_price)::bigint rev
    from public.tb_iamweb_users
    where order_date is not null
      and order_date >= to_char(now() - interval '12 months','YYYY-MM-DD')
      and (cancellation_reason is null or trim(cancellation_reason) in ('','nan'))
      and paid_price > 0
    group by 1
  `);
  for (const r of bio.rows) {
    const p = norm(r.phone); if (!p || p.length < 9) continue;
    byPhone[p] = byPhone[p] || { biocom:0, coffee:0, aibio:0 };
    byPhone[p].biocom = Number(r.rev);
  }
  console.log('  biocom phones:', bio.rows.length);

  // 2) 더클린커피 12개월 (아임웹-C + 스마트스토어 커피)
  console.log('[2/3] Loading coffee (tb_playauto_orders, 12mo)...');
  const coff = await pool.query(`
    select regexp_replace(order_htel,'[\\- ]','','g') phone, sum(pay_amt::numeric)::bigint rev
    from public.tb_playauto_orders
    where shop_name in ('아임웹-C','스마트스토어')
      and pay_amt::numeric > 0
      and ship_plan_date is not null
      and ship_plan_date >= to_char(now() - interval '12 months','YYYY-MM-DD')
    group by 1
  `);
  for (const r of coff.rows) {
    const p = norm(r.phone); if (!p || p.length < 9) continue;
    byPhone[p] = byPhone[p] || { biocom:0, coffee:0, aibio:0 };
    byPhone[p].coffee = Number(r.rev);
  }
  console.log('  coffee phones:', coff.rows.length);

  // 3) AIBIO — 이미 fetch된 로컬 JSON 사용 (Supabase sync 전)
  console.log('[3/3] Loading AIBIO (Supabase snapshot, 12mo)...');
  const aibioCusts = require('/tmp/aibio_customers_all.json');
  const aibioPays  = require('/tmp/aibio_payments_all.json');
  const custById = Object.fromEntries(aibioCusts.map(c => [c.customer_id, c]));
  const cutoff = new Date(Date.now() - 365*24*3600*1000).toISOString().slice(0,10);
  const aibio12 = {};
  for (const p of aibioPays) {
    if (!p.payment_date || p.payment_date < cutoff) continue;
    const cust = custById[p.customer_id];
    if (!cust) continue;
    const ph = norm(cust.phone); if (!ph || ph.length < 9) continue;
    aibio12[ph] = (aibio12[ph] || 0) + Number(p.amount || 0);
  }
  for (const [ph, rev] of Object.entries(aibio12)) {
    byPhone[ph] = byPhone[ph] || { biocom:0, coffee:0, aibio:0 };
    byPhone[ph].aibio = rev;
  }
  console.log('  aibio phones (12mo):', Object.keys(aibio12).length);

  // 통합 total
  for (const ph in byPhone) {
    const o = byPhone[ph];
    o.total = o.biocom + o.coffee + o.aibio;
    o.channels = (o.biocom>0?1:0) + (o.coffee>0?1:0) + (o.aibio>0?1:0);
  }

  // ─── 통합 등급 산정 ───
  const TIERS = [
    { name:'PRIME',     min: 50_000_000 },
    { name:'PLATINUM',  min: 15_000_000 },
    { name:'GOLD',      min:  5_000_000 },
    { name:'SILVER',    min:  2_000_000 },
    { name:'INITIATE',  min:    500_000 },
    { name:'(below)',   min:          0 },
  ];
  const buckets = TIERS.map(t => ({ ...t, customers: [] }));
  for (const ph in byPhone) {
    const o = byPhone[ph];
    for (const b of buckets) {
      if (o.total >= b.min) { b.customers.push({ phone: ph, ...o }); break; }
    }
  }

  console.log('\n═══ 통합 멤버십 등급 산정 (직전 12개월 기준, 2025-04-25 ~ 2026-04-24) ═══');
  const tableRows = buckets.map(b => ({
    tier: b.name,
    '최소 금액': '₩'+b.min.toLocaleString(),
    '고객 수': b.customers.length.toLocaleString(),
    '누적 매출': '₩'+b.customers.reduce((s,c)=>s+c.total,0).toLocaleString(),
    '3채널': b.customers.filter(c => c.channels === 3).length,
    '2채널': b.customers.filter(c => c.channels === 2).length,
    '1채널': b.customers.filter(c => c.channels === 1).length,
  }));
  console.table(tableRows);

  // 채널 매트릭스
  console.log('\n═══ 채널 조합 매트릭스 ═══');
  const mat = { bioOnly:0, coffOnly:0, aibOnly:0, bio_coff:0, bio_aib:0, coff_aib:0, all3:0 };
  for (const ph in byPhone) {
    const o = byPhone[ph];
    if (o.biocom>0 && o.coffee>0 && o.aibio>0) mat.all3++;
    else if (o.biocom>0 && o.coffee>0) mat.bio_coff++;
    else if (o.biocom>0 && o.aibio>0) mat.bio_aib++;
    else if (o.coffee>0 && o.aibio>0) mat.coff_aib++;
    else if (o.biocom>0) mat.bioOnly++;
    else if (o.coffee>0) mat.coffOnly++;
    else if (o.aibio>0) mat.aibOnly++;
  }
  console.table(mat);

  // TOP 20 통합 구매자
  const allCusts = Object.entries(byPhone).map(([ph, o]) => ({ phone: ph, ...o }));
  allCusts.sort((a,b) => b.total - a.total);
  console.log('\n═══ TOP 20 통합 구매자 ═══');
  console.table(allCusts.slice(0, 20).map(c => ({
    phone_tail: c.phone.slice(-4),
    total: '₩'+c.total.toLocaleString(),
    biocom: c.biocom.toLocaleString(),
    coffee: c.coffee.toLocaleString(),
    aibio: c.aibio.toLocaleString(),
    channels: c.channels,
  })));

  // JSON 내보내기
  fs.writeFileSync('/tmp/unified_tier_result.json', JSON.stringify({
    queryDate: new Date().toISOString(),
    totalCustomers: Object.keys(byPhone).length,
    tierDistribution: tableRows,
    channelMatrix: mat,
    top20: allCusts.slice(0,20),
    tiers: buckets.map(b => ({ name: b.name, min: b.min, count: b.customers.length })),
  }, null, 2));
  console.log('\n✓ saved: /tmp/unified_tier_result.json');

  await pool.end();
}
main().catch(e => { console.error(e.stack || e.message); process.exit(1); });
