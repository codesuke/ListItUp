import { NextResponse } from "next/server";

import { createDueDateReminders } from "@/lib/notification/notification-triggers";
import { hasSchedulerAuthorization } from "@/lib/security/security-operations";
import { prisma } from "@/lib/prisma";

// Scheduled invocation for #53's due-date reminders, mirroring the
// security-retention endpoint's auth shape: a daily secret-authenticated
// endpoint called by the deployment platform's cron (docs/QnA/
// authentication-and-account-recovery.md Q15).
export async function POST(request: Request) {
  const schedulerSecret = process.env.DUE_DATE_REMINDER_SCHEDULER_SECRET;
  if (
    !schedulerSecret ||
    !hasSchedulerAuthorization(
      request.headers.get("authorization"),
      schedulerSecret
    )
  ) {
    return new NextResponse(null, { status: 401 });
  }

  return NextResponse.json(
    await createDueDateReminders(prisma, { now: new Date() })
  );
}
