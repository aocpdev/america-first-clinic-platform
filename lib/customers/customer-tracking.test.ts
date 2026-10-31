import { test } from "node:test";
import assert from "node:assert/strict";
import { carrierTrackingUrl, carrierLabel } from "../orders/tracking";

test("customer tracking reuses fulfillment carrier links", () => {
  for (const [carrier, host] of [["ups", "www.ups.com"], ["fedex", "www.fedex.com"], ["usps", "tools.usps.com"], ["dhl", "www.dhl.com"]]) {
    const link = new URL(carrierTrackingUrl(carrier, "SAMPLE-123")!);
    assert.equal(link.protocol, "https:");
    assert.equal(link.hostname, host);
    assert.ok([...link.searchParams.values()].includes("SAMPLE-123"));
  }
  assert.equal(carrierLabel("UPS"), "UPS");
});
test("missing or unknown carriers cannot produce an arbitrary tracking URL", () => {
  for (const carrier of [null, "other", "https://example.test", "javascript:alert(1)"]) assert.equal(carrierTrackingUrl(carrier, "123"), null);
  assert.equal(carrierTrackingUrl("ups", null), null);
  assert.equal(carrierTrackingUrl("ups", ""), null);
});
test("tracking numbers are query-encoded rather than interpreted as links", () => {
  const input = "123&redirect=https://example.test/#secret";
  const url = new URL(carrierTrackingUrl("ups", input)!);
  assert.equal(url.hostname, "www.ups.com");
  assert.equal(url.searchParams.get("tracknum"), input);
  assert.equal(url.searchParams.has("redirect"), false);
  assert.equal(url.hash, "");
});
