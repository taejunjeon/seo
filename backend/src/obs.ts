import pino from "pino";

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "crm-hub" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

type EventFields = {
  event: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
};

export const log = {
  info(fields: EventFields) {
    baseLogger.info(fields, fields.event);
  },
  warn(fields: EventFields) {
    baseLogger.warn(fields, fields.event);
  },
  error(fields: EventFields & { error?: unknown }) {
    const err = fields.error;
    const errDetails = err instanceof Error
      ? { err_name: err.name, err_message: err.message, err_stack: err.stack }
      : err !== undefined ? { err_raw: String(err) } : {};
    baseLogger.error({ ...fields, ...errDetails }, fields.event);
  },
  child(bindings: Record<string, unknown>) {
    const sub = baseLogger.child(bindings);
    return {
      info: (fields: EventFields) => sub.info(fields, fields.event),
      warn: (fields: EventFields) => sub.warn(fields, fields.event),
      error: (fields: EventFields) => sub.error(fields, fields.event),
    };
  },
};

export const obsEvents = {
  aligoSendAttempt: "aligo_send_attempt",
  aligoSendResult: "aligo_send_result",
  contactPolicyDecision: "contact_policy_decision",
  scheduledSendClaim: "scheduled_send_claim",
  scheduledSendComplete: "scheduled_send_complete",
  bulkUploadComplete: "bulk_upload_complete",
  consentChangeLogged: "consent_change_logged",
  experimentFunnelRequest: "experiment_funnel_request",
} as const;
