import assert from "node:assert/strict";
import test from "node:test";

import { auditLiveGa4Html, buildLiveGa4RiskRows } from "../src/utils/ga4ImplementationAudit";

const sampleHtml = `
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];})(window,document,'script','dataLayer','GTM-W7VXS4D8');</script>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-8GZ48B1S59"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-8GZ48B1S59');
</script>
<script>(function(w,d,s,l,i){w[l]=w[l]||[];})(window,document,'script','dataLayer','GTM-W2Z6PHN');</script>
<script>
function waitForGtagAndSetUser() {
  if (typeof gtag !== 'undefined') {
    const userID = getUserID();
    if (userID) {
      gtag('set', { user_id: userID });
    }
  }
}
waitForGtagAndSetUser();
(function persistUtm() {
  const userID = getUserID();
  if (userID) {
    const params = new URLSearchParams(location.search);
    const utm = {
      utm_campaign: params.get('utm_campaign') || '0',
      utm_source: params.get('utm_source') || '0',
      utm_medium: params.get('utm_medium') || '0',
      utm_content: params.get('utm_content') || '0',
      user_id: userID,
    };
    localStorage.setItem('rebuyz_utm', JSON.stringify(utm));
  }
})();
// gtag('event', 'view_item', {
//   userID,
// });
gtag('event', 'rebuyz_view', { userID: 'abc' });
</script>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W2Z6PHN"></iframe></noscript>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W7VXS4D8"></iframe></noscript>
`;

test("ga4 implementation audit detects duplicate tag surfaces and risky custom script choices", () => {
  const audit = auditLiveGa4Html(sampleHtml);

  assert.deepEqual(audit.measurementIds, ["G-8GZ48B1S59"]);
  assert.deepEqual(audit.gtmContainerIds, ["GTM-W2Z6PHN", "GTM-W7VXS4D8"]);
  assert.equal(audit.flags.hasDirectGtag, true);
  assert.equal(audit.flags.hasMultipleGtmContainers, true);
  assert.equal(audit.flags.hasUserIdSetter, true);
  assert.equal(audit.flags.utmPersistenceRequiresUserId, true);
  assert.equal(audit.flags.utmStoresZeroStringFallback, true);
  assert.equal(audit.flags.hasRebuyzViewEvent, true);
  assert.equal(audit.flags.hasStandardViewItemEvent, false);
  assert.equal(audit.flags.hasCommentedOutViewItem, true);
  assert.ok(audit.evidence.rebuyzView.some((hit) => hit.text.includes("rebuyz_view")));
});

test("ga4 implementation audit builds actionable risk rows", () => {
  const rows = buildLiveGa4RiskRows(auditLiveGa4Html(sampleHtml));

  assert.ok(rows.some((row) => row.codeType === "direct gtag" && row.identifier === "G-8GZ48B1S59"));
  assert.ok(rows.some((row) => row.codeType === "GTM snippet" && row.identifier === "GTM-W7VXS4D8"));
  assert.ok(rows.some((row) => row.codeType === "UTM persistence" && row.identifier === "rebuyz_utm"));
  assert.ok(rows.some((row) => row.codeType === "custom event / ecommerce" && row.identifier === "rebuyz_view"));
});
