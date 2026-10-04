import { NextResponse } from "next/server";

import { purgeExpiredWorkspaces } from "@/lib/workspace/workspace-purge";
import { deleteAttachmentObject } from "@/lib/storage/object-storage";
import { hasSchedulerAuthorization } from "@/lib/security/security-operations";
import { mailer } from "@/lib/mailer/mailer";
import { prisma } from "@/lib/prisma";

// Scheduled invocation for #79's Workspace purge, mirroring the
// security-retention endpoint's auth shape: a daily secret-authenticated
// endpoint called by the deployment platform's cron (docs/QnA/
// authentication-and-account-recovery.md Q15), reusing that same
// mechanism rather than adding a second scheduler.
export async function POST(request: Request) {
  const schedulerSecret = process.env.WORKSPACE_PURGE_SCHEDULER_SECRET;
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
    await purgeExpiredWorkspaces(
      prisma,
      { mailer, objectStore: { deleteObject: deleteAttachmentObject } },
      new Date()
    )
  );
}
