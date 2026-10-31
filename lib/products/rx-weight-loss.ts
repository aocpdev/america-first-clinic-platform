/** Explicit Admin categories only: do not classify medications by guessed benefits. */
export const WEIGHT_LOSS_CATEGORIES = ["Weight Loss", "Weight Loss (GLP-1 & Metabolic)"];
export function weightLossCatalogWhere(companyId: string) {
  return { companyId, active: true, category: { companyId, name: { in: WEIGHT_LOSS_CATEGORIES } } };
}
export function isWeightLossCategory(name: string) {
  return WEIGHT_LOSS_CATEGORIES.includes(name);
}
