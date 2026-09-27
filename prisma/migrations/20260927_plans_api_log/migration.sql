-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'STARTER';

-- CreateTable
CREATE TABLE "ApiRequestLog" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT,
    "tokenName" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiRequestLog_createdAt_idx" ON "ApiRequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "ApiRequestLog_tokenId_createdAt_idx" ON "ApiRequestLog"("tokenId", "createdAt");

