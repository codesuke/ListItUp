/*
  Warnings:

  - You are about to drop the `guest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "guest" DROP CONSTRAINT "guest_listId_fkey";

-- DropForeignKey
ALTER TABLE "guest" DROP CONSTRAINT "guest_userId_fkey";

-- DropTable
DROP TABLE "guest";
