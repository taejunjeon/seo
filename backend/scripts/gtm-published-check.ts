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

  const containerPath = "accounts/4703003246/containers/13158774";

  // 1) latest version header
  const latest = await gtm.accounts.containers.version_headers.latest({ parent: containerPath });
  const versionId = latest.data.containerVersionId;
  console.log(`published version: ${versionId} (${latest.data.name})`);

  // 2) fetch full published version
  const ver = await gtm.accounts.containers.versions.get({
    path: `${containerPath}/versions/${versionId}`,
  });

  // Tag 133 = HURDLERS - [데이터레이어] 상세페이지 조회
  const tags = (ver.data.tag ?? []) as any[];
  const tag133 = tags.find((t) => t.tagId === "133");
  if (!tag133) {
    console.log("Tag 133 NOT FOUND in published version");
    console.log("all HURDLERS 데이터레이어 tags present in published:");
    for (const t of tags) {
      if (t.name && t.name.includes("HURDLERS") && t.name.includes("데이터레이어")) {
        console.log(`  ${t.tagId}: ${t.name} paused=${t.paused ?? false}`);
      }
    }
  } else {
    console.log("Tag 133 FOUND:", tag133.name, "paused=", tag133.paused ?? false);
    console.log("firing triggers:", tag133.firingTriggerId);
  }

  // Variable 116 = HURDLERS - [맞춤 JS] 상세페이지 확인
  const vars = (ver.data.variable ?? []) as any[];
  const var116 = vars.find((v) => v.variableId === "116");
  if (!var116) {
    console.log("\nVariable 116 NOT FOUND in published version");
  } else {
    console.log("\nVariable 116:", var116.name);
    for (const p of var116.parameter ?? []) {
      if (p.key === "javascript") {
        console.log("javascript:\n" + p.value);
      }
    }
  }

  // Trigger 130
  const trigs = (ver.data.trigger ?? []) as any[];
  const trig130 = trigs.find((t) => t.triggerId === "130");
  if (!trig130) {
    console.log("\nTrigger 130 NOT FOUND in published version");
  } else {
    console.log("\nTrigger 130:", trig130.name, "type:", trig130.type);
    if (trig130.filter) {
      console.log("filter:", JSON.stringify(trig130.filter, null, 2).slice(0, 1000));
    }
  }
};

main().catch((e) => { console.error(e); process.exit(1); });
