-- CreateTable
CREATE TABLE "security_notice_outbox" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "action" TEXT,
    "newEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "finalFailureAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_notice_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_notice_outbox_status_nextAttemptAt_idx" ON "security_notice_outbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "security_notice_outbox_status_finalFailureAt_idx" ON "security_notice_outbox"("status", "finalFailureAt");
