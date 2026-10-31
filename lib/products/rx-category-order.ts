import { WEIGHT_LOSS_CATEGORIES } from "./rx-weight-loss";

/** Store presentation only; preserve Admin records and all other relative ordering. */
export function orderRxCategories<T extends { name: string }>(categories: readonly T[]): T[] {
  const priority = (name: string) => {
    const index = WEIGHT_LOSS_CATEGORIES.indexOf(name);
    return index < 0 ? WEIGHT_LOSS_CATEGORIES.length : index;
  };
  return [...categories].sort((a, b) => priority(a.name) - priority(b.name));
}
