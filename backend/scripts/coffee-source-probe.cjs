require('dotenv').config({ path: '/Users/vibetj/coding/seo/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

(async () => {
  // 1. tb_store_info
  const si = await pool.query('select site_code, store_name, primary_domain from public.tb_store_info order by id');
  console.log('=== tb_store_info (' + si.rows.length + ' sites) ===');
  for (const r of si.rows) console.log(' ', r.site_code, '/', r.store_name, '/', r.primary_domain);

  // 2. 커피 키워드별 건수
  const keywords = ['%커피%', '%드립백%', '%원두%', '%콜롬비아%', '%에티오피아%', '%과테말라%', '%케냐%', '%디카페인%', '%더클린%'];
  console.log('\n=== tb_iamweb_users 커피 키워드 건수 ===');
  for (const kw of keywords) {
    const r = await pool.query('select count(*) c from public.tb_iamweb_users where product_name ilike $1', [kw]);
    console.log(' ', kw, '->', r.rows[0].c);
  }

  // 3. 커피 합계 (중복 없이)
  const total = await pool.query(`
    select count(*) c,
           count(distinct regexp_replace(customer_number, '[- ]', '', 'g')) unique_phones,
           min(order_date) min_d,
           max(order_date) max_d,
           round(sum(paid_price)::numeric) total_rev
    from public.tb_iamweb_users
    where product_name ilike '%커피%' or product_name ilike '%드립백%' or product_name ilike '%원두%'
       or product_name ilike '%콜롬비아%' or product_name ilike '%에티오피아%'
       or product_name ilike '%과테말라%' or product_name ilike '%케냐%'
       or product_name ilike '%디카페인%' or product_name ilike '%더클린%'
  `);
  console.log('\n=== TOTAL coffee in tb_iamweb_users ===');
  console.log(total.rows[0]);

  // 4. phone 샘플
  const ph = await pool.query(`select customer_number from public.tb_iamweb_users
    where customer_number is not null and product_name ilike '%콜롬비아%' limit 5`);
  console.log('\n=== phone samples (coffee) ===');
  for (const r of ph.rows) console.log(' ', r.customer_number);

  // 5. Toss order_id ↔ tb_iamweb_users.order_number 매칭 (접두사)
  const m = await pool.query(`
    select count(*) matched
    from public.tb_sales_toss t
    join public.tb_iamweb_users u on u.order_number = split_part(t.order_id, '-', 1)
    where t.store='coffee' and t.status='DONE'
  `);
  console.log('\nToss↔tb_iamweb_users order_number prefix match:', m.rows[0].matched);

  const m2 = await pool.query(`
    select count(*) matched
    from public.tb_sales_toss t
    join public.tb_iamweb_users u on u.order_number = t.order_id
    where t.store='coffee' and t.status='DONE'
  `);
  console.log('Toss↔tb_iamweb_users order_number exact match:', m2.rows[0].matched);

  // 6. tb_playauto_orders shop_ord_no 분해 매칭
  const m3 = await pool.query(`
    select count(*) matched
    from public.tb_sales_toss t
    join public.tb_playauto_orders p on p.shop_ord_no = split_part(t.order_id, '-', 1)
       or split_part(p.shop_ord_no, ' ', 1) = split_part(t.order_id, '-', 1)
    where t.store='coffee' and t.status='DONE'
  `);
  console.log('Toss↔playauto shop_ord_no prefix/split match:', m3.rows[0].matched);

  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
