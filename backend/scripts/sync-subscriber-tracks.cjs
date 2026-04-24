#!/usr/bin/env node
// 더클린커피 정기구독 트랙 일 1회 sync 스크립트
//
// 사용:
//   node scripts/sync-subscriber-tracks.cjs
//
// 외부 cron 등록 예 (macOS launchd 또는 crontab):
//   crontab -e
//   0 4 * * * cd /Users/vibetj/coding/seo/backend && /usr/local/bin/node scripts/sync-subscriber-tracks.cjs >> logs/subscriber-tracks.log 2>&1
//
// 또는 backend dev 환경이라면 HTTP:
//   curl -X POST http://localhost:7020/api/coffee/sync-subscriber-tracks

const path = require('path');
const tsx = require('tsx/cjs/api');

// tsx 로 TypeScript 모듈 직접 require (backend dev 환경과 동일)
const mod = tsx.require('../src/subscriberTrackSync.ts', __filename);

const t0 = Date.now();
console.log(`[${new Date().toISOString()}] starting subscriber-track sync`);
const result = mod.syncSubscriberTracks();
console.log('result:', JSON.stringify(result, null, 2));

const stats = mod.getSubscriberTrackStats();
console.log('\n=== current track distribution ===');
for (const r of stats.byTrack) {
  console.log(`  ${r.track}: ${r.customers}명 · ₩${(r.amount_12m||0).toLocaleString()} (12m)`);
}
console.log(`\nchurn risk: ${stats.churnRisk}명 (직전 30일 결제 없음)`);
console.log(`\n최근 트랙 변경 ${stats.recentChanges.length}건:`);
for (const r of stats.recentChanges.slice(0, 10)) {
  console.log(`  ${r.changed_at} · ${r.phone_normalized.slice(-4)} · ${r.from_track || '(new)'} → ${r.to_track} (12mo ${r.payments_12m}회)`);
}

console.log(`\n✓ done in ${Date.now() - t0}ms`);
