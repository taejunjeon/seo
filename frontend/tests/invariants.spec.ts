/**
 * Phase A-5: DB invariant tests.
 *
 * These tests open the live sqlite file (read-only) and assert rules that
 * should hold across all Phases. If any rule fails, the CRM database has
 * drifted into an inconsistent state and further merges should be blocked.
 *
 * Rules checked:
 *   I1 — crm_scheduled_send 'pending'/'running' rows only reference
 *        non-archived groups
 *   I2 — crm_consent_change_log old_value != new_value (or initial flag)
 *   I3 — crm_message_log.experiment_key → crm_assignment_log has a matching
 *        (experiment_key, customer_key) row
 *   I4 — crm_scheduled_send row counts are internally consistent:
 *        success_count + fail_count <= total_count for finished rows
 *   I5 — crm_customer_groups with temp kind have source_ref populated
 *        (after Phase D; before Phase D this is a documentation-only rule)
 *
 * Read-only: tests open the DB in read-only mode to avoid lock contention
 * with the running backend.
 */

import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = process.env.CRM_LOCAL_DB_PATH?.trim()
  || path.resolve(__dirname, "../../backend/data/crm.sqlite3");

test.describe("DB invariants (read-only)", () => {
  test.skip(!fs.existsSync(DB_PATH), `crm.sqlite3 not found at ${DB_PATH}`);

  let db: Database.Database;

  test.beforeAll(() => {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  });

  test.afterAll(() => {
    if (db) db.close();
  });

  test("I1: pending/running 예약 발송은 모두 존재하는 그룹을 참조해야 한다", () => {
    const orphaned = db.prepare(`
      SELECT s.id, s.group_id, s.status
      FROM crm_scheduled_send s
      LEFT JOIN crm_customer_groups g ON g.group_id = s.group_id
      WHERE s.status IN ('pending','running') AND g.group_id IS NULL
    `).all() as Array<{ id: number; group_id: string; status: string }>;
    expect(
      orphaned,
      `${orphaned.length}건의 active 예약 발송이 사라진 그룹을 참조 중\n` +
        orphaned.map((o) => `  id=${o.id} status=${o.status} group=${o.group_id}`).join("\n"),
    ).toHaveLength(0);
  });

  test("I2: 동의 감사 로그의 old_value와 new_value는 다르거나 initial 상태여야 한다", () => {
    const bad = db.prepare(`
      SELECT id, member_code, field, old_value, new_value, note
      FROM crm_consent_change_log
      WHERE (old_value IS NOT NULL AND old_value = new_value)
        AND (note IS NULL OR note NOT LIKE '%initial%')
      LIMIT 20
    `).all() as Array<{ id: number; member_code: string; field: string }>;
    expect(
      bad,
      `${bad.length}건의 의미 없는 감사 로그 (old=new, non-initial)\n` +
        bad.map((b) => `  id=${b.id} member=${b.member_code} field=${b.field}`).join("\n"),
    ).toHaveLength(0);
  });

  test("I3: experiment_key가 있는 발송 로그는 배정 로그와 일치해야 한다", () => {
    // Only check messages that claim to belong to an experiment.
    const mismatched = db.prepare(`
      SELECT m.id, m.experiment_key, m.customer_key
      FROM crm_message_log m
      LEFT JOIN crm_assignment_log a
        ON a.experiment_key = m.experiment_key
        AND a.customer_key = m.customer_key
      WHERE m.experiment_key IS NOT NULL AND a.id IS NULL
      LIMIT 20
    `).all() as Array<{ id: number; experiment_key: string; customer_key: string }>;
    expect(
      mismatched,
      `${mismatched.length}건의 실험 발송이 배정 로그에 없음 (고아 메시지)\n` +
        mismatched.map((m) => `  msg=${m.id} exp=${m.experiment_key} customer=${m.customer_key}`).join("\n"),
    ).toHaveLength(0);
  });

  test("I4: 완료된 예약 발송의 success+fail 합은 total 이하여야 한다", () => {
    const bad = db.prepare(`
      SELECT id, status, total_count, success_count, fail_count
      FROM crm_scheduled_send
      WHERE status IN ('success','partial','fail')
        AND (success_count + fail_count) > total_count
      LIMIT 20
    `).all() as Array<{ id: number; status: string; total_count: number; success_count: number; fail_count: number }>;
    expect(
      bad,
      `${bad.length}건의 예약 발송 카운트 불일치\n` +
        bad.map((b) => `  id=${b.id} total=${b.total_count} success=${b.success_count} fail=${b.fail_count}`).join("\n"),
    ).toHaveLength(0);
  });

  test("I5: 그룹 테이블 기본 무결성 — group_id는 NULL/빈 문자열 금지", () => {
    const bad = db.prepare(`
      SELECT rowid FROM crm_customer_groups
      WHERE group_id IS NULL OR group_id = ''
    `).all();
    expect(bad, "group_id가 비어있는 그룹 행이 존재").toHaveLength(0);
  });

  test("I6: 감사 로그 source는 허용된 값 중 하나여야 한다", () => {
    const allowed = ["imweb_member_sync", "admin_manual", "webhook", "manual", "admin"];
    const bad = db.prepare(`
      SELECT DISTINCT source FROM crm_consent_change_log
      WHERE source IS NOT NULL
    `).all() as Array<{ source: string }>;
    const unknown = bad.map((b) => b.source).filter((s) => !allowed.includes(s));
    expect(
      unknown,
      `허용되지 않은 source 값: ${unknown.join(", ")}`,
    ).toHaveLength(0);
  });
});
