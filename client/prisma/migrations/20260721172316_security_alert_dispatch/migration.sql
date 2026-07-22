-- CreateTable
CREATE TABLE "security_alert_dispatch" (
    "subject" TEXT NOT NULL,
    "alertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_alert_dispatch_pkey" PRIMARY KEY ("subject")
);
