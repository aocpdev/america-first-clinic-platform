type Identity = { id: string; email?: string; email_confirmed_at?: string };
type Account = { id: string; authUserId: string; companyId: string | null; email: string; role: string; status: string; isActive: boolean };
type Customer = { userId: string | null; companyId: string; email: string };
const normalized = (email: string) => email.trim().toLowerCase();

/** Explicit identity binding only. Matching email alone never grants access. */
export function canAccessCustomerPortal(identity: Identity | null, account: Account | null, customer: Customer | null, companyId: string) {
  return Boolean(identity?.email && identity.email_confirmed_at && account && customer &&
    account.authUserId === identity.id && account.role === "CUSTOMER" && account.status === "ACTIVE" && account.isActive &&
    account.companyId === companyId && customer.companyId === companyId && customer.userId === account.id &&
    normalized(account.email) === normalized(identity.email) && normalized(customer.email) === normalized(identity.email));
}
