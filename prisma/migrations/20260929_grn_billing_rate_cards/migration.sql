-- Three-way match: billed state per goods receipt (set by the ledger-app
-- ack or by hand), plus carrier rate cards (zone x size-band pricing, the
-- fallback expected-carriage source when a 3PL cannot supply the rate).

ALTER TABLE "GoodsReceipt" ADD COLUMN "billedAt" TIMESTAMP(3);
ALTER TABLE "GoodsReceipt" ADD COLUMN "billExternalRef" TEXT;

CREATE TABLE "CarrierRateCard" (
    "id" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basis" TEXT NOT NULL DEFAULT 'PALLET',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CarrierRateCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarrierRateZone" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "postcodeAreas" TEXT[],
    "perExtraUnitPence" INTEGER,
    CONSTRAINT "CarrierRateZone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarrierRateBreak" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "upTo" INTEGER NOT NULL,
    "pricePence" INTEGER NOT NULL,
    CONSTRAINT "CarrierRateBreak_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CarrierRateZone" ADD CONSTRAINT "CarrierRateZone_cardId_fkey"
  FOREIGN KEY ("cardId") REFERENCES "CarrierRateCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarrierRateBreak" ADD CONSTRAINT "CarrierRateBreak_zoneId_fkey"
  FOREIGN KEY ("zoneId") REFERENCES "CarrierRateZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
