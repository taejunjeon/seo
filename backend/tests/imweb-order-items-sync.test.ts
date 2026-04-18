import assert from "node:assert/strict";
import test from "node:test";

import { _internal_parseOrderNoAndLine } from "../src/imwebOrderItemsSync";

test("parseOrderNoAndLine: space + line suffix pattern", () => {
  const r = _internal_parseOrderNoAndLine("202604177160627 202604177160627-002");
  assert.equal(r.orderNo, "202604177160627");
  assert.equal(r.lineNo, "002");
});

test("parseOrderNoAndLine: single form without suffix", () => {
  const r = _internal_parseOrderNoAndLine("202604158382115");
  assert.equal(r.orderNo, "202604158382115");
  assert.equal(r.lineNo, "");
});

test("parseOrderNoAndLine: line suffix only, no space", () => {
  const r = _internal_parseOrderNoAndLine("202604177486980-001");
  assert.equal(r.orderNo, "202604177486980");
  assert.equal(r.lineNo, "001");
});

test("parseOrderNoAndLine: null or blank", () => {
  assert.deepEqual(_internal_parseOrderNoAndLine(null), { orderNo: "", lineNo: "" });
  assert.deepEqual(_internal_parseOrderNoAndLine("  "), { orderNo: "", lineNo: "" });
});

test("parseOrderNoAndLine: non-numeric head falls through", () => {
  const r = _internal_parseOrderNoAndLine("ABC123 ABC123-009");
  // 숫자 prefix가 없어 head 전체를 order_no 로 받고, suffix 는 정상 인식
  assert.equal(r.orderNo, "ABC123");
  assert.equal(r.lineNo, "009");
});
