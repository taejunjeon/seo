const appRoot = process.env.APP_ROOT || "/opt/seo";

module.exports = {
  apps: [
    {
      name: "seo-backend",
      cwd: `${appRoot}/repo/backend`,
      script: "dist/server.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "3000M",
      env: {
        NODE_ENV: "production",
        PORT: "7020",
        TRUST_PROXY: "1",
        LEADING_INDICATORS_PRECOMPUTE_ENABLED: "1",
        LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS: "1800000",
        FUNNEL_HEALTH_PRECOMPUTE_ENABLED: "0",
        CALLPRICE_PRECOMPUTE_ENABLED: "0",
        ROAS_SUMMARY_PRECOMPUTE_ENABLED: "0",
        META_UTM_DIAGNOSTICS_PRECOMPUTE_ENABLED: "1",
        META_UTM_DIAGNOSTICS_PRECOMPUTE_INTERVAL_MS: "720000",
        META_UTM_DIAGNOSTICS_PRECOMPUTE_START_DELAY_MS: "30000",
        META_UTM_DIAGNOSTICS_PRECOMPUTE_TARGETS: "act_3138805896402376",
        META_UTM_DIAGNOSTICS_PRECOMPUTE_PRESETS: "last_7d",
        ADS_OPERATIONAL_LEDGER_DIRECT_SQLITE: "1",
      },
      error_file: `${appRoot}/shared/backend-logs/pm2-error.log`,
      out_file: `${appRoot}/shared/backend-logs/pm2-out.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
    {
      // Next.js 프로덕션 서버 (/coffeevip 공유용)
      // 빌드 산출물(.next) 은 VM 에서 `npm run build` 로 생성
      name: "seo-frontend",
      cwd: `${appRoot}/repo/frontend`,
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3001",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "700M",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
      error_file: `${appRoot}/shared/frontend-logs/pm2-error.log`,
      out_file: `${appRoot}/shared/frontend-logs/pm2-out.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
