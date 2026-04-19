/**
 * 카카오톡 채널 고객파일(Target User File) API 클라이언트.
 *
 * 공식 문서: https://developers.kakao.com/docs/latest/ko/kakaotalk-channel/rest-api
 * devtalk 제약사항 확인: https://devtalk.kakao.com/t/api/127233
 *
 * 스키마 설계 주의:
 * - 기본 제공 String 키: 생년월일, 국가, 지역, 성별, 연령, 구매금액, 포인트, 가입일, 최근 구매일, 응모일
 * - 사용자 정의 필드는 숫자만 허용
 * - 앱유저아이디(user_id)는 예약 필드 — schema 대상 아님
 * - 전화번호로 친구 식별 시 user_type = "phone"
 */

import { env } from "./env";
import { exportGroupMembersForCsv, getCustomerGroup } from "./crmLocalDb";

const KAPI_BASE = "https://kapi.kakao.com";

// 기본 제공 String 키 집합 (devtalk.kakao.com/t/api/127233 확인)
const DEFAULT_STRING_KEYS = [
  "생년월일",
  "국가",
  "지역",
  "성별",
  "연령",
  "구매금액",
  "포인트",
  "가입일",
  "최근 구매일",
  "응모일",
] as const;

function resolveKakaoConfig(site: string): { adminKey: string; channelPublicId: string } {
  if (site === "thecleancoffee") {
    const adminKey = env.KAKAO_ADMIN_KEY_COFFEE;
    const channelPublicId = env.KAKAO_CHANNEL_PUBLIC_ID_COFFEE;
    if (!adminKey || !channelPublicId) {
      throw new Error(
        "thecleancoffee 카카오 설정 누락. .env 에 KAKAO_ADMIN_KEY_COFFEE, KAKAO_CHANNEL_PUBLIC_ID_COFFEE 를 추가하시오.",
      );
    }
    return { adminKey, channelPublicId };
  }
  if (site === "biocom") {
    const adminKey = env.KAKAO_ADMIN_KEY;
    const channelPublicId = env.KAKAO_CHANNEL_PUBLIC_ID_BIOCOM;
    if (!adminKey || !channelPublicId) {
      throw new Error(
        "biocom 카카오 설정 누락. .env 에 KAKAO_BIOCOM_Admin_KEY, KAKAO_CHANNEL_PUBLIC_ID_BIOCOM 을 추가하시오.",
      );
    }
    return { adminKey, channelPublicId };
  }
  throw new Error(`지원하지 않는 site: ${site}`);
}

function normalizePhoneForKakao(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  // 카카오 API는 82 국제번호 포맷 또는 010 로컬 포맷 모두 수용
  if (digits.startsWith("82")) return digits;
  if (digits.startsWith("0")) return `82${digits.slice(1)}`;
  return digits;
}

type KakaoUserPayload = {
  id: string; // user_type=phone이면 전화번호(8210...), user_type=app이면 앱 회원번호
  field: Record<string, string | number>; // 공식 스펙: "field" (field_data 아님)
};

function maskKakaoUser(user: KakaoUserPayload): KakaoUserPayload {
  const id = String(user.id ?? "");
  const maskedId = id.length <= 6 ? "***" : `${id.slice(0, 4)}***${id.slice(-2)}`;
  return { id: maskedId, field: user.field };
}

export type KakaoUploadResult = {
  ok: boolean;
  fileId?: string;
  created?: boolean; // 신규 생성인지 기존 파일 재사용인지
  totalUsers: number;
  addedUsers: number;
  schema: Record<string, "string" | "number">;
  errors?: Array<{ stage: string; message: string }>;
  debug?: {
    userSamples?: unknown[];
    updateResponses?: Array<{ status: number; body: string }>;
  };
};

/**
 * 고객파일 생성 API
 * POST https://kapi.kakao.com/v1/talkchannel/create/target_user_file
 *
 * @param schema — { "구매금액": "string", "지역": "string", ... }
 */
