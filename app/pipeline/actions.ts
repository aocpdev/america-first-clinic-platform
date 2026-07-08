"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { notifyUsers, orderRecipientUserIds, personDisplayName } from "@/lib/notifications";
import { getPaymentProvider } from "@/lib/payments/registry";
import type { PaymentProviderCode } from "@/lib/payments/types";
import { phoneForWebhook } from "@/lib/phone";
import type { QualiphyPatientExam } from "@/lib/qualiphy/invites";
import { sendQualiphyExamInvite } from "@/lib/qualiphy/invites";
import { carrierTrackingUrl, normalizeCarrier } from "@/lib/orders/tracking";
import { isCustomerPipelineStage, isOrderPipelineStage, orderPipelineLabel } from "@/lib/sales/pipeline";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { publicSiteBaseUrl } from "@/lib/urls";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function returnPipelinePath(role: string) {
  if (role === "CONSULTANT") return "/consultant/pipeline";
  if (role === "MANAGER") return "/manager/pipeline";
  if (role === "PARTNER" || role === "GROUP_LEADER") return "/partner/pipeline";
  return "/admin/pipeline";
}

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email || "Customer";
}

function pipelineNotificationCopy(stage: string, customerName: string) {
  if (stage === "GFE") {
    return {
      title: "Exam step started",
      body: `${customerName}'s order moved to Exam.`
    };
  }

  if (stage === "MEDICAL_REVIEW") {
    return {
      title: "Medical review needed",
      body: `${customerName}'s order needs medical review.`
    };
  }

  if (stage === "APPROVAL") {
    return {
      title: "Client approved",
      body: `${customerName}'s order was approved. Commission remains pending until fulfillment is complete.`
    };
  }

  if (stage === "PRESCRIPTION_CONFIRMED") {
    return {
      title: "Prescription confirmed",
      body: `${customerName}'s prescription was confirmed.`
    };
  }

  if (stage === "FULFILLMENT") {
    return {
      title: "Fulfillment started",
      body: `${customerName}'s order moved to fulfillment.`
    };
  }

  if (stage === "SHIPPED") {
    return {
      title: "Commission approved",
      body: `${customerName}'s order has shipped and commission was approved.`
    };
  }

  if (stage === "DEFERRED") {
    return {
      title: "Client deferred",
      body: `${customerName}'s order was deferred and pending commission was rejected.`
    };
  }

  return {
    title: "Pipeline updated",
    body: `${customerName}'s order moved to ${orderPipelineLabel(stage)}.`
  };
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function objectMetadata(metadata: unknown) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...(metadata as Record<string, unknown>) } : {};
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function formatDateOnly(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function genderForQualiphy(value: string | null | undefined) {
  if (value === "MALE") return 1;
  if (value === "FEMALE") return 2;
  if (value === "PREFER_NOT_TO_SAY") return 3;
  return undefined;
}

function stringField(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value.trim() : "";
}

type QualiphySelection = {
  mode: "SEND" | "SKIP";
  isTest: boolean;
  environment: "live" | "test";
  selectedAt: string;
  selectedByUserId: string;
  exam: {
    id: number;
    title: string;
    rxType: number | null;
    attachmentsRequired: number | null;
  } | null;
  invite?: {
    sentAt: string;
    webhookUrl: string;
    meetingUrl: string | null;
    meetingUuid: string | null;
    patientExams: QualiphyPatientExam[];
    patientExamId: string | number | null;
    status: "PENDING";
  };
};

async function ensureClinicalDocumentsBucket() {
  const supabase = createSupabaseAdminClient();
  const bucket = "customer-clinical-documents";
  const { data: buckets } = await supabase.storage.listBuckets();

  if (!buckets?.some((item) => item.name === bucket)) {
    await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 15 * 1024 * 1024,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    });
  }

  return { supabase, bucket };
}

