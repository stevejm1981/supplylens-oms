-- AlterTable
ALTER TABLE "Despatch" ADD COLUMN     "expectedCarriagePence" INTEGER;

-- CreateTable
CREATE TABLE "CarrierInvoice" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarrierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT,
    "consignmentRef" TEXT,
    "amountPence" INTEGER NOT NULL,

    CONSTRAINT "CarrierInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierAllocation" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "despatchId" TEXT NOT NULL,
    "amountPence" INTEGER NOT NULL,

    CONSTRAINT "CarrierAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CarrierInvoice_reference_key" ON "CarrierInvoice"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierAllocation_lineId_despatchId_key" ON "CarrierAllocation"("lineId", "despatchId");

-- AddForeignKey
ALTER TABLE "CarrierInvoiceLine" ADD CONSTRAINT "CarrierInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CarrierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierAllocation" ADD CONSTRAINT "CarrierAllocation_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "CarrierInvoiceLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierAllocation" ADD CONSTRAINT "CarrierAllocation_despatchId_fkey" FOREIGN KEY ("despatchId") REFERENCES "Despatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

