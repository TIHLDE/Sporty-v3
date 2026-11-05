-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" INTEGER;

-- AlterTable
ALTER TABLE "MessageReport" ADD COLUMN     "announcementCommentId" TEXT,
ADD COLUMN     "pollCommentId" TEXT,
ADD COLUMN     "senderId" TEXT,
ALTER COLUMN "messageId" DROP NOT NULL;

-- Rapporter fra før gjelder meldinger, så avsenderen finnes der.
UPDATE "MessageReport" r SET "senderId" = m."senderId" FROM "Message" m WHERE m."id" = r."messageId";
ALTER TABLE "MessageReport" ALTER COLUMN "senderId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MessageReport_announcementCommentId_reporterId_key" ON "MessageReport"("announcementCommentId", "reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReport_pollCommentId_reporterId_key" ON "MessageReport"("pollCommentId", "reporterId");

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_announcementCommentId_fkey" FOREIGN KEY ("announcementCommentId") REFERENCES "AnnouncementComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_pollCommentId_fkey" FOREIGN KEY ("pollCommentId") REFERENCES "PollComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
