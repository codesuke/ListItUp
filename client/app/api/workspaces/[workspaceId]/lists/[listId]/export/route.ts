import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { exportListCsv } from "@/lib/report/list-csv-export";

type RouteParams = { workspaceId: string; listId: string };

// Downloads a whole List as CSV (#72, ADR 0012). The session is read here;
// authorization and the file itself live in lib/report/.
export async function GET(_request: Request, { params }: { params: Promise<RouteParams> }) {
  const { workspaceId, listId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user.emailVerified) {
    return new NextResponse(null, { status: 401 });
  }

  const result = await exportListCsv(prisma, { userId: session.user.id, workspaceId, listId });
  if (result.status !== "ok") {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(result.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