async function createTargetUserFile(
  adminKey: string,
  channelPublicId: string,
  fileName: string,
  schema: Record<string, "string" | "number">,
): Promise<{ fileId: string }> {
  const bodyJson = {
    channel_public_id: channelPublicId,
    file_name: fileName,
    schema,
  };

  console.log("[kakao create_target_user_file req]", JSON.stringify(bodyJson));

  const res = await fetch(`${KAPI_BASE}/v1/talkchannel/create/target_user_file`, {
    method: "POST",
    headers: {
      "Authorization": `KakaoAK ${adminKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyJson),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.log("[kakao create_target_user_file FAIL]", res.status, text);
    throw new Error(`카카오 고객파일 생성 실패 (${res.status}): ${text} | request=${JSON.stringify(bodyJson)}`);
  }
  const data = (await res.json()) as { file_id?: string | number; [k: string]: unknown };
  console.log("[kakao create_target_user_file OK]", data);
  if (!data.file_id) {
    throw new Error(`카카오 고객파일 생성 응답에 file_id 없음: ${JSON.stringify(data)}`);
  }
  return { fileId: String(data.file_id) };
}

/**
 * 고객파일에 사용자 추가
 * POST https://kapi.kakao.com/v1/talkchannel/update/target_users
 *
 * @param userType — "phone" | "app_user_id" | "kakao_account"
 */
async function updateTargetUsers(
  adminKey: string,
  channelPublicId: string,
  fileId: string,
  userType: "phone" | "app_user_id" | "kakao_account",
  users: KakaoUserPayload[],
): Promise<{ updated: number; responses: Array<{ status: number; body: string }> }> {
  // Kakao API batch 한도는 공식 명시되지 않음. 안전하게 500명씩 분할.
  const CHUNK = 500;
  let updated = 0;
  const responses: Array<{ status: number; body: string }> = [];
  for (let i = 0; i < users.length; i += CHUNK) {
    const chunk = users.slice(i, i + CHUNK);
    const bodyJson = {
      file_id: Number(fileId),
      channel_public_id: channelPublicId,
      user_type: userType,
      users: chunk,
    };

    console.log("[kakao update_target_users req sample]", JSON.stringify({
      file_id: bodyJson.file_id,
      channel_public_id: bodyJson.channel_public_id,
      user_type: bodyJson.user_type,
      users_count: chunk.length,
      users_sample: chunk.slice(0, 2).map(maskKakaoUser),
    }));

    const res = await fetch(`${KAPI_BASE}/v1/talkchannel/update/target_users`, {
      method: "POST",
      headers: {
        "Authorization": `KakaoAK ${adminKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyJson),
    });
    const responseText = await res.text().catch(() => "");
    console.log("[kakao update_target_users resp]", res.status, responseText);
    responses.push({ status: res.status, body: responseText });
    if (!res.ok) {
      throw new Error(`카카오 사용자 추가 실패 at chunk ${i / CHUNK + 1} (${res.status}): ${responseText}`);
    }
    // 응답 본문에 실제 추가된 건수가 있을 수 있음 — 파싱 시도
    try {
      const parsed = JSON.parse(responseText) as { updated_count?: number; added_count?: number; success_count?: number };
      const actual = parsed.updated_count ?? parsed.added_count ?? parsed.success_count;
      if (typeof actual === "number") {
        updated += actual;
      } else {
        updated += chunk.length;
      }
    } catch {
      updated += chunk.length;
    }
  }
  return { updated, responses };
}

/**
 * 그룹 멤버를 카카오톡 채널 고객파일로 업로드.
 *
 * sample.csv 포맷(앱유저아이디,이름,생년월일,지역,성별,연령,구매금액,포인트,멤버십등급,가입일,최근구매일,응모일)에서
 * 기본 제공 String 키 9개만 스키마 등록, 나머지는 카카오가 무시하거나 매핑 불가.
 *
 * @param groupId — crm_customer_groups.group_id
 * @param site — "thecleancoffee" | "biocom"
 * @param fileName — 파트너센터에 표시될 이름 (미지정 시 그룹명 사용)
 */
