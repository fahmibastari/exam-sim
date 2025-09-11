-- AlterTable
ALTER TABLE "public"."AnswerOption" ADD COLUMN     "order" INTEGER;

-- AlterTable
ALTER TABLE "public"."Question" ADD COLUMN     "contextText" TEXT,
ADD COLUMN     "passageId" TEXT;

-- CreateTable
CREATE TABLE "public"."Passage" (
    "id" TEXT NOT NULL,
    "examPackageId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Passage_examPackageId_idx" ON "public"."Passage"("examPackageId");

-- CreateIndex
CREATE INDEX "AnswerOption_questionId_label_idx" ON "public"."AnswerOption"("questionId", "label");

-- CreateIndex
CREATE INDEX "AnswerOption_questionId_order_idx" ON "public"."AnswerOption"("questionId", "order");

-- CreateIndex
CREATE INDEX "Question_passageId_idx" ON "public"."Question"("passageId");

-- AddForeignKey
ALTER TABLE "public"."Passage" ADD CONSTRAINT "Passage_examPackageId_fkey" FOREIGN KEY ("examPackageId") REFERENCES "public"."ExamPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Question" ADD CONSTRAINT "Question_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "public"."Passage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
