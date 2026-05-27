import type { Role } from "@/lib/auth/roles";

export function dashboardPathForRole(role: Role) {
  switch (role) {
    case "SUPER_ADMIN":
    case "COMPANY_ADMIN":
      return "/admin/dashboard";
    case "PARTNER":
      return "/partner/dashboard";
    case "GROUP_LEADER":
      return "/partner/dashboard";
    case "MANAGER":
      return "/manager/dashboard";
    case "CONSULTANT":
      return "/consultant/dashboard";
    case "CUSTOMER":
    default:
      return "/shop";
  }
}