export async function uploadGroupToKakaoChannel(
  groupId: string,
  site: string,
  fileName?: string,
): Promise<KakaoUploadResult> {
  const group = getCustomerGroup(groupId);
  if (!group) {
    return {
      ok: false,
      totalUsers: 0,
      addedUsers: 0,
      schema: {},
      errors: [{ stage: "group_lookup", message: "그룹을 찾을 수 없음" }],
    };
  }

  const { adminKey, channelPublicId } = resolveKakaoConfig(site);

  const rows = exportGroupMembersForCsv(groupId);
  const totalUsers = rows.length;
  if (totalUsers === 0) {
    return {
      ok: false,
      totalUsers: 0,
      addedUsers: 0,
      schema: {},
      errors: [{ stage: "rows_empty", message: "그룹 멤버가 없음" }],
    };
  }

  // 카카오 기본 제공 String 키 스키마 구성.
  // sample.csv에 "최근구매일"이 있고 카카오 기본키는 "최근 구매일"(공백 포함)이므로 매핑 주의.
  const SAMPLE_TO_KAKAO: Record<string, (typeof DEFAULT_STRING_KEYS)[number]> = {
    생년월일: "생년월일",
    지역: "지역",
    성별: "성별",
    연령: "연령",
    구매금액: "구매금액",
    포인트: "포인트",
    가입일: "가입일",
    최근구매일: "최근 구매일",
    응모일: "응모일",
  };

  const schema: Record<string, "string" | "number"> = {};
  for (const kakaoKey of Object.values(SAMPLE_TO_KAKAO)) {
    schema[kakaoKey] = "string";
  }

  // 사용자 전화번호 수집 + 필드 매핑
  const users: KakaoUserPayload[] = [];
  // 식별자 결정: phone 우선 (user_type="phone"), 전화번호 없으면 스킵
  for (const row of rows) {
    // exportGroupMembersForCsv는 phone을 반환하지 않음 → 별도 조회 필요.
    // 대신 "앱유저아이디" 필드를 id로 쓰고 user_type="app_user_id" 로 업로드.
    // 이 경로는 카카오 SDK 로그인 연동된 앱 기반이라 우리 환경에 맞지 않음.
    // → phone을 가져오려면 crm_customer_group_members에서 직접 조회해야 함.
    const id = row.앱유저아이디;
    if (!id) continue;
    const field: Record<string, string> = {};
    for (const [sampleKey, kakaoKey] of Object.entries(SAMPLE_TO_KAKAO)) {
      const value = (row as unknown as Record<string, string>)[sampleKey];
      if (value && value.trim() !== "") {
        field[kakaoKey] = value;
      }
    }
    users.push({ id, field });
  }

  // 전화번호 기반 업로드가 우리 데이터에 더 적합하므로,
  // listGroupMembers로 phone을 가져와 별도 매핑.
  const { getCrmDb } = await import("./crmLocalDb");
  const db = getCrmDb();
  const phoneRows = db.prepare(`
    SELECT phone, member_code FROM crm_customer_group_members WHERE group_id = ?
  `).all(groupId) as Array<{ phone: string; member_code: string | null }>;
  const phoneByMember = new Map<string, string>();
  for (const r of phoneRows) {
    if (r.phone) phoneByMember.set(String(r.member_code ?? r.phone), normalizePhoneForKakao(r.phone));
  }

  const phoneUsers: KakaoUserPayload[] = [];
  for (const u of users) {
    const phone = phoneByMember.get(u.id);
    if (!phone) continue;
    phoneUsers.push({ id: phone, field: u.field });
  }

  if (phoneUsers.length === 0) {
    return {
      ok: false,
      totalUsers,
      addedUsers: 0,
      schema,
      errors: [{ stage: "phone_map", message: "매핑된 전화번호가 없음" }],
    };
  }

  const errors: Array<{ stage: string; message: string }> = [];
  let fileId: string | undefined;
  try {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const safeName = (fileName ?? group.name ?? groupId).slice(0, 40);
    const { fileId: createdId } = await createTargetUserFile(
      adminKey,
      channelPublicId,
      `${safeName}_${stamp}`,
      schema,
    );
    fileId = createdId;
  } catch (err) {
    errors.push({ stage: "create_file", message: err instanceof Error ? err.message : String(err) });
    return { ok: false, totalUsers, addedUsers: 0, schema, errors };
  }

  let added = 0;
  let updateResponses: Array<{ status: number; body: string }> = [];
  try {
    const result = await updateTargetUsers(adminKey, channelPublicId, fileId, "phone", phoneUsers);
    added = result.updated;
    updateResponses = result.responses;
  } catch (err) {
    errors.push({ stage: "update_users", message: err instanceof Error ? err.message : String(err) });
    return { ok: false, totalUsers, addedUsers: 0, fileId, schema, errors };
  }

  return {
    ok: true,
    fileId,
    created: true,
    totalUsers,
    addedUsers: added,
    schema,
    debug: {
      userSamples: phoneUsers.slice(0, 3).map(maskKakaoUser),
      updateResponses,
    },
  };
}
