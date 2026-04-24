#!/usr/bin/env node
// 더클린커피 정기구독 일 1회 통합 cron
//
// 1. 정기결제 트랙 카운터 sync
// 2. 트랙 변경자 진입 알림톡 발송 (testMode='Y' 기본)
// 3. 이탈 방지 시퀀스 발송 (30일/60일+ 무결제)
//
// 운영 사용:
//   crontab -e
//   0 4 * * * cd /Users/vibetj/coding/seo/backend && /usr/local/bin/node scripts/coffee-daily-cron.cjs >> logs/coffee-daily.log 2>&1
//
// 실발송 활성화 (testMode='N'):
//   COFFEE_LIVE_DISPATCH=1 node scripts/coffee-daily-cron.cjs

const tsx = require('tsx/cjs/api');
require('dotenv').config({ path: '/Users/vibetj/coding/seo/backend/.env' });

const trackSync = tsx.require('../src/subscriberTrackSync.ts', __filename);
const notifier = tsx.require('../src/subscriberTrackNotifier.ts', __filename);

const liveMode = process.env.COFFEE_LIVE_DISPATCH === '1';
const dryRun = process.env.COFFEE_DRY_RUN === '1';

(async () => {
  const t0 = Date.now();
  const stamp = new Date().toISOString();
  console.log(`\n[${stamp}] === coffee daily cron start ===`);
  console.log(`  liveMode=${liveMode} · dryRun=${dryRun}`);

  // 1. 트랙 sync
  console.log('\n[1/3] syncing subscriber tracks...');
  const sync = trackSync.syncSubscriberTracks();
  console.log('  result:', JSON.stringify(sync));

  // 2. 진입 알림톡
  console.log('\n[2/3] dispatching track promotions...');
  const promo = await notifier.dispatchTrackPromotions({ liveMode, dryRun });
  console.log('  result:', JSON.stringify(promo));

  // 3. 이탈 방지
  console.log('\n[3/3] dispatching churn prevention...');
  const churn = await notifier.dispatchChurnPrevention({ liveMode, dryRun });
  console.log('  result:', JSON.stringify(churn));

  // 통계
  const stats = trackSync.getSubscriberTrackStats();
  console.log('\n=== current track distribution ===');
  for (const r of stats.byTrack) {
    console.log(`  ${r.track}: ${r.customers}명 · ₩${(r.amount_12m||0).toLocaleString()} (12m)`);
  }
  console.log(`  churn risk: ${stats.churnRisk}명`);

  const notif = notifier.getNotificationStats();
  console.log('\n=== notification stats ===');
  for (const r of notif.byTemplate) {
    console.log(`  ${r.template_key} · ${r.send_status}: ${r.cnt}건`);
  }

  console.log(`\n✓ done in ${Date.now() - t0}ms`);
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
