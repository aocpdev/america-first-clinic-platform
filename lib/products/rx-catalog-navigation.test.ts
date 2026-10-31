import test from "node:test";
import assert from "node:assert/strict";
import { legacyHomeCatalogDestination } from "./rx-catalog-navigation";
import { rxDestination } from "./rx-routing";

test("catalog routes and aliases stay inside RX without exposing internal routes", () => {
  for (const path of ["/catalog", "/rx/catalog", "/shop", "/products"]) {
    assert.equal(rxDestination("rx.govirtualhealth.com", path, true), "/rx/catalog");
    assert.equal(rxDestination("rx.govirtualhealth.com", path, false), "/rx/unavailable");
    assert.equal(rxDestination("portal.govirtualhealth.com", path, true), null);
  }
  assert.equal(rxDestination("rx.govirtualhealth.com", "/catalog/admin", true), "/rx/unavailable");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/", true), "/rx");
});

test("existing home filter URLs preserve search, category, page and referral values", () => {
  const destination = legacyHomeCatalogDestination({ q: "Tirzepatide", category: "weight", page: "2", ref: "original-agent" }, "/rx");
  assert.equal(destination, "/rx/catalog?q=Tirzepatide&category=weight&page=2&ref=original-agent#catalog");
  assert.equal(legacyHomeCatalogDestination({ q: "", category: "" }, ""), "/catalog?q=&category=#catalog");
});

test("plain home and referral entry are unchanged; redirect targets cannot come from queries", () => {
  assert.equal(legacyHomeCatalogDestination({}, "/rx"), null);
  assert.equal(legacyHomeCatalogDestination({ ref: "AF-EXAMPLE-CODE" }, "/rx"), null);
  assert.equal(legacyHomeCatalogDestination({ q: ["a", "b"], next: "https://example.com" }, ""), null);
  assert.equal(legacyHomeCatalogDestination({ q: "a&ref=other", next: "https://example.com" }, ""), "/catalog?q=a%26ref%3Dother#catalog");
});