async function accessibleOrder(user: Awaited<ReturnType<typeof requireUser>>, orderId: string) {
  if (!user.companyId) return null;

  return prisma.order.findFirst({
    where: {
      id: orderId,
      companyId: user.companyId,
      ...(user.role === "CONSULTANT"
        ? { consultantProfileId: user.consultantProfile?.id ?? "__no_access__" }
        : user.role === "PARTNER"
          ? {
              OR: [
                { partnerProfileId: user.partnerProfile?.id ?? "__no_access__" },
                { consultantProfile: { partnerProfileId: user.partnerProfile?.id ?? "__no_access__" } }
              ]
            }
          : user.role === "GROUP_LEADER"
            ? {
                OR: [
                  { groupLeaderProfileId: user.groupLeaderProfile?.id ?? "__no_access__" },
                  { consultantProfile: { groupLeaderProfileId: user.groupLeaderProfile?.id ?? "__no_access__" } }
                ]
              }
            : {})
    },
    include: {
      customer: {
        include: {
          addresses: {
            orderBy: [{ isDefault: "desc" }, { lastUsedAt: "desc" }, { createdAt: "desc" }]
          }
        }
      },
      consultantProfile: {
        include: {
          partnerProfile: true,
          managerProfile: true,
          groupLeaderProfile: { include: { managerProfile: true } }
        }
      },
      partnerProfile: true,
      managerProfile: true,
      groupLeaderProfile: { include: { managerProfile: true } },
      paymentTransactions: {
        where: { status: "CAPTURED", providerTransactionId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1
      },
      clinicalDocuments: {
        orderBy: { createdAt: "desc" }
      }
    }
  });
}

export async function updateCustomerPipelineStage(formData: FormData) {
  const user = await requireUser();
  const customerId = value(formData, "customerId");
  const stage = value(formData, "pipelineStage");

  if (!customerId || !isCustomerPipelineStage(stage)) {
    redirect("/login?error=invalid_pipeline_update");
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      consultantProfile: {
        select: {
          id: true,
          partnerProfileId: true
        }
      },
      partnerProfile: {
        select: { id: true }
      }
    }
  });

  if (!customer || customer.companyId !== user.companyId) {
    redirect("/login?error=access_denied");
  }

  if (user.role === "CONSULTANT") {
    if (!user.consultantProfile?.id || customer.consultantProfileId !== user.consultantProfile.id) {
      redirect("/login?error=access_denied");
    }
  } else if (user.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
    if (!partnerProfile || (customer.partnerProfileId !== partnerProfile.id && customer.consultantProfile?.partnerProfileId !== partnerProfile.id)) {
      redirect("/login?error=access_denied");
    }
  } else if (user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      pipelineStage: stage,
      pipelineUpdatedAt: new Date()
    }
  });

  await prisma.activityLog.create({
    data: {
      companyId: customer.companyId,
      userId: user.id,
      customerId: customer.id,
      action: "CUSTOMER_PIPELINE_STAGE_UPDATED",
      metadata: {
        pipelineStage: stage
      }
    }
  });

  revalidatePath("/consultant/pipeline");
  revalidatePath("/manager/pipeline");
  revalidatePath("/partner/pipeline");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/customers");
}

export async function updateOrderOpportunityDetails(formData: FormData) {
  const user = await requireUser();
  const orderId = value(formData, "orderId");
  const returnPath = returnPipelinePath(user.role);
  const order = orderId ? await accessibleOrder(user, orderId) : null;

  if (!order) {
    redirect(`${returnPath}?opportunity=not_found`);
  }

  const canManageInternalDocs = user.role === "COMPANY_ADMIN" || user.role === "SUPER_ADMIN";
  const orderNotes = value(formData, "orderNotes");
  const rxDocumentUrl = value(formData, "rxDocumentUrl");
  const rxNotes = value(formData, "rxNotes");
  const gfeDocumentUrl = value(formData, "gfeDocumentUrl");
  const gfeNotes = value(formData, "gfeNotes");
  const now = new Date();

  await prisma.order.update({
    where: { id: order.id },
    data: {
      orderNotes: orderNotes || null,
      ...(canManageInternalDocs
        ? {
            rxDocumentUrl: rxDocumentUrl || null,
            rxNotes: rxNotes || null,
            rxStoredAt: rxDocumentUrl ? now : null,
            gfeDocumentUrl: gfeDocumentUrl || null,
            gfeNotes: gfeNotes || null,
            gfeStoredAt: gfeDocumentUrl ? now : null
          }
        : {})
    }
  });

  await prisma.activityLog.create({
    data: {
      companyId: order.companyId,
      userId: user.id,
      customerId: order.customerId,
      action: "ORDER_OPPORTUNITY_UPDATED",
      metadata: { orderId: order.id, updatedDocs: canManageInternalDocs }
    }
  });

  revalidatePath("/admin/pipeline");
  revalidatePath("/partner/pipeline");
  revalidatePath("/manager/pipeline");
  revalidatePath("/consultant/pipeline");
  redirect(`${returnPath}?opportunity=updated`);
}

