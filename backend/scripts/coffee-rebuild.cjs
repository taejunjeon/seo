require('dotenv').config({ path: '/Users/vibetj/coding/seo/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

(async () => {
  // PlayAuto 아임웹-C order_htel 마스킹 패턴 확인
  const mask = await pool.query(`
    select
      count(*) total,
      count(*) filter (where order_htel like '%*%') masked,
      count(*) filter (where order_htel ~ '^01[0-9]{8,9}$') clean_plain,
      count(*) filter (where order_htel ~ '^010-[0-9]{4}-[0-9]{4}$') clean_dashed
    from public.tb_playauto_orders
    where shop_name='아임웹-C' and order_htel is not null and order_htel != ''
  `);
  console.log('아임웹-C order_htel 상태:', mask.rows[0]);

  // 커피 전체 고객별 매출 재집계 — Toss net + PlayAuto phone 조합
  // order_id prefix 매칭
  const q = `
    with toss_net as (
      select split_part(order_id, '-', 1) ord_key,
             sum(total_amount::numeric - cancel_amount::numeric) net_rev,
             count(*) cnt
      from public.tb_sales_toss
      where store='coffee'
        and approved_at::text >= to_char(now() - interval '12 months','YYYY-MM-DD')
        and status in ('DONE','PARTIAL_CANCELED')
      group by ord_key
    ),
    matched as (
      select
        t.ord_key,
        regexp_replace(p.order_htel, '[- ]', '', 'g') phone_raw,
        p.order_htel phone_original,
        t.net_rev
      from toss_net t
      join public.tb_playauto_orders p
        on p.shop_ord_no = t.ord_key
        or split_part(p.shop_ord_no, ' ', 1) = t.ord_key
      where p.shop_name = '아임웹-C'
    )
    select
      count(*) total_rows,
      count(distinct phone_raw) unique_phones,
      count(*) filter (where phone_original like '%*%') masked_rows,
      count(*) filter (where phone_original !~ '[*]') clean_rows,
      round(sum(net_rev)) total_rev
    from matched
  `;
  const r = await pool.query(q);
  console.log('\n매칭 후 고객 집계 가능 여부:', r.rows[0]);

  // 고객별 분포 (clean phone만)
  const dist = await pool.query(`
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
             p.order_htel original,
             t.net_rev
      from toss_net t
      join public.tb_playauto_orders p
        on p.shop_ord_no = t.ord_key
        or split_part(p.shop_ord_no, ' ', 1) = t.ord_key
      where p.shop_name='아임웹-C' and p.order_htel !~ '[*]'
    ),
    cust as (
      select phone, sum(net_rev) rev
      from matched
      group by phone
    )
    select
      count(*) paying_customers,
      round(sum(rev)) sum_rev,
      round(max(rev)) max_rev,
      sum(case when rev >= 5000000 then 1 else 0 end) ge_5M,
      sum(case when rev >= 2000000 then 1 else 0 end) ge_2M,
      sum(case when rev >= 1000000 then 1 else 0 end) ge_1M,
      sum(case when rev >= 500000  then 1 else 0 end) ge_500K,
      sum(case when rev >= 300000  then 1 else 0 end) ge_300K,
      sum(case when rev >= 100000  then 1 else 0 end) ge_100K
    from cust
  `);
  console.log('\n고객별 12개월 커피 매출 분포 (Toss 순매출 + PlayAuto phone 매칭):');
  console.log(dist.rows[0]);

  // TOP 10
  const top = await pool.query(`
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
    select phone, round(sum(net_rev)) rev, count(*) orders
    from matched group by phone order by sum(net_rev) desc limit 10
  `);
  console.log('\nTOP 10 coffee buyers:');
  for (const r of top.rows) console.log(' ', r.phone, '| ₩', Number(r.rev).toLocaleString(), '|', r.orders, 'orders');

  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
