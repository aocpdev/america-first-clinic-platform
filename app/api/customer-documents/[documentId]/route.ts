import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const user = await requireUser();
  const { documentId } = await params;
  const download = new URL(request.url).searchParams.get("download") === "1";

  if (!user.companyId || (user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const document = await prisma.customerDocument.findFirst({
    where: {
      id: documentId,
      companyId: user.companyId
    }
  });

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(document.storageBucket)
    .createSignedUrl(document.storagePath, 60, download ? { download: document.fileName } : undefined);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Document unavailable" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
