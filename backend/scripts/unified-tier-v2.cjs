// Unified tier calculation v2 (2026-04-24)
// 변경점: 커피 집계를 PlayAuto pay_amt 기반 → Toss 순매출 + PlayAuto shop_ord_no prefix 매칭 phone 조합으로 교체
// 실측 기반 가장 정합적인 3채널 통합.
require('dotenv').config({ path: '/Users/vibetj/coding/seo/backend/.env' });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

(async () => {
  const byPhone = {};
  const norm = (p) => (p || '').toString().replace(/[^0-9]/g, '');

  // 1) 바이오컴 12개월 (tb_iamweb_users)
  console.log('[1/3] biocom ...');
  const bio = await pool.query(`
    select regexp_replace(customer_number, '[- ]', '', 'g') phone,
           sum(paid_price)::bigint rev
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

  // 2) 더클린커피 12개월 (Toss 순매출 × PlayAuto shop_ord_no 매칭 phone)
  console.log('[2/3] coffee (Toss↔PlayAuto matched) ...');
  const coffee = await pool.query(`
    with toss_net as (
      select split_part(order_id, '-', 1) ord_key,
             sum(total_amount::numeric - cancel_amount::numeric) net_rev
      from public.tb_sales_toss
      where store='coffee'
        and approved_at::text >= to_char(now() - interval '12 months','YYYY-MM-DD')
        and status in ('DONE','PARTIAL_CANCELED')
      group by ord_key
    ),
    matched as (
      select distinct on (t.ord_key) t.ord_key,
             regexp_replace(p.order_htel, '[- ]', '', 'g') phone,
             t.net_rev
      from toss_net t
      join public.tb_playauto_orders p
        on p.shop_ord_no = t.ord_key
        or split_part(p.shop_ord_no, ' ', 1) = t.ord_key
      where p.shop_name='아임웹-C' and p.order_htel !~ '[*]'
    )
    select phone, sum(net_rev)::bigint rev
    from matched group by phone
  `);
  for (const r of coffee.rows) {
    const p = norm(r.phone); if (!p || p.length < 9) continue;
    byPhone[p] = byPhone[p] || { biocom:0, coffee:0, aibio:0 };
    byPhone[p].coffee = Number(r.rev);
  }
  console.log('  coffee phones:', coffee.rows.length);

  // 3) AIBIO 12개월 (로컬 SQLite aibio_payments에서 바로)
  console.log('[3/3] aibio (local SQLite) ...');
  const Database = require('/Users/vibetj/coding/seo/backend/node_modules/better-sqlite3');
  const db = new Database('/Users/vibetj/coding/seo/backend/data/crm.sqlite3', { readonly: true });
  // SQLite에 regex 함수 없으므로 JS에서 정규화
  const aibioRaw = db.prepare(`
    SELECT ac.phone, SUM(ap.amount) rev
    FROM aibio_payments ap
    JOIN aibio_customers ac ON ac.customer_id = ap.customer_id
    WHERE ap.payment_date >= date('now','-12 months')
      AND ac.phone IS NOT NULL
    GROUP BY ac.phone
  `).all();
  for (const r of aibioRaw) {
    const p = norm(r.phone); if (!p || p.length < 9) continue;
    byPhone[p] = byPhone[p] || { biocom:0, coffee:0, aibio:0 };
    byPhone[p].aibio = Number(r.rev || 0);
  }
  console.log('  aibio phones:', aibioRaw.length);

  // 총합
  for (const ph in byPhone) {
    const o = byPhone[ph];
    o.total = o.biocom + o.coffee + o.aibio;
    o.channels = (o.biocom>0?1:0) + (o.coffee>0?1:0) + (o.aibio>0?1:0);
  }

  // 등급 분포 — 구기준(설계상) + 신기준(실측 반영)
  const oldTiers = [
    { name:'PRIME(₩50M)', min:50_000_000 },
    { name:'PLATINUM(₩15M)', min:15_000_000 },
    { name:'GOLD(₩5M)', min:5_000_000 },
    { name:'SILVER(₩2M)', min:2_000_000 },
    { name:'INITIATE(₩500K)', min:500_000 },
    { name:'below', min:0 },
  ];
  const newTiers = [
    { name:'PRIME(₩10M)', min:10_000_000 },
    { name:'PLATINUM(₩5M)', min:5_000_000 },
    { name:'GOLD(₩2M)', min:2_000_000 },
    { name:'SILVER(₩1M)', min:1_000_000 },
    { name:'INITIATE(₩300K)', min:300_000 },
    { name:'below', min:0 },
  ];
  const bucket = (tiers) => {
    const b = tiers.map(t => ({ ...t, c:0, rev:0, ch3:0, ch2:0, ch1:0 }));
    for (const ph in byPhone) {
      const o = byPhone[ph];
      for (const x of b) if (o.total >= x.min) {
        x.c++; x.rev += o.total;
        if (o.channels === 3) x.ch3++;
        else if (o.channels === 2) x.ch2++;
        else x.ch1++;
        break;
      }
    }
    return b;
  };
  console.log('\n═══ 기존 설계(₩50M PRIME) 실측 ═══');
  console.table(bucket(oldTiers).map(x => ({
    tier: x.name, customers: x.c, total_rev: '₩'+x.rev.toLocaleString(),
    ch3:x.ch3, ch2:x.ch2, ch1:x.ch1,
  })));
  console.log('\n═══ 재조정 기준(₩10M PRIME) 실측 ═══');
  console.table(bucket(newTiers).map(x => ({
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
  console.log('\n═══ 채널 매트릭스 (v2) ═══');
  console.table(mat);

  // TOP 20
  const top = Object.entries(byPhone).map(([p, o]) => ({ p, ...o })).sort((a,b)=>b.total-a.total).slice(0,20);
  console.log('\nTOP 20 unified:');
  console.table(top.map(t => ({
    phone_tail: t.p.slice(-4),
    total: '₩'+t.total.toLocaleString(),
    biocom: t.biocom.toLocaleString(),
    coffee: t.coffee.toLocaleString(),
    aibio: t.aibio.toLocaleString(),
    ch: t.channels,
  })));

  fs.writeFileSync('/tmp/unified_tier_v2.json', JSON.stringify({
    queryDate: new Date().toISOString(),
    total_unique_customers: Object.keys(byPhone).length,
    channelMatrix: mat,
    oldTiers: bucket(oldTiers),
    newTiers: bucket(newTiers),
    top20: top,
  }, null, 2));
  console.log('\n✓ saved: /tmp/unified_tier_v2.json');

  db.close();
  await pool.end();
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
