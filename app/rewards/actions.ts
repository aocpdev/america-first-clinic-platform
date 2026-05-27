"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { companyAdminUserIds, notifyUsers, personDisplayName } from "@/lib/notifications";

export async function redeemRewardCampaign(formData: FormData) {
  const claimId = String(formData.get("claimId") ?? "");
  const user = await getCurrentUser();
  if (!user || !user.companyId || !claimId) return;

  const claim = await prisma.rewardCampaignClaim.findFirst({
    where: {
      id: claimId,
      companyId: user.companyId,
      userId: user.id,
      rewardValueType: "NON_CASH",
      status: "EARNED"
    },
    include: {
      campaign: { select: { id: true, title: true, rewardTitle: true } },
      user: { select: { firstName: true, lastName: true, email: true } }
    }
  });
  if (!claim) return;

  await prisma.rewardCampaignClaim.update({
    where: { id: claim.id },
    data: { status: "REDEEM_REQUESTED", redeemedAt: new Date() }
  });

  const adminIds = await companyAdminUserIds(prisma, user.companyId);
  await notifyUsers(
    prisma,
    adminIds.map((adminId) => ({
      userId: adminId,
      title: "Reward redemption requested",
      body: `${personDisplayName(claim.user)} requested ${claim.campaign.rewardTitle} from ${claim.campaign.title}.`,
      metadata: {
        type: "reward_redeem",
        claimId: claim.id,
        campaignId: claim.campaign.id,
        userId: user.id
      }
    }))
  );

  revalidatePath("/admin/rewards");
  revalidatePath("/consultant/rewards");
  revalidatePath("/partner/rewards");
  revalidatePath("/manager/dashboard");
}
