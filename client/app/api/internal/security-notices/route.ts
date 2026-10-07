import { NextResponse } from "next/server";

import { mailer } from "@/lib/mailer/mailer";
import { prisma } from "@/lib/prisma";
import { securityAlertService } from "@/lib/auth/auth";
import { deliverDueSecurityNotices } from "@/lib/security/security-notice-outbox";
import { hasSchedulerAuthorization } from "@/lib/security/security-operations";

// Scheduled invocation for #61's security-notice outbox delivery, mirroring
// the security-retention endpoint's auth shape: a secret-authenticated
// endpoint called by the deployment platform's cron (docs/QnA/
// authentication-and-account-recovery.md Q15), reusing that same mechanism
// rather than adding a second scheduler.
export async function POST(request: Request) {
  const schedulerSecret = process.env.SECURITY_NOTICE_SCHEDULER_SECRET;
  if (
    !schedulerSecret ||
    !hasSchedulerAuthorization(
      request.headers.get("authorization"),
      schedulerSecret
    )
  ) {
    return new NextResponse(null, { status: 401 });
  }

  await deliverDueSecurityNotices(
    prisma,
    mailer,
    new Date(),
    securityAlertService
  );

  return new NextResponse(null, { status: 204 });
}
