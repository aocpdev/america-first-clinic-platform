import test from "node:test";
import assert from "node:assert/strict";
import { isRxClinicalService, rxShopCategoryWhere, rxShopProductWhere } from "./rx-telehealth";
import { rxDestination } from "./rx-routing";

test("clinical services are separate while actual product categories stay available", () => {
  assert.equal(isRxClinicalService("Clinical Services"), true);
  for (const category of ["Weight Loss", "Weight Loss (GLP-1 & Metabolic)", "Peptides & Longevity", "Hair Restoration & Skin"]) assert.equal(isRxClinicalService(category), false);
  assert.deepEqual(rxShopCategoryWhere, { name: { not: "Clinical Services" } });
});
test("shop query keeps tenant and active restrictions and excludes clinical services", () => {
  assert.deepEqual(rxShopProductWhere("company-a"), { companyId: "company-a", active: true, category: { name: { not: "Clinical Services" } } });
  assert.equal(rxShopProductWhere("company-b").companyId, "company-b");
});
test("telehealth landing is isolated to RX and respects its kill switch", () => {
  assert.equal(rxDestination("rx.govirtualhealth.com", "/telehealth", true), "/rx/telehealth");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/rx/telehealth", true), "/rx/telehealth");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/telehealth", false), "/rx/unavailable");
  assert.equal(rxDestination("portal.govirtualhealth.com", "/telehealth", true), null);
  assert.equal(rxDestination("rx.govirtualhealth.com", "/telehealth/admin", true), "/rx/unavailable");
});
