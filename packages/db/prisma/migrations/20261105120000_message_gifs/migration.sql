-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "gifHeight" INTEGER,
ADD COLUMN     "gifSlug" TEXT,
ADD COLUMN     "gifUrl" TEXT,
ADD COLUMN     "gifWidth" INTEGER;

-- CreateTable
CREATE TABLE "FavoriteGif" (
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteGif_pkey" PRIMARY KEY ("userId","slug")
);

-- AddForeignKey
ALTER TABLE "FavoriteGif" ADD CONSTRAINT "FavoriteGif_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
