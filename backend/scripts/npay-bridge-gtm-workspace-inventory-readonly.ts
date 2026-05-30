#!/usr/bin/env tsx
/**
 * NPay bridge v1.2 작업 전 GTM workspace 상태 read-only 인벤토리.
 *
 * 목적: "v1.2 Preview workspace 를 새로 만들려면 기존 workspace 정리/업데이트가
 *       필요한가" 를 실제 GTM API 로 확인한다.
 *
 * Lane: Green / L1 read-only.
 *   - tagmanager.readonly scope 만 사용.
 *   - workspace/tag/trigger create/update/delete/submit/publish 없음.
 *   - quick_preview 없음.
 */
import path from "node:path";

import dotenv from "dotenv";
import { google } from "googleapis";

const repoRoot = path.resolve(__dirname, "..", "..");
dotenv.config({ path: path.resolve(repoRoot, "backend", ".env"), quiet: true });
dotenv.config({ path: path.resolve(repoRoot, ".env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PUBLIC_ID = "GTM-W2Z6PHN";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;

const getAuth = () => {
  const raw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim()
    || process.env.GSC_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY 또는 GSC_SERVICE_ACCOUNT_KEY가 필요합니다.");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/tagmanager.readonly"],
  });
};

const main = async () => {
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });

  const [container, liveVersion, workspaces] = await Promise.all([
    gtm.accounts.containers.get({ path: CONTAINER_PATH }),
    gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH }),
    gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH }),
  ]);

  const wsList = workspaces.data.workspace ?? [];

  // 각 workspace 의 tag 수와 npay-bridge 태그 존재 여부를 read-only 로 확인.
  const wsDetail = [];
  for (const ws of wsList) {
    if (!ws.path) continue;
    let tagCount = 0;
    let npayTagNames: string[] = [];
    try {
      const tags = await gtm.accounts.containers.workspaces.tags.list({ parent: ws.path });
      const tagList = tags.data.tag ?? [];
      tagCount = tagList.length;
      npayTagNames = tagList
        .map((t) => t.name ?? "")
        .filter((n) => /npay|bridge|v1[_-]?[12]/i.test(n));
    } catch (error) {
      npayTagNames = [`<tag list error: ${(error as Error).message}>`];
    }
    wsDetail.push({
      workspace_id: ws.workspaceId ?? "",
      name: ws.name ?? "",
      description: (ws.description ?? "").slice(0, 120),
      tag_count: tagCount,
      npay_or_bridge_tags: npayTagNames,
    });
  }

  const summary = {
    container_public_id: CONTAINER_PUBLIC_ID,
    container_name: container.data.name ?? "",
    usage_context: container.data.usageContext ?? [],
    live_version: {
      id: liveVersion.data.containerVersionId ?? "",
      name: liveVersion.data.name ?? "",
    },
    workspace_count: wsList.length,
    // GTM 무료 컨테이너는 workspace 3개 제한. 360 은 더 큼.
    free_tier_workspace_limit: 3,
    workspaces: wsDetail,
  };

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
