-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "usesMatchFacts" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MatchStatType" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "MatchStatType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchStat" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchStatType_groupId_sortOrder_idx" ON "MatchStatType"("groupId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MatchStatType_groupId_name_key" ON "MatchStatType"("groupId", "name");

-- CreateIndex
CREATE INDEX "MatchStat_eventId_idx" ON "MatchStat"("eventId");

-- AddForeignKey
ALTER TABLE "MatchStatType" ADD CONSTRAINT "MatchStatType_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchStat" ADD CONSTRAINT "MatchStat_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchStat" ADD CONSTRAINT "MatchStat_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "MatchStatType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchStat" ADD CONSTRAINT "MatchStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Standardtypene for hovedgruppene som finnes. Nye hovedgrupper får dem når de lages.
INSERT INTO "MatchStatType" ("id", "groupId", "name", "sortOrder")
SELECT gen_random_uuid()::text, g."id", t."name", t."sortOrder"
FROM "Group" g
CROSS JOIN (VALUES ('Mål', 0), ('Assist', 1), ('Banens beste', 2), ('Gult kort', 3), ('Rødt kort', 4)) AS t("name", "sortOrder")
WHERE g."parentId" IS NULL;
