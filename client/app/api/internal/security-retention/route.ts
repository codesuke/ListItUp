import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  cleanExpiredSecurityRecords,
  hasSchedulerAuthorization,
} from "@/lib/security/security-operations";

export async function POST(request: Request) {
  const schedulerSecret = process.env.SECURITY_CLEANUP_SCHEDULER_SECRET;
  if (
    !schedulerSecret ||
    !hasSchedulerAuthorization(
      request.headers.get("authorization"),
      schedulerSecret
    )
  ) {
    return new NextResponse(null, { status: 401 });
  }

  return NextResponse.json(await cleanExpiredSecurityRecords(prisma));
}