export async function uploadOrderClinicalDocument(formData: FormData) {
  const user = await requireUser();
  const orderId = value(formData, "orderId");
  const returnPath = returnPipelinePath(user.role);
  const order = orderId ? await accessibleOrder(user, orderId) : null;

  if (!order || (user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN")) {
    redirect(`${returnPath}?document=not_allowed`);
  }

  const type = value(formData, "documentType").toUpperCase();
  const title = value(formData, "documentTitle");
  const notes = value(formData, "documentNotes");
  const file = formData.get("documentFile");

  if ((type !== "RX" && type !== "GFE") || !title || !(file instanceof File) || file.size === 0) {
    redirect(`${returnPath}?document=missing_fields`);
  }

  const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) {
    redirect(`${returnPath}?document=unsupported_file`);
  }

  if (file.size > 15 * 1024 * 1024) {
    redirect(`${returnPath}?document=file_too_large`);
  }

  const { supabase, bucket } = await ensureClinicalDocumentsBucket();
  const extension = file.name.split(".").pop()?.toLowerCase() || (file.type === "application/pdf" ? "pdf" : "bin");
  const path = `${order.companyId}/${order.customerId}/${order.id}/${type.toLowerCase()}-${Date.now()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    throw new Error(error.message);
  }

  const document = await prisma.customerDocument.create({
    data: {
      companyId: order.companyId,
      customerId: order.customerId,
      orderId: order.id,
      uploadedByUserId: user.id,
      type,
      title,
      notes: notes || null,
      fileName: file.name,
      storageBucket: bucket,
      storagePath: path,
      mimeType: file.type,
      sizeBytes: file.size
    }
  });

  await prisma.order.update({
    where: { id: order.id },
    data:
      type === "RX"
        ? {
            rxDocumentUrl: `/api/customer-documents/${document.id}`,
            rxNotes: notes || order.rxNotes,
            rxStoredAt: new Date()
          }
        : {
            gfeDocumentUrl: `/api/customer-documents/${document.id}`,
            gfeNotes: notes || order.gfeNotes,
            gfeStoredAt: new Date()
          }
  });

  await prisma.activityLog.create({
    data: {
      companyId: order.companyId,
      userId: user.id,
      customerId: order.customerId,
      action: "CUSTOMER_CLINICAL_DOCUMENT_UPLOADED",
      metadata: { orderId: order.id, documentId: document.id, type }
    }
  });

  revalidatePath("/admin/pipeline");
  revalidatePath("/manager/pipeline");
  revalidatePath(`/admin/orders/${order.id}`);
  redirect(`${returnPath}?document=uploaded`);
}

export async function deleteOrderClinicalDocument(formData: FormData) {
  const user = await requireUser();
  const documentId = value(formData, "documentId");
  const returnPath = returnPipelinePath(user.role);

  if (!documentId || !user.companyId || (user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN")) {
    redirect(`${returnPath}?document=not_allowed`);
  }

  const document = await prisma.customerDocument.findFirst({
    where: {
      id: documentId,
      companyId: user.companyId
    },
    include: {
      order: true
    }
  });

  if (!document) {
    redirect(`${returnPath}?document=not_found`);
  }

  const supabase = createSupabaseAdminClient();
  await supabase.storage.from(document.storageBucket).remove([document.storagePath]);

  await prisma.customerDocument.delete({
    where: { id: document.id }
  });

  if (document.orderId) {
    const replacement = await prisma.customerDocument.findFirst({
      where: {
        orderId: document.orderId,
        type: document.type
      },
      orderBy: { createdAt: "desc" }
    });

    await prisma.order.update({
      where: { id: document.orderId },
      data:
        document.type === "RX"
          ? {
              rxDocumentUrl: replacement ? `/api/customer-documents/${replacement.id}` : null,
              rxNotes: replacement?.notes ?? null,
              rxStoredAt: replacement?.createdAt ?? null
            }
          : {
              gfeDocumentUrl: replacement ? `/api/customer-documents/${replacement.id}` : null,
              gfeNotes: replacement?.notes ?? null,
              gfeStoredAt: replacement?.createdAt ?? null
            }
    });
  }

  await prisma.activityLog.create({
    data: {
      companyId: document.companyId,
      userId: user.id,
      customerId: document.customerId,
      action: "CUSTOMER_CLINICAL_DOCUMENT_DELETED",
      metadata: { orderId: document.orderId, documentId: document.id, type: document.type }
    }
  });

  revalidatePath("/admin/pipeline");
  revalidatePath("/manager/pipeline");
  if (document.orderId) revalidatePath(`/admin/orders/${document.orderId}`);
  redirect(`${returnPath}?document=deleted`);
}

export async function updatePipelineOrderStage(formData: FormData) {
  const user = await requireUser();
  const orderId = value(formData, "orderId");
  const requestedStage = value(formData, "orderPipelineStage");
  const returnPath = returnPipelinePath(user.role);

  if (!orderId || !isOrderPipelineStage(requestedStage) || (user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN")) {
    redirect(`${returnPath}?stage=not_allowed`);
  }

  const order = await accessibleOrder(user, orderId);
  if (!order) {
    redirect(`${returnPath}?stage=not_found`);
  }

  const shippingCarrier = normalizeCarrier(value(formData, "shippingCarrier"));
  const shippingTrackingCode = value(formData, "shippingTrackingCode");
  const allowWithoutTracking = value(formData, "allowFulfillmentWithoutTracking") === "true";
  const qualiphyExamMode = value(formData, "qualiphyExamMode");
  const qualiphyExamId = value(formData, "qualiphyExamId");
  const qualiphyExamTitle = value(formData, "qualiphyExamTitle");
  const qualiphyExamRxType = value(formData, "qualiphyExamRxType");
  const qualiphyExamAttachmentsRequired = value(formData, "qualiphyExamAttachmentsRequired");
  const qualiphyTestMode = value(formData, "qualiphyTestMode") === "true";
  const now = new Date();
  const metadata = objectMetadata(order.referralMetadata);
  const shippingMetadata = metadataRecord(metadata.shippingAddress);
  const fallbackAddress = order.customer.addresses[0] ?? null;
  const patientState = stringField(shippingMetadata, "state") || fallbackAddress?.state || "";
  const patientPhone = phoneForWebhook(order.customer.phone);
  const patientDob = formatDateOnly(order.customer.dateOfBirth);

  let qualiphySelection: QualiphySelection | null =
    requestedStage === "GFE"
      ? {
          mode: qualiphyExamMode === "send" ? "SEND" : "SKIP",
          isTest: qualiphyExamMode === "send" && qualiphyTestMode,
          environment: qualiphyExamMode === "send" && qualiphyTestMode ? "test" : "live",
          selectedAt: now.toISOString(),
          selectedByUserId: user.id,
          exam:
            qualiphyExamMode === "send"
              ? {
                  id: Number(qualiphyExamId),
                  title: qualiphyExamTitle,
                  rxType: qualiphyExamRxType ? Number(qualiphyExamRxType) : null,
                  attachmentsRequired: qualiphyExamAttachmentsRequired ? Number(qualiphyExamAttachmentsRequired) : null
                }
              : null
        }
      : null;

  if (requestedStage === "GFE" && qualiphyExamMode !== "skip" && qualiphyExamMode !== "send") {
    redirect(`${returnPath}?stage=qualiphy_choice_required`);
  }

  if (requestedStage === "GFE" && qualiphyExamMode === "send" && (!qualiphyExamId || !qualiphyExamTitle || Number.isNaN(Number(qualiphyExamId)))) {
    redirect(`${returnPath}?stage=qualiphy_exam_required`);
  }

  if (requestedStage === "GFE" && qualiphyExamMode === "send") {
    if (!order.customer.firstName || !order.customer.lastName || !patientDob || !patientPhone || !patientState) {
      redirect(`${returnPath}?stage=qualiphy_patient_required`);
    }

    try {
      const invite = await sendQualiphyExamInvite({
        examId: Number(qualiphyExamId),
        firstName: order.customer.firstName,
        lastName: order.customer.lastName,
        email: order.customer.email,
        dob: patientDob,
        phoneNumber: patientPhone,
        state: patientState,
        teleState: patientState,
        webhookUrl: `${publicSiteBaseUrl()}/api/webhooks/qualiphy`,
        gender: genderForQualiphy(order.customer.birthSex),
        additionalData: {
          orderId: order.id,
          customerId: order.customerId,
          companyId: order.companyId,
          source: "go_virtual_health_crm",
          is_test: qualiphyTestMode,
          test_mode: qualiphyTestMode,
          environment: qualiphyTestMode ? "test" : "live"
        },
        addressLine1: stringField(shippingMetadata, "line1") || fallbackAddress?.line1,
        addressLine2: stringField(shippingMetadata, "line2") || fallbackAddress?.line2,
        city: stringField(shippingMetadata, "city") || fallbackAddress?.city,
        zipCode: stringField(shippingMetadata, "postalCode") || fallbackAddress?.postalCode,
        shippingAddressLine1: stringField(shippingMetadata, "line1") || fallbackAddress?.line1,
        shippingAddressLine2: stringField(shippingMetadata, "line2") || fallbackAddress?.line2,
        shippingCity: stringField(shippingMetadata, "city") || fallbackAddress?.city,
        shippingState: patientState,
        shippingZipCode: stringField(shippingMetadata, "postalCode") || fallbackAddress?.postalCode
      });

      qualiphySelection = {
        ...qualiphySelection!,
        invite: {
          sentAt: now.toISOString(),
          webhookUrl: `${publicSiteBaseUrl()}/api/webhooks/qualiphy`,
          meetingUrl: invite.meetingUrl,
          meetingUuid: invite.meetingUuid,
          patientExams: invite.patientExams,
          patientExamId: invite.patientExams[0]?.patientExamId ?? null,
          status: "PENDING"
        }
      };
    } catch (error) {
      redirect(`${returnPath}?stage=qualiphy_send_failed`);
    }
  }

  if ((requestedStage === "FULFILLMENT" || requestedStage === "SHIPPED") && !shippingTrackingCode && !order.shippingTrackingCode && !allowWithoutTracking) {
    redirect(`${returnPath}?stage=tracking_required`);
  }

  const nextCarrier = shippingCarrier || order.shippingCarrier;
  const nextTrackingCode = shippingTrackingCode || order.shippingTrackingCode;

  const nextPaymentStatus = requestedStage === "DEFERRED" && order.paymentStatus === "CAPTURED" ? "REFUNDED" : order.paymentStatus;

  if (requestedStage === "DEFERRED" && order.paymentStatus === "CAPTURED") {
    const confirmation = value(formData, "refundConfirmation").toLowerCase();
    if (confirmation !== "refunded") {
      redirect(`${returnPath}?stage=refund_confirmation_required`);
    }

    const transaction = order.paymentTransactions[0];
    if (!transaction?.providerTransactionId) {
      redirect(`${returnPath}?stage=refund_transaction_missing`);
    }

    const refund = await getPaymentProvider(order.paymentProviderCode as PaymentProviderCode).refundPayment({
      companyId: order.companyId,
      transactionId: transaction.providerTransactionId,
      amount: { amount: order.totalCents, currency: "USD" },
      reason: "requested_by_customer"
    });

    await prisma.paymentTransaction.create({
      data: {
        companyId: order.companyId,
        orderId: order.id,
        providerCode: order.paymentProviderCode,
        providerTransactionId: refund.providerTransactionId,
        amountCents: order.totalCents,
        status: "REFUNDED",
        eventType: "order.deferred_refund",
        rawEvent: jsonSafe(refund.raw ?? refund)
      }
    });
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        orderPipelineStage: requestedStage,
        orderPipelineUpdatedAt: now,
        orderStatus:
          requestedStage === "SHIPPED"
            ? "COMPLETED"
            : requestedStage === "DEFERRED"
              ? "REFUNDED"
              : requestedStage === "AWAITING_PAYMENT"
                ? "PENDING"
                : "PROCESSING",
        paymentStatus: nextPaymentStatus,
        ...(nextTrackingCode
          ? {
              shippingCarrier: nextCarrier || "other",
              shippingTrackingCode: nextTrackingCode,
              shippedAt: requestedStage === "SHIPPED" ? now : order.shippedAt
            }
          : {}),
        ...(requestedStage === "SHIPPED" && order.paymentStatus === "CAPTURED"
          ? { commissionStatus: "APPROVED" }
          : {}),
        ...(requestedStage === "DEFERRED"
          ? { commissionStatus: "REJECTED" }
          : {}),
        ...(qualiphySelection
          ? {
              referralMetadata: {
                ...metadata,
                qualiphy: qualiphySelection
              }
            }
          : {})
      }
    }),
    prisma.customer.update({
      where: { id: order.customerId },
      data: {
        pipelineStage: requestedStage,
        pipelineUpdatedAt: now
      }
    }),
    ...(requestedStage === "SHIPPED" && order.paymentStatus === "CAPTURED"
      ? [
          prisma.commission.updateMany({
            where: { orderId: order.id },
            data: { status: "APPROVED", approvedAt: now }
          }),
          prisma.commissionSplit.updateMany({
            where: { orderId: order.id },
            data: { status: "APPROVED" }
          })
        ]
      : []),
    ...(requestedStage === "DEFERRED"
      ? [
          prisma.commission.updateMany({
            where: { orderId: order.id },
            data: { status: "REJECTED" }
          }),
          prisma.commissionSplit.updateMany({
            where: { orderId: order.id },
            data: { status: "REJECTED" }
          })
        ]
      : []),
    prisma.activityLog.create({
      data: {
        companyId: order.companyId,
        userId: user.id,
        customerId: order.customerId,
        action: "ORDER_PIPELINE_UPDATED",
        metadata: {
          orderId: order.id,
          stage: requestedStage,
          label: orderPipelineLabel(requestedStage),
          trackingCode: nextTrackingCode,
          carrier: nextCarrier,
          qualiphy: qualiphySelection
        }
      }
    })
  ]);

  if (nextTrackingCode && (requestedStage === "FULFILLMENT" || requestedStage === "SHIPPED")) {
    await dispatchWebhookEvent({
      companyId: order.companyId,
      partnerProfileId: order.partnerProfileId ?? order.consultantProfile?.partnerProfileId,
      eventType: "shipment.tracking_ready",
      payload: {
        orderId: order.id,
        customerId: order.customerId,
        customerName: personName(order.customer),
        customerEmail: order.customer.email,
        customerPhone: phoneForWebhook(order.customer.phone),
        stage: requestedStage,
        carrier: nextCarrier,
        trackingCode: nextTrackingCode,
        trackingUrl: carrierTrackingUrl(nextCarrier, nextTrackingCode)
      }
    });
  }

  if (qualiphySelection?.mode === "SEND" && "invite" in qualiphySelection) {
    const invite = qualiphySelection.invite as {
      meetingUrl?: string | null;
      meetingUuid?: string | null;
      patientExamId?: string | number | null;
      patientExams?: unknown;
    };

    await dispatchWebhookEvent({
      companyId: order.companyId,
      partnerProfileId: order.partnerProfileId ?? order.consultantProfile?.partnerProfileId,
      eventType: "qualiphy.exam_invite_sent",
      payload: {
        orderId: order.id,
        customerId: order.customerId,
        customerName: personName(order.customer),
        customerEmail: order.customer.email,
        customerPhone: phoneForWebhook(order.customer.phone),
        stage: requestedStage,
        exam: {
          id: Number(qualiphyExamId),
          title: qualiphyExamTitle,
          rxType: qualiphyExamRxType ? Number(qualiphyExamRxType) : null
        },
        meetingUrl: invite.meetingUrl ?? null,
        meetingUuid: invite.meetingUuid ?? null,
        patientExamId: invite.patientExamId ?? null,
        patientExams: invite.patientExams ?? [],
        isTest: qualiphyTestMode,
        environment: qualiphyTestMode ? "test" : "live"
      }
    });
  }

  const customerName = personDisplayName(order.customer);
  const copy = pipelineNotificationCopy(requestedStage, customerName);
  const shouldNotifyStage =
    requestedStage === "GFE" ||
    requestedStage === "MEDICAL_REVIEW" ||
    requestedStage === "APPROVAL" ||
    requestedStage === "PRESCRIPTION_CONFIRMED" ||
    requestedStage === "FULFILLMENT" ||
    requestedStage === "SHIPPED" ||
    requestedStage === "DEFERRED";

  if (shouldNotifyStage) {
    await notifyUsers(
      prisma,
      orderRecipientUserIds(order).map((userId) => ({
        userId,
        title: copy.title,
        body: copy.body,
        metadata: {
          type: "order_stage",
          orderId: order.id,
          customerId: order.customerId,
          stage: requestedStage,
          trackingCode: nextTrackingCode || null,
          trackingUrl: nextTrackingCode ? carrierTrackingUrl(nextCarrier, nextTrackingCode) : null,
          qualiphyMode: qualiphySelection?.mode ?? null,
          qualiphyTest: qualiphySelection?.isTest ?? false
        }
      }))
    );
  }

  revalidatePath("/admin/pipeline");
  revalidatePath("/partner/pipeline");
  revalidatePath("/manager/pipeline");
  revalidatePath("/consultant/pipeline");
  revalidatePath("/admin/orders");
  redirect(`${returnPath}?stage=updated`);
}

export async function deleteUnpaidOrder(formData: FormData) {
  const user = await requireUser();
  const orderId = value(formData, "orderId");
  const returnPath = returnPipelinePath(user.role);
  const order = orderId ? await accessibleOrder(user, orderId) : null;

  if (!order) {
    redirect(`${returnPath}?delete=not_found`);
  }

  if (order.paymentStatus !== "PENDING") {
    redirect(`${returnPath}?delete=payment_collected`);
  }

  const canDelete =
    user.role === "COMPANY_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    (user.role === "PARTNER" && Boolean(user.partnerProfile?.id)) ||
    (user.role === "GROUP_LEADER" && Boolean(user.groupLeaderProfile?.id)) ||
    (user.role === "CONSULTANT" && order.consultantProfileId === user.consultantProfile?.id);

  if (!canDelete) {
    redirect(`${returnPath}?delete=not_allowed`);
  }

  await prisma.$transaction([
    prisma.commissionSplit.deleteMany({ where: { orderId: order.id } }),
    prisma.commission.deleteMany({ where: { orderId: order.id } }),
    prisma.paymentTransaction.deleteMany({ where: { orderId: order.id } }),
    prisma.orderItem.deleteMany({ where: { orderId: order.id } }),
    prisma.order.delete({ where: { id: order.id } }),
    prisma.activityLog.create({
      data: {
        companyId: order.companyId,
        userId: user.id,
        customerId: order.customerId,
        action: "UNPAID_ORDER_DELETED",
        metadata: { orderId: order.id }
      }
    })
  ]);

  revalidatePath("/admin/pipeline");
  revalidatePath("/partner/pipeline");
  revalidatePath("/manager/pipeline");
  revalidatePath("/consultant/pipeline");
  revalidatePath("/admin/orders");
  redirect(`${returnPath}?delete=deleted`);
}
