import test from "node:test";
import assert from "node:assert/strict";
import { weightLossCatalogWhere, isWeightLossCategory } from "./rx-weight-loss";
import { rxDestination } from "./rx-routing";

test("weight-loss collection uses explicit Admin categories, active products and matching tenant", () => {
  assert.deepEqual(weightLossCatalogWhere("tenant-a"), { companyId: "tenant-a", active: true, category: { companyId: "tenant-a", name: { in: ["Weight Loss", "Weight Loss (GLP-1 & Metabolic)"] } } });
  assert.equal(isWeightLossCategory("Weight Loss"), true);
  assert.equal(isWeightLossCategory("Weight Loss (GLP-1 & Metabolic)"), true);
  assert.equal(isWeightLossCategory("Peptides & Longevity"), false);
});
test("new public landing stays inside RX and respects the existing kill switch", () => {
  assert.equal(rxDestination("rx.govirtualhealth.com", "/weight-loss", true), "/rx/weight-loss");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/rx/weight-loss", true), "/rx/weight-loss");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/weight-loss", false), "/rx/unavailable");
  assert.equal(rxDestination("portal.govirtualhealth.com", "/weight-loss", true), null);
  assert.equal(rxDestination("rx.govirtualhealth.com", "/weight-loss/admin", true), "/rx/unavailable");
});
