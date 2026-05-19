import type { UserRole } from "@prisma/client";

export function profilePathForRole(role: UserRole) {
  if (role === "PARTNER" || role === "GROUP_LEADER") {
    return "/partner/profile";
  }

  if (role === "CONSULTANT") {
    return "/consultant/profile";
  }

  if (role === "MANAGER") {
    return "/manager/profile";
  }

  return "/admin/profile";
}
