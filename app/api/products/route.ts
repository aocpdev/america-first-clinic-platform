import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const user = await getCurrentUser();
  const company =
    user?.companyId
      ? await prisma.company.findUnique({ where: { id: user.companyId }, select: { id: true } })
      : await prisma.company.findUnique({ where: { slug: "america-first-clinic" }, select: { id: true } });

  if (!company?.id) {
    return NextResponse.json({ products: [] });
  }

  const products = await prisma.product.findMany({
    where: {
      companyId: company.id,
      active: true
    },
    include: {
      category: true,
      inventory: true,
      images: {
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: { title: "asc" }
  });

  return NextResponse.json({ products });
}
