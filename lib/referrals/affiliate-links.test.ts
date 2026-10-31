import test from "node:test";
import assert from "node:assert/strict";
import { buildAffiliateRxLink, affiliateProductImageSource } from "./affiliate-links";

test("shop and product links use the same affiliate code and fixed RX origin", () => {
  assert.equal(buildAffiliateRxLink("AF-ABC123"), "https://rx.govirtualhealth.com/referral?ref=AF-ABC123");
  assert.equal(buildAffiliateRxLink("AF-ABC123", "wellness-program"), "https://rx.govirtualhealth.com/referral?ref=AF-ABC123&product=wellness-program");
});
test("local test links cannot redirect to arbitrary hosts", () => {
  assert.equal(buildAffiliateRxLink("AF-ABC123", undefined, "http://127.0.0.1:3008/rx"), "http://127.0.0.1:3008/rx/referral?ref=AF-ABC123");
  for (const base of ["https://evil.test", "http://127.0.0.1:3008/rx/../admin", "https://rx.govirtualhealth.com"]) assert.throws(() => buildAffiliateRxLink("AF-ABC123", undefined, base));
});
test("URL inputs cannot change destination or inject a second attribution", () => {
  for (const code of ["", "AF-X&ref=other", "https://example.com"]) assert.throws(() => buildAffiliateRxLink(code));
  for (const slug of ["../checkout", "https://example.com", "slug?ref=other", "//example.com", ""]) assert.throws(() => buildAffiliateRxLink("AF-ABC123", slug));
});
test("admin image URLs allow local assets and HTTPS, not scripts or protocol-relative URLs", () => {
  assert.equal(affiliateProductImageSource("/product.png"), "/product.png");
  assert.equal(affiliateProductImageSource("https://images.example.com/product.png"), "https://images.example.com/product.png");
  for (const src of [null, "javascript:alert(1)", "//example.com/image", "http://example.com/image", "https://user:pass@example.com/image", "/\\example.com/image"]) assert.equal(affiliateProductImageSource(src), null);
});
