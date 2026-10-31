import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { smsChoiceShape } from "../legal/sms-consent";
import { recordSmsConsentRequest, smsConsentPhone } from "../legal/sms-consent-record";

export const applicationSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  category: z.enum(["INFLUENCER", "GYM", "TRAINER", "ARTIST", "OTHER"]),
  website: z.union([z.literal(""), z.string().url().max(500).refine(value => {
    const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password;
  })]),
  message: z.string().trim().max(1200),
  consent: z.literal("yes"),
  phone: z.string().trim().max(40).optional(),
  ...smsChoiceShape,
  companyWebsite: z.literal("") // Honeypot, never a business field.
});

export function applicationToken(secret: string, companyId: string, now = Date.now()) {
  const payload = `${companyId}:${now}:${randomBytes(16).toString("hex")}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}
export function validApplicationToken(token: string, secret: string, companyId: string, now = Date.now()) {
  if (token.length > 256 || secret.length < 32) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const [tenant, timestamp, nonce] = payload.split(":");
  const age = now - Number(timestamp);
  return tenant === companyId && /^[a-f0-9]{32}$/.test(nonce ?? "") && age >= 2000 && age < 3600000 &&
    timingSafeEqual(Buffer.from(signature, "hex"), createHmac("sha256", secret).update(payload).digest());
}

/** Call only after server-side form and anti-bot verification. Tenant is server-derived. */
export async function receiveAffiliateApplication(db: PrismaClient, companyId: string,
  input: z.infer<typeof applicationSchema>, token: string) {
  const parsed = applicationSchema.parse(input);
  smsConsentPhone(parsed, parsed.phone);
  return db.$transaction(async tx => {
    // Serializes replay/deduplication and the circuit breaker across server instances.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`affiliate-application:${companyId}`}, 0))::text`;
    const replay = await tx.auditLog.findFirst({ where: { companyId, action: "AFFILIATE_APPLICATION_ATTEMPT", resourceId: token } });
    if (replay) return;
    const attempts = await tx.auditLog.count({ where: { companyId, action: "AFFILIATE_APPLICATION_ATTEMPT", createdAt: { gte: new Date(Date.now() - 3600000) } } });
    if (attempts >= 100) throw new Error("APPLICATION_RATE_LIMIT");
    await tx.auditLog.create({ data: { companyId, action: "AFFILIATE_APPLICATION_ATTEMPT", resource: "AffiliateApplication", resourceId: token } });
    // Generic success for duplicate email: no disclosure or changes to an existing profile.
    if (await tx.affiliateProfile.findUnique({ where: { companyId_email: { companyId, email: parsed.email } } })) return;
    const profile = await tx.affiliateProfile.create({ data: { companyId, displayName: parsed.displayName,
      email: parsed.email, category: parsed.category, status: "PENDING", commissionBps: null,
      referralCode: `AF-${randomBytes(12).toString("hex").toUpperCase()}` } });
    await tx.auditLog.create({ data: { companyId, action: "AFFILIATE_APPLICATION_RECEIVED", resource: "AffiliateProfile", resourceId: profile.id,
      metadata: { website: parsed.website, message: parsed.message, contactConsent: true, contactChannel: "EMAIL", consentVersion: "2026-10-30" } } });
    await recordSmsConsentRequest(tx, { companyId, subjectId: profile.id, subjectType: "AffiliateProfile",
      program: "AFFILIATE_APPLICATION", source: "/rx/affiliates", phone: parsed.phone, choice: parsed, requestKey: token });
  });
}
