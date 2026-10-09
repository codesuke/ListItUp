import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { exportReportCsv } from "@/lib/report/report-csv-export";
import { toCsvDownloadResponse } from "@/lib/report/list-csv-export";

type RouteParams = { reportId: string };

// Downloads a saved Report's current live results as CSV (#47, ADR 0012).
// The session is read here; ownership, the live re-run, and the file
// itself all live in lib/report/.
export async function GET(_request: Request, { params }: { params: Promise<RouteParams> }) {
  const { reportId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user.emailVerified) {
    return new NextResponse(null, { status: 401 });
  }

  return toCsvDownloadResponse(
    await exportReportCsv(prisma, { actorUserId: session.user.id, reportId })
  );
}
