-- CreateTable
CREATE TABLE "GroupOffice" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "GroupOffice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficePeriod" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,

    CONSTRAINT "OfficePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeHolder" (
    "periodId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "OfficeHolder_pkey" PRIMARY KEY ("periodId","officeId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupOffice_groupId_name_key" ON "GroupOffice"("groupId", "name");

-- CreateIndex
CREATE INDEX "OfficePeriod_groupId_startsOn_idx" ON "OfficePeriod"("groupId", "startsOn");

-- CreateIndex
CREATE INDEX "OfficeHolder_userId_idx" ON "OfficeHolder"("userId");

-- AddForeignKey
ALTER TABLE "GroupOffice" ADD CONSTRAINT "GroupOffice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficePeriod" ADD CONSTRAINT "OfficePeriod_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeHolder" ADD CONSTRAINT "OfficeHolder_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "OfficePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeHolder" ADD CONSTRAINT "OfficeHolder_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "GroupOffice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeHolder" ADD CONSTRAINT "OfficeHolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

