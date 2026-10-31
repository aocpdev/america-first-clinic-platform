import { z } from "zod";
import type { SellerIdentity } from "./attribution-policy";

/** DIRECT is an explicit company acquisition, never an absent/unknown seller.
 * Its profileId is the tenant company ID, not a fabricated seller profile. */
export type RxOwner = SellerIdentity | { companyId: string; role: "DIRECT"; profileId: string };
export function parseRxOwner(value: unknown): RxOwner {
  const owner = z.object({ companyId: z.string().uuid(),
    role: z.enum(["DIRECT", "AFFILIATE", "CONSULTANT", "GROUP_LEADER", "MANAGER", "PARTNER"]),
    profileId: z.string().uuid() }).parse(value);
  if (owner.role === "DIRECT" && owner.profileId !== owner.companyId) throw new Error("DIRECT_OWNER_TENANT_MISMATCH");
  return owner;
}
