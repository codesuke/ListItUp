-- AlterTable
ALTER TABLE "workspace_invitation" ADD COLUMN     "invitedById" TEXT;

-- AddForeignKey
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
