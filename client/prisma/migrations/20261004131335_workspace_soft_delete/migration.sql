-- AlterTable
ALTER TABLE "workspace" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
