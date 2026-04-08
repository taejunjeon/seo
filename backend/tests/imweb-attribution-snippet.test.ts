import assert from "node:assert/strict";
import test from "node:test";

import { renderImwebPaymentSuccessSnippet } from "../src/imwebAttributionSnippet";

test("renderImwebPaymentSuccessSnippet includes GA identifier collection and live receiver payload", () => {
  const snippet = renderImwebPaymentSuccessSnippet({
    endpointBase: "https://att.example.com",
    source: "biocom_imweb",
    measurementIds: ["G-WJFXN5E2Q1", "G-8GZ48B1S59"],
  });

  assert.match(snippet, /shop_payment_complete/);
  assert.match(snippet, /api\/attribution\/payment-success/);
  assert.match(snippet, /window\.gtag\('get', measurementId, fieldName/);
  assert.match(snippet, /ga_session_id/);
  assert.match(snippet, /client_id/);
  assert.match(snippet, /user_pseudo_id/);
  assert.match(snippet, /client_id_fallback/);
  assert.match(snippet, /CONFIG\.measurementIds/);
  assert.match(snippet, /hasSentMarker\(dedupeKey\)/);
  assert.match(snippet, /rememberSent\(dedupeKey\)/);
  assert.match(snippet, /payment-success failed with/);
  assert.match(snippet, /credentials: 'omit'/);
  assert.doesNotMatch(snippet, /navigator\.sendBeacon/);
});

test("renderImwebPaymentSuccessSnippet requires at least one measurement id", () => {
  assert.throws(
    () =>
      renderImwebPaymentSuccessSnippet({
        endpointBase: "https://att.example.com",
        source: "biocom_imweb",
        measurementIds: [],
      }),
    /at least one measurementId is required/,
  );
});
