import assert from "node:assert/strict";
import test from "node:test";
import { orderRxCategories } from "./rx-category-order";

test("Weight Loss leads every store category list without changing Admin records", () => {
  const categories = Object.freeze([
    { id: "clinical", name: "Clinical Services", count: 1 },
    { id: "hair", name: "Hair Restoration & Skin", count: 6 },
    { id: "metabolic", name: "Weight Loss (GLP-1 & Metabolic)", count: 11 },
    { id: "weight", name: "Weight Loss", count: 1 }
  ]);
  const ordered = orderRxCategories(categories);
  assert.deepEqual(ordered.map(category => category.id), ["weight", "metabolic", "clinical", "hair"]);
  assert.equal(ordered[0], categories[3]);
  assert.equal(ordered[1].count, 11);
  assert.equal(categories[0].id, "clinical");
});

test("empty and unrelated categories keep their original order", () => {
  assert.deepEqual(orderRxCategories([]), []);
  const categories = [{ name: "Z category" }, { name: "A category" }];
  assert.deepEqual(orderRxCategories(categories), categories);
});
