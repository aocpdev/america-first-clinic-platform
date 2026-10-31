import test from "node:test";
import assert from "node:assert/strict";
import { rxDestination, rxPageNumber } from "./rx-routing";

test("RX root serves the store while portal, public and local hosts stay unchanged", () => {
  assert.equal(rxDestination("rx.govirtualhealth.com", "/", true), "/rx");
  for (const host of [undefined, "portal.govirtualhealth.com", "govirtualhealth.com", "www.govirtualhealth.com", "localhost:3008", "rx.govirtualhealth.com.evil.test"]) {
    assert.equal(rxDestination(host, "/", true), null);
  }
});
test("RX customer entry is separate from the internal login and stays gated", () => {
  assert.equal(rxDestination("rx.govirtualhealth.com", "/login", true), "/rx/login");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/rx/login", true), "/rx/login");
  assert.equal(rxDestination("portal.govirtualhealth.com", "/login", true), null);
  assert.equal(rxDestination("rx.govirtualhealth.com", "/login", false), "/rx/unavailable");
});

test("shop privacy and terms stay on the RX domain without exposing other portal pages", () => {
  for (const route of ["privacy-policy", "terms-of-service"]) {
    assert.equal(rxDestination("rx.govirtualhealth.com", `/${route}`, true), `/rx/${route}`);
    assert.equal(rxDestination("rx.govirtualhealth.com", `/rx/${route}`, true), `/rx/${route}`);
    assert.equal(rxDestination("portal.govirtualhealth.com", `/${route}`, true), null);
  }
});
test("cart and preview checkout are RX-only routes behind the store gate", () => {
  for (const path of ["/cart", "/checkout"]) {
    assert.equal(rxDestination("rx.govirtualhealth.com", path, true), `/rx${path}`);
    assert.equal(rxDestination("rx.govirtualhealth.com", `/rx${path}`, true), `/rx${path}`);
    assert.equal(rxDestination("rx.govirtualhealth.com", path, false), "/rx/unavailable");
    assert.equal(rxDestination("portal.govirtualhealth.com", path, true), null);
  }
});
test("selection review stays inside RX without enabling legacy checkout", () => {
  assert.equal(rxDestination("rx.govirtualhealth.com", "/review/wellness", true), "/rx/review/wellness");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/rx/review/wellness", true), "/rx/review/wellness");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/checkout", true), "/rx/checkout");
});
test("reserved shop links and clean product links reach the same RX product", () => {
  assert.equal(rxDestination("rx.govirtualhealth.com", "/shop/wellness", true), "/rx/products/wellness");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/products/wellness", true), "/rx/products/wellness");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/rx/products/wellness", true), "/rx/products/wellness");
});
test("RX disabled and unrelated CRM/API routes cannot expose internal pages", () => {
  assert.equal(rxDestination("rx.govirtualhealth.com", "/", false), "/rx/unavailable");
  for (const path of ["/admin/orders", "/affiliates/products", "/api/orders", "/checkout/pay", "/products/a/secret"]) {
    assert.equal(rxDestination("rx.govirtualhealth.com", path, true), "/rx/unavailable");
  }
});
test("affiliate recruitment page is public on RX, not the private workspace", () => {
  assert.equal(rxDestination("rx.govirtualhealth.com", "/affiliates", true), "/rx/affiliates");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/rx/affiliates", true), "/rx/affiliates");
  assert.equal(rxDestination("portal.govirtualhealth.com", "/affiliates", true), null);
  assert.equal(rxDestination("rx.govirtualhealth.com", "/affiliates", false), "/rx/unavailable");
});
test("framework assets are not rewritten into the catalog", () => {
  assert.equal(rxDestination("rx.govirtualhealth.com", "/_next/image", true), "/_next/image");
});
test("pagination is bounded for empty catalogs and malformed query values", () => {
  for (const value of [undefined, "-1", "0", "1.1", "NaN", "999999999"]) assert.equal(rxPageNumber(value, 4), 1);
  assert.equal(rxPageNumber("999", 4), 4);
  assert.equal(rxPageNumber("2", 4), 2);
  assert.equal(rxPageNumber("2", 0), 1);
});
test("RX account stays isolated from internal account routes", () => {
  assert.equal(rxDestination("rx.govirtualhealth.com", "/account", true), "/rx/account");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/rx/account", true), "/rx/account");
  assert.equal(rxDestination("portal.govirtualhealth.com", "/account", true), null);
});
test("private order detail routes remain inside RX", () => {
  assert.equal(rxDestination("rx.govirtualhealth.com", "/account/orders/example", true), "/rx/account/orders/example");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/rx/account/orders/example", true), "/rx/account/orders/example");
  assert.equal(rxDestination("portal.govirtualhealth.com", "/account/orders/example", true), null);
  assert.equal(rxDestination("rx.govirtualhealth.com", "/account/orders/example/notes", true), "/rx/unavailable");
});
