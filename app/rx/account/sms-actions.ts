"use server";

import { requireCustomerSession } from "@/lib/customers/customer-session";
import { prisma } from "@/lib/db/prisma";
import { readSmsChoice } from "@/lib/legal/sms-consent";
import { recordSmsConsentRequest, smsConsentPhone } from "@/lib/legal/sms-consent-record";

export type CustomerSmsState = { error?: string; message?: string };

export async function requestCustomerTexts(_previous: CustomerSmsState, form: FormData): Promise<CustomerSmsState> {
  const customer = await requireCustomerSession();
  try {
    const choice = readSmsChoice(form);
    if (!choice.smsOptIn) return { message: "No text enrollment was requested. Your existing preferences have not changed." };
    const phone = form.get("smsPhone");
    if (typeof phone !== "string" || phone.length > 40 || form.getAll("smsPhone").length !== 1) return { error: "Enter a valid mobile number." };
    smsConsentPhone(choice, phone);
    await recordSmsConsentRequest(prisma, {
      companyId: customer.companyId, subjectId: customer.id, subjectType: "Customer",
      actorUserId: customer.userId!, program: "CUSTOMER_ORDERS", source: "/rx/account", phone, choice
    });
    return { message: "Your request has been recorded. Text delivery is not active yet; number verification and messaging setup must be completed first." };
  } catch {
    return { error: "We could not save your text request. Check your mobile number and try again. Your account access is unchanged." };
  }
}
