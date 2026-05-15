export type Role = "SUPER_ADMIN" | "COMPANY_ADMIN" | "MANAGER" | "CONSULTANT" | "CUSTOMER";

const roleRank: Record<Role, number> = {
  CUSTOMER: 1,
  CONSULTANT: 2,
  MANAGER: 3,
  COMPANY_ADMIN: 4,
  SUPER_ADMIN: 5
};

export function hasRoleAtLeast(current: Role, required: Role) {
  return roleRank[current] >= roleRank[required];
}

export function canAccessCompanyData(role: Role) {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN";
}
