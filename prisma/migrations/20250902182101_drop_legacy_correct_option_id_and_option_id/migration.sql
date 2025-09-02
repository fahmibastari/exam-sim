/*
  Warnings:

  - You are about to drop the column `optionId` on the `AttemptAnswer` table. All the data in the column will be lost.
  - You are about to drop the column `correctOptionId` on the `Question` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[examPackageId,order]` on the table `Question` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTI_SELECT', 'TRUE_FALSE', 'SHORT_TEXT', 'ESSAY', 'NUMBER', 'RANGE');

-- AlterTable
ALTER TABLE "public"."AnswerOption" ADD COLUMN     "isCorrect" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Attempt" ALTER COLUMN "score" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "total" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."AttemptAnswer" DROP COLUMN "optionId",
ADD COLUMN     "gradedAt" TIMESTAMP(3),
ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "selectedOptionIds" TEXT[],
ADD COLUMN     "valueJson" JSONB,
ADD COLUMN     "valueNumber" DOUBLE PRECISION,
ADD COLUMN     "valueText" TEXT;

-- AlterTable
ALTER TABLE "public"."Question" DROP COLUMN "correctOptionId",
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "required" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "type" "public"."QuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE';

-- CreateIndex
CREATE UNIQUE INDEX "Question_examPackageId_order_key" ON "public"."Question"("examPackageId", "order");
