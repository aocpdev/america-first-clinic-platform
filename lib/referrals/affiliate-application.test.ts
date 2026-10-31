import assert from "node:assert/strict";
import test from "node:test";
import { applicationSchema, applicationToken, validApplicationToken } from "./affiliate-application";
const secret = "local-test-secret-not-for-production-12345";
test("application tokens are tenant-bound, signed, short-lived and require reading time", () => {
  const token = applicationToken(secret, "tenant-a", 10000);
  assert.equal(validApplicationToken(token, secret, "tenant-a", 13000), true);
  for (const [key, company, time] of [[secret, "tenant-b", 13000], [secret, "tenant-a", 10000], [secret, "tenant-a", 4000000], ["wrong", "tenant-a", 13000]] as const)
    assert.equal(validApplicationToken(token, key, company, time), false);
  assert.equal(validApplicationToken(`${token}x`, secret, "tenant-a", 13000), false);
});
test("application validates consent, honeypot and URL while stripping privileged fields", () => {
  const input = { displayName: " Sample Creator ", email: "Creator@Example.test", category: "ARTIST", website: "https://example.test", message: "Hello", consent: "yes", companyWebsite: "" };
  const parsed = applicationSchema.parse({ ...input, status: "APPROVED", commissionBps: 10000, authUserId: "injected" });
  assert.equal(parsed.email, "creator@example.test");
  assert.equal("status" in parsed, false);
  for (const change of [{ consent: "no" }, { companyWebsite: "spam" }, { website: "javascript:alert(1)" }, { website: "https://user:password@example.test" }, { message: "x".repeat(1201) }])
    assert.equal(applicationSchema.safeParse({ ...input, ...change }).success, false);
});
