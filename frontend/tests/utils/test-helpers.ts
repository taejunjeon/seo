import type { APIRequestContext } from "@playwright/test";

/**
 * Shared helpers for Phase A flow tests. Each helper is a thin wrapper around
 * the CRM backend REST API so flow tests don't hard-code fetch boilerplate.
 *
 * Intentionally does NOT send real SMS/alimtalk. All send operations use
 * testMode=Y or go through scheduled send in test_mode=true.
 */

export const API_BASE = "http://localhost:7020";
export const SAFE_TEST_PHONE = "01087418641";

export async function createTestGroup(request: APIRequestContext, name: string) {
  const res = await request.post(`${API_BASE}/api/crm-local/groups`, {
    data: { name, description: `phase-a-test · ${new Date().toISOString()}` },
  });
  const body = await res.json();
  return body.group?.group_id as string | undefined;
}

export async function deleteGroup(request: APIRequestContext, groupId: string) {
  await request.delete(`${API_BASE}/api/crm-local/groups/${groupId}`).catch(() => undefined);
}

export async function addMemberToGroup(
  request: APIRequestContext,
  groupId: string,
  phone: string,
  name = "test",
) {
  await request.post(`${API_BASE}/api/crm-local/groups/${groupId}/members`, {
    data: { members: [{ phone, name, member_code: `TEST_${Date.now()}` }] },
  });
}

export function isoInFuture(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}
