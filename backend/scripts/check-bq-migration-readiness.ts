import dotenv from "dotenv";
import path from "node:path";
import { JWT } from "google-auth-library";

dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });

// BigQuery 자체 프로젝트 이전 사전 점검 스크립트
// 2026-04-21 작성. data/bigquery_migration_plan_20260421.md §4 사전 작업 자동화.
// 점검 항목:
//   1. Service account 자체 정보 + 스코프
//   2. seo-aeo-487113 프로젝트 접근 가능 여부
//   3. BigQuery API 활성화 여부 (datasets.list 호출 시도)
//   4. 기존 우리 dataset 목록 (thecleancoffee 등)
//   5. 허들러스 dataset INFORMATION_SCHEMA 접근 가능 여부 (스키마 동등성 검증용)

type Report = {
  service_account: { client_email: string; project_id: string };
  own_project: {
    project_id: string;
    bq_api_active: boolean;
    bq_api_active_note: string;
    datasets: Array<{ datasetId: string; location?: string }>;
    iam_ok: boolean;
    iam_note: string;
  };
  hurdlers_project: {
    project_id: string;
    dataset_accessible: boolean;
    dataset_note: string;
    sample_tables: Array<{ tableId: string }>;
    schema_accessible: boolean;
    schema_column_count: number;
  };
  conclusions: string[];
};

