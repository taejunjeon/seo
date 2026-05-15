/**
 * payment-decision latency 측정용 in-memory ring buffer.
 *
 * 목적: GET /api/attribution/payment-decision 의 응답 시간(ms) 과 status 를
 * 일정 기간 모아두고, funnel-health 응답에서 p50/p95 + status 분포로 제공.
 *
 * 한계: 메모리에만 보관 → backend restart 시 reset. window 보다 오래된 row 는
 * 자동 폐기. ring buffer 크기를 넘으면 가장 오래된 row 부터 덮어씀.
 */

export type PaymentDecisionStatus = "confirmed" | "pending" | "canceled" | "unknown";
export type PaymentDecisionBrowserAction =
  | "allow_purchase"
  | "block_purchase_virtual_account"
  | "block_purchase"
  | "hold_or_block_purchase";

export type PaymentDecisionRecord = {
  receivedAtMs: number;
  elapsedMs: number;
  status: PaymentDecisionStatus | string;
  browserAction: PaymentDecisionBrowserAction | string;
};

const RING_CAPACITY = 5000;
let buffer: PaymentDecisionRecord[] = [];

export const recordPaymentDecisionMeasurement = (record: PaymentDecisionRecord): void => {
  buffer.push(record);
  if (buffer.length > RING_CAPACITY) {
    buffer = buffer.slice(buffer.length - RING_CAPACITY);
  }
};

export const readPaymentDecisionMeasurements = (windowStartMs: number, windowEndMs: number): PaymentDecisionRecord[] => {
  return buffer.filter((r) => r.receivedAtMs >= windowStartMs && r.receivedAtMs <= windowEndMs);
};

export const getPaymentDecisionBufferSize = (): number => buffer.length;
