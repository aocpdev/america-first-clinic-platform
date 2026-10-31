import test from "node:test";
import assert from "node:assert/strict";
import { rxReviewInput } from "./rx-review-input";

test("review defaults to one item and accepts bounded intent", () => {
  assert.deepEqual(rxReviewInput({}), { quantity: 1, coupon: "", error: null });
  assert.deepEqual(rxReviewInput({ quantity: "3", coupon: " SAVE " }), { quantity: 3, coupon: "SAVE", error: null });
});
test("review rejects malformed, repeated and unbounded quantity or coupon parameters", () => {
  for (const quantity of ["0", "101", "1.5", "-1", "1e2", ["1", "2"]]) assert.ok(rxReviewInput({ quantity }).error);
  assert.ok(rxReviewInput({ coupon: "A".repeat(65) }).error);
  assert.ok(rxReviewInput({ coupon: ["A", "B"] }).error);
});
