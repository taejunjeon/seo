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
      max_memory_restart: "700M",
      env: {
        NODE_ENV: "production",
        PORT: "7020",
        TRUST_PROXY: "1",
      },
      error_file: `${appRoot}/shared/backend-logs/pm2-error.log`,
      out_file: `${appRoot}/shared/backend-logs/pm2-out.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
