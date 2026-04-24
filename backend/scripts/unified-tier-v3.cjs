// Unified tier v3 (2026-04-24)
// 변경점 (v2 → v3):
//   - 커피 데이터 소스: tb_sales_toss(불완전) → coffee_payments_excel(결제완료+결제) JOIN coffee_orders_excel(phone)
//   - 정기결제(이니시스 빌링) 포함 모든 결제수단 포함
//   - 환불 차감 (음수 amount 자동 적용)
//   - 더 정확한 phone 매칭 (엑셀은 마스킹 0%)
require('dotenv').config({ path: '/Users/vibetj/coding/seo/backend/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const Database = require('better-sqlite3');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
const db = new Database('/Users/vibetj/coding/seo/backend/data/crm.sqlite3', { readonly: true });

(async () => {
  const norm = (p) => (p || '').toString().replace(/[^0-9]/g, '');
  const byPhone = {};

  // ─── 1. 바이오컴 12개월 (PG tb_iamweb_users) ───
  console.log('[1/3] biocom (tb_iamweb_users 12mo)...');
  const bio = await pool.query(`
    select regexp_replace(customer_number, '[- ]', '', 'g') phone,
           sum(paid_price)::bigint rev
    from public.tb_iamweb_users
    where order_date is not null
      and order_date >= to_char(now() - interval '12 months', 'YYYY-MM-DD')
      and (cancellation_reason is null or trim(cancellation_reason) in ('', 'nan'))
      and paid_price > 0
    group by 1
  `);
  for (const r of bio.rows) {
    const p = norm(r.phone); if (!p || p.length < 9) continue;
    byPhone[p] = byPhone[p] || { biocom:0, coffee:0, aibio:0 };
    byPhone[p].biocom = Number(r.rev);
  }
  console.log('  biocom paying phones:', bio.rows.length);

  // ─── 2. 커피 12개월 (엑셀 결제내역 × 주문 phone 조인) ───
  console.log('[2/3] coffee (excel payments + orders phone join, 12mo)...');
  // 결제완료 + 결제구분=결제 + 환불(음수 amount) 모두 sum (자동 차감 효과)
  // 더 정확하게는 결제완료 결제만 sum하고 환불은 별도 sum 후 차감
  const coffee = db.prepare(`
    WITH valid_pay AS (
      SELECT cpe.order_no, SUM(cpe.amount) net_amount
      FROM coffee_payments_excel cpe
      WHERE cpe.payment_at >= datetime('now','-12 months')
        AND cpe.payment_status IN ('결제완료','부분환불','전체환불')
      GROUP BY cpe.order_no
    ),
    order_phone AS (
      SELECT DISTINCT order_no, orderer_phone_norm
      FROM coffee_orders_excel
      WHERE orderer_phone_norm != ''
    )
    SELECT op.orderer_phone_norm phone, SUM(vp.net_amount) rev, COUNT(*) order_cnt
    FROM valid_pay vp
    JOIN order_phone op ON op.order_no = vp.order_no
    WHERE vp.net_amount > 0
    GROUP BY op.orderer_phone_norm
  `).all();
  for (const r of coffee) {
    const p = norm(r.phone); if (!p || p.length < 9) continue;
    byPhone[p] = byPhone[p] || { biocom:0, coffee:0, aibio:0 };
    byPhone[p].coffee = Number(r.rev || 0);
  }
  console.log('  coffee paying phones (excel-based):', coffee.length);

  // ─── 3. AIBIO 12개월 (로컬 aibio_*) ───
  console.log('[3/3] aibio (aibio_payments 12mo)...');
  const aibio = db.prepare(`
    SELECT ac.phone, SUM(ap.amount) rev
    FROM aibio_payments ap
    JOIN aibio_customers ac ON ac.customer_id = ap.customer_id
    WHERE ap.payment_date >= date('now','-12 months')
      AND ac.phone IS NOT NULL
    GROUP BY ac.phone
  `).all();
  for (const r of aibio) {
    const p = norm(r.phone); if (!p || p.length < 9) continue;
    byPhone[p] = byPhone[p] || { biocom:0, coffee:0, aibio:0 };
    byPhone[p].aibio = Number(r.rev || 0);
  }
  console.log('  aibio paying phones:', aibio.length);

  // 통합 total
  for (const ph in byPhone) {
    const o = byPhone[ph];
    o.total = o.biocom + o.coffee + o.aibio;
    o.channels = (o.biocom>0?1:0) + (o.coffee>0?1:0) + (o.aibio>0?1:0);
  }

  // ─── 등급 분포 ───
  const tiers = [
    { name:'PRIME', min:10_000_000 },
    { name:'PLATINUM', min:5_000_000 },
    { name:'GOLD', min:2_000_000 },
    { name:'SILVER', min:1_000_000 },
    { name:'INITIATE', min:300_000 },
    { name:'(below)', min:0 },
  ];
  const buckets = tiers.map(t => ({ ...t, c:0, rev:0, ch3:0, ch2:0, ch1:0, sample:[] }));
  for (const ph in byPhone) {
    const o = byPhone[ph];
    for (const x of buckets) if (o.total >= x.min) {
      x.c++; x.rev += o.total;
      if (o.channels === 3) x.ch3++;
      else if (o.channels === 2) x.ch2++;
      else x.ch1++;
      if (x.sample.length < 3) x.sample.push({ ph, ...o });
      break;
    }
  }
  console.log('\n═══ v3 등급 분포 (직전 12개월) ═══');
  console.table(buckets.map(x => ({
    tier: x.name, customers: x.c, total_rev: '₩'+x.rev.toLocaleString(),
    ch3:x.ch3, ch2:x.ch2, ch1:x.ch1,
  })));

  // 채널 매트릭스
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
  console.log('\n═══ 채널 매트릭스 v3 ═══');
  console.table(mat);

  // TOP 20
  const top = Object.entries(byPhone).map(([p, o]) => ({ p, ...o })).sort((a,b)=>b.total-a.total).slice(0,20);
  console.log('\nTOP 20 통합 구매자 (v3):');
  console.table(top.map(t => ({
    phone_tail: t.p.slice(-4),
    total: '₩'+t.total.toLocaleString(),
    biocom: t.biocom.toLocaleString(),
    coffee: t.coffee.toLocaleString(),
    aibio: t.aibio.toLocaleString(),
    ch: t.channels,
  })));

  // 커피 단독 분포 (정기구독 효과 확인)
  const coffOnly = Object.entries(byPhone)
    .filter(([_,o]) => o.coffee > 0 && o.biocom === 0 && o.aibio === 0)
    .map(([p,o]) => ({ p, rev: o.coffee }))
    .sort((a,b) => b.rev - a.rev);
  console.log('\n=== 커피 only 분포 ===');
  const ranges = [
    {l:'₩2M+', m:2_000_000}, {l:'₩1M+', m:1_000_000}, {l:'₩500K+', m:500_000},
    {l:'₩300K+', m:300_000}, {l:'₩100K+', m:100_000}, {l:'₩50K+', m:50_000},
  ];
  for (const r of ranges) {
    const cnt = coffOnly.filter(x => x.rev >= r.m).length;
    console.log(`  ${r.l}: ${cnt}명`);
  }

  // 결과 저장
  fs.writeFileSync('/tmp/unified_tier_v3.json', JSON.stringify({
    queryDate: new Date().toISOString(),
    total_unique_customers: Object.keys(byPhone).length,
    channelMatrix: mat,
    tiers: buckets.map(x => ({ name: x.name, min: x.min, customers: x.c, total_rev: x.rev, ch3: x.ch3, ch2: x.ch2, ch1: x.ch1 })),
    top20: top,
    coffeeOnlyDist: ranges.map(r => ({ band: r.l, customers: coffOnly.filter(x => x.rev >= r.m).length })),
  }, null, 2));
  console.log('\n✓ saved: /tmp/unified_tier_v3.json');

  db.close();
  await pool.end();
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
