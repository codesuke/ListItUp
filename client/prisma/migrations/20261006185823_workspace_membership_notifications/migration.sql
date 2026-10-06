-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'WORKSPACE_MEMBER_REMOVED';
ALTER TYPE "NotificationType" ADD VALUE 'WORKSPACE_ROLE_CHANGED';

-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "newRole" "WorkspaceRole",
ADD COLUMN     "workspaceId" TEXT,
ALTER COLUMN "itemId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
