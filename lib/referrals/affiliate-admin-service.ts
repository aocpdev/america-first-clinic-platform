import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { z } from "zod";
import type { affiliateSchema } from "./affiliate-admin-policy";

type Actor = { companyId: string; userId: string };
type AffiliateInput = z.infer<typeof affiliateSchema>;

/** Internal service; callers must authenticate and authorize the actor first. */
export async function persistAffiliate(db: PrismaClient, actor: Actor, parsed: AffiliateInput, id: string, revision: number) {
  return db.$transaction(async (tx) => {
    if (id) {
      if (!Number.isInteger(revision) || revision < 1) throw new Error("STALE_RECORD");
      const before = await tx.affiliateProfile.findFirst({ where: { id, companyId: actor.companyId, revision } });
      if (!before) throw new Error("STALE_RECORD");
      if (before.authUserId && parsed.email !== before.email) throw new Error("LINKED_EMAIL_LOCKED");
      const result = await tx.affiliateProfile.updateMany({
        where: { id, companyId: actor.companyId, revision }, data: { ...parsed, revision: { increment: 1 } }
      });
      if (result.count !== 1) throw new Error("STALE_RECORD");
      await tx.auditLog.create({ data: { companyId: actor.companyId, userId: actor.userId,
        action: "AFFILIATE_UPDATED", resource: "AffiliateProfile", resourceId: id,
        metadata: { before: { status: before.status, commissionBps: before.commissionBps, revision },
          after: { status: parsed.status, commissionBps: parsed.commissionBps, revision: revision + 1 } } } });
      return id;
    }
    const profile = await tx.affiliateProfile.create({ data: { ...parsed, companyId: actor.companyId,
      referralCode: `AF-${randomBytes(12).toString("hex").toUpperCase()}` } });
    await tx.auditLog.create({ data: { companyId: actor.companyId, userId: actor.userId,
      action: "AFFILIATE_CREATED", resource: "AffiliateProfile", resourceId: profile.id,
      metadata: { status: profile.status, commissionBps: profile.commissionBps } } });
    return profile.id;
  });
}

export async function persistAffiliateDefault(db: PrismaClient, actor: Actor, commissionBps: number, revision: number) {
  if (!Number.isInteger(revision) || revision < 0) throw new Error("STALE_RECORD");
  return db.$transaction(async (tx) => {
    if (revision === 0) {
      await tx.affiliateProgramSetting.create({ data: { companyId: actor.companyId, commissionBps } });
    } else {
      const result = await tx.affiliateProgramSetting.updateMany({
        where: { companyId: actor.companyId, revision }, data: { commissionBps, revision: { increment: 1 } }
      });
      if (result.count !== 1) throw new Error("STALE_RECORD");
    }
    await tx.auditLog.create({ data: { companyId: actor.companyId, userId: actor.userId,
      action: "AFFILIATE_DEFAULT_UPDATED", resource: "AffiliateProgramSetting", resourceId: actor.companyId,
      metadata: { commissionBps, previousRevision: revision } } });
  });
}

export async function persistAffiliateLogin(db: PrismaClient, actor: Actor, id: string, revision: number,
  identity: { id: string; email?: string; email_confirmed_at?: string }) {
  if (!Number.isInteger(revision) || revision < 1 || !identity.email_confirmed_at || !identity.email) {
    throw new Error("UNVERIFIED_IDENTITY");
  }
  return db.$transaction(async tx => {
    const result = await tx.affiliateProfile.updateMany({
      where: { id, companyId: actor.companyId, revision, status: "APPROVED", authUserId: null,
        email: identity.email!.trim().toLowerCase() },
      data: { authUserId: identity.id, revision: { increment: 1 } }
    });
    if (result.count !== 1) throw new Error("STALE_RECORD");
    await tx.auditLog.create({ data: { companyId: actor.companyId, userId: actor.userId,
      action: "AFFILIATE_LOGIN_CONNECTED", resource: "AffiliateProfile", resourceId: id,
      metadata: { authUserId: identity.id, revision: revision + 1 } } });
  });
}
