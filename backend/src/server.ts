import { createApp } from "./app";
import { env } from "./env";
import { startBackgroundJobs } from "./bootstrap/startBackgroundJobs";

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`SEO backend listening on http://localhost:${env.PORT}`);
  startBackgroundJobs();
});

void server;
