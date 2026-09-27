-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SalesOrderLine" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

