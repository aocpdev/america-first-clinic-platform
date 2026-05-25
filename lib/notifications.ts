import type { Prisma } from "@prisma/client";

type NotificationDb = {
  user: {
    findMany(args: {
      where: Prisma.UserWhereInput;
      select: { id: true };
    }): Promise<Array<{ id: string }>>;
  };
  notification: {
    createMany(args: {
      data: Array<{
        userId: string;
        title: string;
        body: string;
        metadata?: Prisma.InputJsonValue;
      }>;
    }): Promise<unknown>;
  };
};

export type NotificationInput = {
  userId?: string | null;
  title: string;
  body: string;
  metadata?: Prisma.InputJsonValue;
};

export function moneyFromCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

export function personDisplayName(person: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email || "Customer";
}

export async function companyAdminUserIds(db: NotificationDb, companyId: string) {
  const admins = await db.user.findMany({
    where: {
      companyId,
      role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN"] },
      status: "ACTIVE",
      isActive: true
    },
    select: { id: true }
  });

  return admins.map((admin) => admin.id);
}

export async function notifyUsers(db: NotificationDb, notifications: NotificationInput[]) {
  const seen = new Set<string>();
  const data = notifications
    .filter((notification) => {
      if (!notification.userId || seen.has(notification.userId)) return false;
      seen.add(notification.userId);
      return true;
    })
    .map((notification) => ({
      userId: notification.userId!,
      title: notification.title,
      body: notification.body,
      metadata: notification.metadata
    }));

  if (!data.length) return;
  await db.notification.createMany({ data });
}

export function orderRecipientUserIds(order: {
  consultantProfile?: { userId?: string | null } | null;
  groupLeaderProfile?: { userId?: string | null } | null;
  partnerProfile?: { userId?: string | null } | null;
}) {
  return [order.consultantProfile?.userId, order.groupLeaderProfile?.userId, order.partnerProfile?.userId].filter(Boolean) as string[];
}
