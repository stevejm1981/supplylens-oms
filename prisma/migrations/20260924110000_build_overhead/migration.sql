-- AlterTable
ALTER TABLE "ProductionOrder" ADD COLUMN     "overheadNote" TEXT,
ADD COLUMN     "overheadPence" INTEGER NOT NULL DEFAULT 0;

