-- CreateTable
CREATE TABLE "EventView" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventView_pkey" PRIMARY KEY ("eventId","userId")
);

-- AddForeignKey
ALTER TABLE "EventView" ADD CONSTRAINT "EventView_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventView" ADD CONSTRAINT "EventView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
