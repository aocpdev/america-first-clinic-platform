export function createReferralSlug(firstName: string, lastName: string) {
  return `${firstName}-${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function createReferralCode(firstName: string, lastName: string) {
  const base = `${firstName.slice(0, 3)}${lastName.slice(0, 3)}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${base || "AFC"}${Math.floor(100 + Math.random() * 900)}`;
}
