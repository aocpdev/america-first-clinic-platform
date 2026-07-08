import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { companyAdminUserIds, notifyUsers, orderRecipientUserIds, personDisplayName } from "@/lib/notifications";
import { carrierTrackingUrl } from "@/lib/orders/tracking";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : null;
}

function parseAdditionalData(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return record(value);
  if (typeof value !== "string") return null;

  try {
    return record(JSON.parse(value));
  } catch {
    return null;
  }
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function normalizedExamStatus(value: unknown) {
  return stringValue(value).toLowerCase();
}

function nextStageForConsultation(status: string) {
  if (status === "approved") return "APPROVAL";
  if (status === "deferred to medical director") return "MEDICAL_REVIEW";
  if (status === "rejected" || status === "na" || status === "n/a" || status === "not applicable") return "DEFERRED";
  return "GFE";
}

function carrierFromPayload(value: unknown) {
  const service = stringValue(value).toLowerCase();
  if (service.includes("ups")) return "ups";
  if (service.includes("fedex")) return "fedex";
  if (service.includes("usps")) return "usps";
  if (service.includes("dhl")) return "dhl";
  return "other";
}

function qualiphyNotificationCopy(event: number | null, stage: string | null, customerName: string) {
  if (event === 1 && stage === "APPROVAL") {
    return {
      title: "Exam approved",
      body: `${customerName}'s Qualiphy exam was approved. The order is ready for prescription handling.`
    };
  }

  if (event === 1 && stage === "MEDICAL_REVIEW") {
    return {
      title: "Medical review needed",
      body: `${customerName}'s Qualiphy exam was deferred to medical review.`
    };
  }

  if (event === 1 && stage === "DEFERRED") {
    return {
      title: "Exam deferred",
      body: `${customerName}'s Qualiphy exam was deferred. Review the order before taking the next step.`
    };
  }

  if (event === 2) {
    return {
      title: "Prescription confirmed",
      body: `Qualiphy confirmed ${customerName}'s prescription.`
    };
  }

  if (event === 3) {
    return {
      title: "Tracking received",
      body: `Qualiphy sent tracking for ${customerName}'s order.`
    };
  }

  return {
    title: "Qualiphy update received",
    body: `${customerName}'s order was updated from Qualiphy.`
  };
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const body = record(payload);

  if (!body) {
    return NextResponse.json({ ok: true });
  }

  const additionalData = parseAdditionalData(body.additional_data);
  const orderId = stringValue(additionalData?.orderId);

  if (!orderId) {
    return NextResponse.json({ ok: true, received: true, skipped: "missing_order_id" });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      consultantProfile: {
        include: {
          partnerProfile: true,
          managerProfile: true,
          groupLeaderProfile: { include: { managerProfile: true } }
        }
      },
      partnerProfile: true,
      managerProfile: true,
      groupLeaderProfile: { include: { managerProfile: true } }
    }
  });

  if (!order) {
    return NextResponse.json({ ok: true, received: true, skipped: "order_not_found" });
  }

  const event = numberValue(body.event);
  const now = new Date();
  const existingMetadata = metadataObject(order.referralMetadata);
  const existingQualiphy = metadataObject(existingMetadata.qualiphy);
  const existingEvents = Array.isArray(existingQualiphy.events) ? existingQualiphy.events : [];
  const rawPatientExamId = body.patient_exam_id ?? existingQualiphy.patientExamId ?? record(existingQualiphy.invite)?.patientExamId ?? null;
  const patientExamId = typeof rawPatientExamId === "string" || typeof rawPatientExamId === "number" ? rawPatientExamId : null;
  const examStatus = stringValue(body.exam_status);
  const rxStatus = stringValue(body.rx_status);
  const isTest = booleanValue(additionalData?.is_test) || booleanValue(additionalData?.test_mode) || existingQualiphy.isTest === true;

  const qualiphy = {
    ...existingQualiphy,
    isTest,
    environment: isTest ? "test" : existingQualiphy.environment || "live",
    patientExamId,
    lastEvent: event,
    lastStatus: examStatus || rxStatus || null,
    lastWebhookAt: now.toISOString(),
    events: [
      ...existingEvents,
      {
        event,
        receivedAt: now.toISOString(),
        examStatus: examStatus || null,
        rxStatus: rxStatus || null,
        patientExamId,
        isTest,
        raw: payload
      }
    ]
  };

  const nextData: Prisma.OrderUpdateInput = {
    referralMetadata: {
      ...existingMetadata,
      qualiphy
    }
  };

  let nextStage: string | null = null;
  let outboundEvent: string | null = null;

  if (event === 1) {
    nextStage = nextStageForConsultation(normalizedExamStatus(body.exam_status));
    outboundEvent = "qualiphy.consultation_complete";
    nextData.orderPipelineStage = nextStage;
    nextData.orderPipelineUpdatedAt = now;
    if (nextStage === "APPROVAL" || nextStage === "MEDICAL_REVIEW" || nextStage === "GFE") {
      nextData.orderStatus = "PROCESSING";
    }
    if (nextStage === "DEFERRED") {
      nextData.commissionStatus = "REJECTED";
    }
    const examUrl = stringValue(body.exam_url);
    if (examUrl) {
      nextData.gfeDocumentUrl = examUrl;
      nextData.gfeStoredAt = now;
    }
  }

  if (event === 2) {
    nextStage = "PRESCRIPTION_CONFIRMED";
    outboundEvent = "qualiphy.prescription_confirmed";
    nextData.orderPipelineStage = nextStage;
    nextData.orderPipelineUpdatedAt = now;
    nextData.orderStatus = "PROCESSING";
    nextData.prescriptionNotes = "Prescription confirmed by Qualiphy. See referral metadata for payload details.";
    nextData.prescriptionStoredAt = now;
  }

  if (event === 3) {
    const trackingNumber = stringValue(body.tracking_number);
    nextStage = "FULFILLMENT";
    outboundEvent = "qualiphy.prescription_tracking";
    nextData.orderPipelineStage = nextStage;
    nextData.orderPipelineUpdatedAt = now;
    nextData.orderStatus = "PROCESSING";
    if (trackingNumber) {
      nextData.shippingTrackingCode = trackingNumber;
      nextData.shippingCarrier = carrierFromPayload(body.delivery_service);
      nextData.shippedAt = now;
    }
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: nextData
    }),
    ...(nextStage
      ? [
          prisma.customer.update({
            where: { id: order.customerId },
            data: {
              pipelineStage: nextStage,
              pipelineUpdatedAt: now
            }
          })
        ]
      : []),
    prisma.activityLog.create({
      data: {
        companyId: order.companyId,
        customerId: order.customerId,
        action: "QUALIPHY_WEBHOOK_RECEIVED",
        metadata: {
          orderId: order.id,
          event,
          stage: nextStage,
          patientExamId,
          examStatus: examStatus || null,
          rxStatus: rxStatus || null
        }
      }
    })
  ]);

  if (nextStage) {
    const customerName = personDisplayName(order.customer);
    const copy = qualiphyNotificationCopy(event, nextStage, customerName);
    const title = isTest ? `Test: ${copy.title}` : copy.title;
    const adminIds = await companyAdminUserIds(prisma, order.companyId);
    const trackingNumber = stringValue(body.tracking_number);
    const carrier = trackingNumber ? carrierFromPayload(body.delivery_service) : null;

    await notifyUsers(prisma, [
      ...adminIds.map((userId) => ({
        userId,
        title,
        body: copy.body,
        metadata: {
          type: "order_qualiphy",
          orderId: order.id,
          customerId: order.customerId,
          stage: nextStage,
          event,
          patientExamId,
          examStatus: examStatus || null,
          rxStatus: rxStatus || null,
          isTest,
          trackingCode: trackingNumber || null,
          trackingUrl: trackingNumber && carrier ? carrierTrackingUrl(carrier, trackingNumber) : null
        }
      })),
      ...orderRecipientUserIds(order).map((userId) => ({
        userId,
        title,
        body: copy.body,
        metadata: {
          type: "order_qualiphy",
          orderId: order.id,
          customerId: order.customerId,
          stage: nextStage,
          event,
          patientExamId,
          examStatus: examStatus || null,
          rxStatus: rxStatus || null,
          isTest,
          trackingCode: trackingNumber || null,
          trackingUrl: trackingNumber && carrier ? carrierTrackingUrl(carrier, trackingNumber) : null
        }
      }))
    ]);
  }

  if (outboundEvent) {
    await dispatchWebhookEvent({
      companyId: order.companyId,
      partnerProfileId: order.partnerProfileId ?? order.consultantProfile?.partnerProfileId,
      eventType: outboundEvent,
      payload: {
        orderId: order.id,
        customerId: order.customerId,
        customerName: [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ").trim() || order.customer.email,
        customerEmail: order.customer.email,
        event,
        stage: nextStage,
        patientExamId,
        examStatus: examStatus || null,
        rxStatus: rxStatus || null,
        meetingUrl: stringValue(record(existingQualiphy.invite)?.meetingUrl) || null,
        trackingNumber: stringValue(body.tracking_number) || null,
        isTest
      }
    });
  }

  return NextResponse.json({ ok: true });
}
