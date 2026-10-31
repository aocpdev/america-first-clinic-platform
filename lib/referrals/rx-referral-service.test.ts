import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { resolveRxReferral } from "./rx-referral-service";

const companyId = "00000000-0000-4000-8000-000000000001";
const fake = (affiliate: unknown = null, agent: unknown = null) => {
  const calls: any[] = [];
  const db = {
    affiliateProfile: { findFirst: async (query: unknown) => { calls.push(query); return affiliate; } },
    consultantProfile: { findFirst: async (query: unknown) => { calls.push(query); return agent; } }
  } as unknown as Pick<PrismaClient, "affiliateProfile" | "consultantProfile">;
  return { db, calls };
};
test("direct and malformed links cannot claim a referral or query the database", async () => {
  const { db, calls } = fake();
  assert.equal((await resolveRxReferral(db, companyId, undefined)).status, "NONE");
  for (const code of ["../admin", "AF X", ["AF-123"], "A".repeat(65)]) {
    assert.equal((await resolveRxReferral(db, companyId, code)).status, "REVIEW_REQUIRED");
  }
  assert.equal(calls.length, 0);
});
test("approved affiliate is resolved with company-scoped minimal lookups", async () => {
  const { db, calls } = fake({ id: "affiliate", status: "APPROVED" });
  assert.deepEqual(await resolveRxReferral(db, companyId, "AF-EXAMPLE"),
    { status: "RESOLVED", seller: { companyId, role: "AFFILIATE", profileId: "affiliate" } });
  assert.ok(calls.every(query => query.where.companyId === companyId));
  assert.ok(calls.every(query => !JSON.stringify(query).includes("email")));
});
test("suspended, archived and pending affiliates are not payable referrals", async () => {
  for (const status of ["PENDING", "SUSPENDED", "ARCHIVED"]) {
    assert.deepEqual(await resolveRxReferral(fake({ id: "affiliate", status }).db, companyId, "AF-EXAMPLE"),
      { status: "REVIEW_REQUIRED", reason: "INACTIVE_REFERRAL" });
  }
});
test("active original agents resolve separately from affiliates", async () => {
  const agent = { id: "agent", user: { companyId, status: "ACTIVE", role: "CONSULTANT" } };
  assert.equal((await resolveRxReferral(fake(null, agent).db, companyId, "AGENT-123")).status, "RESOLVED");
  for (const user of [{ ...agent.user, companyId: "other" }, { ...agent.user, status: "SUSPENDED" }, { ...agent.user, role: "CUSTOMER" }]) {
    assert.equal((await resolveRxReferral(fake(null, { ...agent, user }).db, companyId, "AGENT-123")).status, "REVIEW_REQUIRED");
  }
});
test("code collisions across participant tables fail closed", async () => {
  assert.deepEqual(await resolveRxReferral(fake({ id: "affiliate", status: "APPROVED" }, { id: "agent" }).db, companyId, "AF-EXAMPLE"),
    { status: "REVIEW_REQUIRED", reason: "AMBIGUOUS_REFERRAL" });
  assert.equal((await resolveRxReferral(fake().db, companyId, "UNKNOWN")).status, "REVIEW_REQUIRED");
});
