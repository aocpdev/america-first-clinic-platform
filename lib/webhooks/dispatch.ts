import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type DispatchInput = {
  companyId: string;
  partnerProfileId?: string | null;
  eventType: string;
  payload: Prisma.InputJsonValue;
};

function signPayload(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export async function dispatchWebhookEvent(input: DispatchInput) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      companyId: input.companyId,
      isActive: true,
      events: { has: input.eventType },
      OR: [
        { partnerProfileId: null },
        ...(input.partnerProfileId ? [{ partnerProfileId: input.partnerProfileId }] : [])
      ]
    }
  });

  await Promise.all(
    endpoints.map(async (endpoint) => {
      const delivery = await prisma.webhookDelivery.create({
        data: {
          companyId: input.companyId,
          endpointId: endpoint.id,
          eventType: input.eventType,
          payload: input.payload
        }
      });
      const body = JSON.stringify({
        id: delivery.id,
        event: input.eventType,
        createdAt: new Date().toISOString(),
        data: input.payload
      });

      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-afc-event": input.eventType,
            "x-afc-delivery": delivery.id,
            "x-afc-signature": signPayload(endpoint.secret, body)
          },
          body
        });

        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            attempts: 1,
            status: response.ok ? "DELIVERED" : "FAILED",
            lastResponse: `${response.status} ${response.statusText}`,
            deliveredAt: response.ok ? new Date() : null,
            nextRetryAt: response.ok ? null : new Date(Date.now() + 1000 * 60 * 10)
          }
        });
      } catch (error) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            attempts: 1,
            status: "FAILED",
            lastResponse: error instanceof Error ? error.message : "unknown_error",
            nextRetryAt: new Date(Date.now() + 1000 * 60 * 10)
          }
        });
      }
    })
  );
}
