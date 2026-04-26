import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { AIBIO_ATTRIBUTION_KEYS } from "@/lib/aibio-native";

type LeadDraftPayload = {
  name?: unknown;
  phone?: unknown;
  ageRange?: unknown;
  purpose?: unknown;
  channel?: unknown;
  preferredTime?: unknown;
  consent?: unknown;
  landingPath?: unknown;
  attribution?: unknown;
};

const ATTRIBUTION_ALLOWLIST = new Set<string>(AIBIO_ATTRIBUTION_KEYS);

const REQUIRED_FIELDS: Array<keyof LeadDraftPayload> = [
  "name",
  "phone",
  "ageRange",
  "purpose",
  "channel",
  "preferredTime",
];

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: unknown) {
  return normalizeText(value).replace(/[^0-9]/g, "");
}

function hashPhone(phoneDigits: string) {
  return createHash("sha256").update(phoneDigits).digest("hex");
}

function pickAttribution(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!ATTRIBUTION_ALLOWLIST.has(key)) continue;
    const text = normalizeText(raw);
    if (!text) continue;
    result[key] = text.slice(0, 512);
  }
  return result;
}

export async function POST(request: NextRequest) {
  let payload: LeadDraftPayload;

  try {
    payload = (await request.json()) as LeadDraftPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const missing = REQUIRED_FIELDS.filter((field) => !normalizeText(payload[field]));
  const phoneDigits = normalizePhone(payload.phone);

  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    missing.push("phone");
  }

  if (payload.consent !== true) {
    missing.push("consent");
  }

  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_required_fields",
        missing: Array.from(new Set(missing)),
      },
      { status: 422 },
    );
  }

  const receivedAt = new Date().toISOString();
  const phoneHash = hashPhone(phoneDigits);
  const leadId = `aibio_native_${receivedAt.replace(/[-:.TZ]/g, "")}_${phoneHash.slice(0, 10)}`;
  const attribution = pickAttribution(payload.attribution);

  return NextResponse.json({
    ok: true,
    mode: "dry_run_no_persistence",
    leadId,
    phoneHashSha256: phoneHash,
    receivedAt,
    nextStatus: "needs_operator_follow_up",
    attributionKeys: Object.keys(attribution).sort(),
    storedFields: {
      name: false,
      phoneRaw: false,
      phoneHashSha256: true,
      ageRange: true,
      purpose: true,
      channel: true,
      preferredTime: true,
      consent: true,
      landingPath: normalizeText(payload.landingPath) || "/aibio-native",
      attribution: true,
    },
  });
}
