/*
  Warnings:

  - A unique constraint covering the columns `[examPackageId,participantEmail]` on the table `Attempt` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Attempt" DROP CONSTRAINT "Attempt_userId_fkey";

-- AlterTable
ALTER TABLE "public"."Attempt" ADD COLUMN     "participantEmail" TEXT,
ADD COLUMN     "participantInfo" TEXT,
ADD COLUMN     "participantName" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Attempt_examPackageId_idx" ON "public"."Attempt"("examPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_examPackageId_participantEmail_key" ON "public"."Attempt"("examPackageId", "participantEmail");

-- AddForeignKey
ALTER TABLE "public"."Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
