-- AlterTable
ALTER TABLE "CarrierInvoice" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'UI';

-- AlterTable
ALTER TABLE "CustomerReturn" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'UI';

-- AlterTable
ALTER TABLE "Despatch" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'UI';

-- AlterTable
ALTER TABLE "GoodsReceipt" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'UI';

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'UI';

