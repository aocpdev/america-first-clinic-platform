type Identity = { id: string; email?: string; email_confirmed_at?: string };
type Profile = { authUserId: string | null; email: string; status: string; companyId: string };

export function canAccessAffiliatePortal(identity: Identity | null, profile: Profile | null, companyId: string) {
  return Boolean(identity && profile && identity.email_confirmed_at && identity.email &&
    profile.authUserId === identity.id && profile.status === "APPROVED" &&
    profile.companyId === companyId && profile.email === identity.email.trim().toLowerCase());
}
