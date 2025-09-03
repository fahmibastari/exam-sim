-- DropIndex
DROP INDEX "public"."Attempt_examPackageId_idx";

-- CreateIndex
CREATE INDEX "AnswerOption_questionId_isCorrect_idx" ON "public"."AnswerOption"("questionId", "isCorrect");

-- CreateIndex
CREATE INDEX "Attempt_examPackageId_startedAt_idx" ON "public"."Attempt"("examPackageId", "startedAt");

-- CreateIndex
CREATE INDEX "AttemptAnswer_attemptId_idx" ON "public"."AttemptAnswer"("attemptId");