const main = async () => {
  const raw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY missing");
  const sa = JSON.parse(raw);

  const client = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: [
      "https://www.googleapis.com/auth/bigquery",
      "https://www.googleapis.com/auth/bigquery.readonly",
      "https://www.googleapis.com/auth/cloud-platform.read-only",
    ],
  });
  const { token } = await client.getAccessToken();
  const H = { Authorization: `Bearer ${token}` };

  const report: Report = {
    service_account: { client_email: sa.client_email, project_id: sa.project_id },
    own_project: {
      project_id: "seo-aeo-487113",
      bq_api_active: false,
      bq_api_active_note: "",
      datasets: [],
      iam_ok: false,
      iam_note: "",
    },
    hurdlers_project: {
      project_id: "hurdlers-naver-pay",
      dataset_accessible: false,
      dataset_note: "",
      sample_tables: [],
      schema_accessible: false,
      schema_column_count: 0,
    },
    conclusions: [],
  };

  // 1) 자체 프로젝트 BQ API + datasets
  try {
    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${report.own_project.project_id}/datasets?maxResults=50`;
    const r = await fetch(url, { headers: H });
    if (r.ok) {
      report.own_project.bq_api_active = true;
      report.own_project.bq_api_active_note = `HTTP ${r.status} OK`;
      const body = await r.json();
      report.own_project.datasets = (body.datasets || []).map((d: any) => ({
        datasetId: d.datasetReference?.datasetId,
        location: d.location,
      }));
    } else {
      const text = await r.text();
      report.own_project.bq_api_active = false;
      report.own_project.bq_api_active_note = `HTTP ${r.status}: ${text.substring(0, 250)}`;
    }
  } catch (e: any) {
    report.own_project.bq_api_active_note = `ERR: ${e.message}`;
  }

  // 2) 자체 프로젝트 IAM — service account 자체 role 확인 (projects.getIamPolicy 필요)
  try {
    const url = `https://cloudresourcemanager.googleapis.com/v1/projects/${report.own_project.project_id}:getIamPolicy`;
    const r = await fetch(url, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: "{}" });
    if (r.ok) {
      const body = await r.json();
      const saBinding = (body.bindings || []).filter((b: any) =>
        (b.members || []).some((m: string) => m.includes(sa.client_email))
      );
      report.own_project.iam_ok = saBinding.length > 0;
      report.own_project.iam_note = saBinding.length > 0
        ? `roles: ${saBinding.map((b: any) => b.role).join(", ")}`
        : "service account not found in project IAM (may still work via dataset-level grants)";
    } else {
      const text = await r.text();
      report.own_project.iam_note = `HTTP ${r.status}: ${text.substring(0, 200)}`;
    }
  } catch (e: any) {
    report.own_project.iam_note = `ERR: ${e.message}`;
  }

  // 3) 허들러스 dataset 접근
  const hurdlersProject = report.hurdlers_project.project_id;
  const hurdlersDataset = "analytics_304759974";
  try {
    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${hurdlersProject}/datasets/${hurdlersDataset}/tables?maxResults=5`;
    const r = await fetch(url, { headers: H });
    if (r.ok) {
      report.hurdlers_project.dataset_accessible = true;
      report.hurdlers_project.dataset_note = `HTTP ${r.status} OK`;
      const body = await r.json();
      report.hurdlers_project.sample_tables = (body.tables || []).slice(0, 5).map((t: any) => ({
        tableId: t.tableReference?.tableId,
      }));
    } else {
      const text = await r.text();
      report.hurdlers_project.dataset_note = `HTTP ${r.status}: ${text.substring(0, 250)}`;
    }
  } catch (e: any) {
    report.hurdlers_project.dataset_note = `ERR: ${e.message}`;
  }

  // 4) 스키마 동등성 검증 준비 — INFORMATION_SCHEMA 접근 여부
  if (report.hurdlers_project.dataset_accessible) {
    try {
      const sql = `SELECT COUNT(*) AS column_count FROM \`${hurdlersProject}.${hurdlersDataset}\`.INFORMATION_SCHEMA.COLUMNS WHERE table_name LIKE 'events_%' LIMIT 1`;
      const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${report.service_account.project_id}/queries`;
      const r = await fetch(url, {
        method: "POST",
        headers: { ...H, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: sql,
          useLegacySql: false,
          location: "US",
        }),
      });
      if (r.ok) {
        const body = await r.json();
        if (body.rows && body.rows[0]) {
          report.hurdlers_project.schema_accessible = true;
          report.hurdlers_project.schema_column_count = Number(body.rows[0].f[0].v);
        } else {
          report.hurdlers_project.schema_accessible = true;
          report.hurdlers_project.schema_column_count = 0;
        }
      } else {
        const text = await r.text();
        report.hurdlers_project.schema_accessible = false;
        report.hurdlers_project.schema_column_count = 0;
        report.hurdlers_project.dataset_note += ` | schema query HTTP ${r.status}: ${text.substring(0, 200)}`;
      }
    } catch (e: any) {
      report.hurdlers_project.dataset_note += ` | schema ERR: ${e.message}`;
    }
  }

  // 5) 결론
  if (report.own_project.bq_api_active) {
    report.conclusions.push("✅ seo-aeo-487113 프로젝트에 BigQuery API 활성화됨");
  } else {
    report.conclusions.push(`❌ BQ API 비활성 또는 접근 거부: ${report.own_project.bq_api_active_note}`);
  }
  if (report.own_project.datasets.length > 0) {
    report.conclusions.push(`✅ 기존 dataset ${report.own_project.datasets.length}개 존재 (thecleancoffee 등 참조 구조 확인 가능)`);
  }
  if (report.hurdlers_project.dataset_accessible) {
    report.conclusions.push("✅ 허들러스 dataset list 접근 가능 (service account 권한 OK)");
    if (report.hurdlers_project.schema_accessible) {
      report.conclusions.push(`✅ 스키마 동등성 검증 가능 (INFORMATION_SCHEMA 쿼리 통과, ${report.hurdlers_project.schema_column_count} columns)`);
    } else {
      report.conclusions.push("⚠️ dataset list 는 되지만 쿼리 실행은 실패 — billing 또는 Job User 권한 확인 필요");
    }
  } else {
    report.conclusions.push(`❌ 허들러스 dataset 접근 불가: ${report.hurdlers_project.dataset_note}`);
  }

  const json = process.argv.includes("--json");
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("\nBigQuery 이전 사전 점검 — seo-aeo-487113 vs hurdlers-naver-pay");
    console.log("=".repeat(80));
    console.log(`\n● Service Account`);
    console.log(`  client_email: ${report.service_account.client_email}`);
    console.log(`  project_id  : ${report.service_account.project_id}`);

    console.log(`\n● 자체 프로젝트 seo-aeo-487113`);
    console.log(`  BigQuery API 활성화: ${report.own_project.bq_api_active ? "✅" : "❌"} (${report.own_project.bq_api_active_note})`);
    console.log(`  IAM service account role: ${report.own_project.iam_ok ? "✅" : "⚠️"} (${report.own_project.iam_note})`);
    console.log(`  기존 dataset (${report.own_project.datasets.length}개):`);
    for (const d of report.own_project.datasets.slice(0, 10)) {
      console.log(`    - ${d.datasetId}${d.location ? ` @ ${d.location}` : ""}`);
    }

    console.log(`\n● 허들러스 프로젝트 hurdlers-naver-pay (읽기 전용)`);
    console.log(`  dataset list: ${report.hurdlers_project.dataset_accessible ? "✅" : "❌"}`);
    console.log(`  note: ${report.hurdlers_project.dataset_note}`);
    if (report.hurdlers_project.sample_tables.length > 0) {
      console.log(`  샘플 테이블:`);
      for (const t of report.hurdlers_project.sample_tables) {
        console.log(`    - ${t.tableId}`);
      }
    }
    console.log(`  스키마 쿼리: ${report.hurdlers_project.schema_accessible ? "✅" : "❌"} (${report.hurdlers_project.schema_column_count} columns)`);

    console.log(`\n● 결론`);
    for (const c of report.conclusions) console.log(`  ${c}`);
    console.log("");
  }
};

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
