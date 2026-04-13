/**
 * JSON Schema definitions for CRM backend responses.
 *
 * These describe the *expected* shape of `/api/crm-local/*` endpoints so the
 * Phase A contract tests can detect when a backend change accidentally breaks
 * the frontend contract.
 *
 * Intentionally conservative: only the fields the frontend actually reads are
 * required. Extra fields are allowed (additionalProperties: true) so the
 * backend can add new fields without breaking contract tests.
 */

export const schemas = {
  groupsList: {
    type: "object",
    required: ["ok", "groups"],
    properties: {
      ok: { type: "boolean", const: true },
      groups: {
        type: "array",
        items: {
          type: "object",
          required: ["group_id", "name", "member_count"],
          properties: {
            group_id: { type: "string" },
            name: { type: "string" },
            description: { type: ["string", "null"] },
            member_count: { type: "integer", minimum: 0 },
            created_at: { type: "string" },
            updated_at: { type: "string" },
          },
        },
      },
    },
  },
  groupMembers: {
    type: "object",
    required: ["ok", "total", "members"],
    properties: {
      ok: { type: "boolean", const: true },
      total: { type: "integer", minimum: 0 },
      members: {
        type: "array",
        items: {
          type: "object",
          required: ["phone"],
          properties: {
            phone: { type: "string" },
            name: { type: ["string", "null"] },
            member_code: { type: ["string", "null"] },
            consent_sms: { type: "boolean" },
            added_at: { type: "string" },
          },
        },
      },
    },
  },
  scheduledSendCreate: {
    type: "object",
    required: ["ok", "id", "scheduledAt"],
    properties: {
      ok: { type: "boolean", const: true },
      id: { type: "integer", minimum: 1 },
      scheduledAt: { type: "string" },
    },
  },
  scheduledSendList: {
    type: "object",
    required: ["ok", "total", "rows"],
    properties: {
      ok: { type: "boolean", const: true },
      total: { type: "integer", minimum: 0 },
      rows: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "group_id", "channel", "scheduled_at", "status"],
          properties: {
            id: { type: "integer" },
            group_id: { type: "string" },
            channel: { type: "string", enum: ["alimtalk", "sms"] },
            template_code: { type: ["string", "null"] },
            subject: { type: ["string", "null"] },
            message: { type: "string" },
            scheduled_at: { type: "string" },
            status: {
              type: "string",
              enum: ["pending", "running", "success", "partial", "fail", "canceled"],
            },
            total_count: { type: "integer" },
            success_count: { type: "integer" },
            fail_count: { type: "integer" },
          },
        },
      },
    },
  },
  bulkUploadResult: {
    type: "object",
    required: ["ok"],
    properties: {
      ok: { type: "boolean" },
      total_rows: { type: "integer" },
      added: { type: "integer" },
      skipped_duplicate: { type: "integer" },
      skipped_invalid_phone: { type: "integer" },
      errors: {
        type: "array",
        items: {
          type: "object",
          required: ["row_index", "reason"],
          properties: {
            row_index: { type: "integer" },
            reason: { type: "string" },
          },
        },
      },
      error: { type: "string" },
    },
  },
  experimentFunnel: {
    type: "object",
    required: ["ok", "funnel", "rates", "variants"],
    properties: {
      ok: { type: "boolean", const: true },
      experiment: { type: ["object", "null"] },
      funnel: {
        type: "object",
        required: ["sent", "delivered", "visited", "purchased", "revenue"],
        properties: {
          sent: { type: "integer" },
          delivered: { type: "integer" },
          visited: { type: "integer" },
          purchased: { type: "integer" },
          revenue: { type: "number" },
        },
      },
      rates: {
        type: "object",
        required: ["delivery_rate", "visit_rate", "purchase_rate", "overall_rate"],
        properties: {
          delivery_rate: { type: "number" },
          visit_rate: { type: "number" },
          purchase_rate: { type: "number" },
          overall_rate: { type: "number" },
        },
      },
      variants: { type: "array" },
    },
  },
  consentAudit: {
    type: "object",
    required: ["ok", "total", "entries"],
    properties: {
      ok: { type: "boolean", const: true },
      total: { type: "integer", minimum: 0 },
      entries: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "member_code", "field", "source", "changed_at"],
          properties: {
            id: { type: "integer" },
            site: { type: "string" },
            member_code: { type: "string" },
            phone: { type: ["string", "null"] },
            field: { type: "string" },
            old_value: { type: ["string", "null"] },
            new_value: { type: ["string", "null"] },
            source: { type: "string" },
            changed_at: { type: "string" },
            note: { type: ["string", "null"] },
          },
        },
      },
    },
  },
} as const;

export type SchemaName = keyof typeof schemas;
