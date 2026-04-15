import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const main = async () => {
  const key = JSON.parse(process.env.GSC_SERVICE_ACCOUNT_KEY ?? "{}");
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/tagmanager.readonly"],
  });
  const gtm = google.tagmanager({ version: "v2", auth });

  console.log("# service account:", key.client_email);

  const accounts = await gtm.accounts.list({});
  console.log("\n# accounts.list raw:");
  console.log(JSON.stringify(accounts.data, null, 2));

  for (const account of accounts.data.account ?? []) {
    console.log(`\n# containers.list parent=${account.path}`);
    try {
      const c = await gtm.accounts.containers.list({ parent: account.path! });
      console.log(JSON.stringify(c.data, null, 2));
    } catch (err) {
      console.log("  ERROR:", (err as Error).message);
    }

    console.log(`\n# user_permissions.list parent=${account.path}`);
    try {
      const u = await gtm.accounts.user_permissions.list({ parent: account.path! });
      const perms = (u.data.userPermission ?? []).filter((p) =>
        (p.emailAddress ?? "").includes("seo-656"),
      );
      console.log(JSON.stringify(perms, null, 2));
    } catch (err) {
      console.log("  ERROR:", (err as Error).message);
    }
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
