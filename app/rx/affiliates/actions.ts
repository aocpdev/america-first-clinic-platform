"use server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { requireRxCompany } from "@/lib/products/rx-catalog";
import { applicationSchema, receiveAffiliateApplication, validApplicationToken } from "@/lib/referrals/affiliate-application";
import { readSmsChoice } from "@/lib/legal/sms-consent";
import { smsConsentPhone } from "@/lib/legal/sms-consent-record";

export type ApplicationState = { status: "idle" | "error" | "success"; message: string };

export async function applyForAffiliation(_: ApplicationState, form: FormData): Promise<ApplicationState> {
  const company = await requireRxCompany();
  const secret = process.env.AFFILIATE_APPLICATION_SECRET ?? "";
  const token = String(form.get("applicationToken") ?? "");
  const parsed = applicationSchema.safeParse(Object.fromEntries(form));
  if (process.env.AFFILIATE_APPLICATIONS_ENABLED !== "true" || !parsed.success || !validApplicationToken(token, secret, company.id)) {
    return { status: "error", message: "Please check the fields and consent box. If this page has been open for a while, refresh it before trying again." };
  }
  try {
    smsConsentPhone(readSmsChoice(form), parsed.data.phone);
    const isolatedPreview = process.env.NODE_ENV !== "production" && !process.env.VERCEL &&
      new URL(process.env.DATABASE_URL ?? "http://invalid").hostname === "127.0.0.1" &&
      new URL(process.env.DATABASE_URL ?? "http://invalid").pathname === "/gvh_affiliate_test";
    if (!isolatedPreview) {
      const response = String(form.get("cf-turnstile-response") ?? "");
      if (!process.env.TURNSTILE_SECRET_KEY || !response || response.length > 2048) throw new Error("VERIFICATION_REQUIRED");
      const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response }), signal: AbortSignal.timeout(10000)
      });
      const result = await verification.json();
      if (!verification.ok || result.success !== true || result.hostname !== "rx.govirtualhealth.com" || result.action !== "affiliate-application") throw new Error("VERIFICATION_FAILED");
    }
    await receiveAffiliateApplication(prisma, company.id, parsed.data, createHash("sha256").update(token).digest("hex"));
    return { status: "success", message: "Thank you. Your request has been received for review. If you already applied, your existing application remains on file. Approval and account access are separate steps." };
  } catch (error) {
    if (error instanceof Error && ["SMS_PHONE_REQUIRED", "INVALID_SMS_CONSENT"].includes(error.message)) return { status: "error", message: "For text updates, enter a valid mobile number and select the optional SMS checkbox. You can also leave it unchecked and apply without texts." };
    return { status: "error", message: "We could not submit your request right now. Please refresh the page and try again shortly." };
  }
}
