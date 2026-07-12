-- CreateTable
CREATE TABLE "verification_email_throttle" (
    "identifier" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_email_throttle_pkey" PRIMARY KEY ("identifier")
);
