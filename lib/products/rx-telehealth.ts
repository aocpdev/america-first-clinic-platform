// Clinical services have a separate public journey. Admin records stay unchanged.
export const RX_CLINICAL_CATEGORY = "Clinical Services";
export const isRxClinicalService = (category: string) => category === RX_CLINICAL_CATEGORY;
export const rxShopCategoryWhere = { name: { not: RX_CLINICAL_CATEGORY } };
export function rxShopProductWhere(companyId: string) {
  return { companyId, active: true, category: rxShopCategoryWhere };
}
