// Append-only stock ledger. Call recordMovement INSIDE the same transaction,
// AFTER the StockLevel mutation, so balanceAfter reads the post-event quantity
// and the ledger can never disagree with the level it explains.

import type { Prisma } from "@/generated/prisma/client";

export type MovementType =
  | "OPENING"
  | "PO_RECEIPT"
  | "DESPATCH"
  | "CREDIT_RESTOCK"
  | "CUSTOMER_RETURN"
  | "SUPPLIER_RETURN"
  | "ADJUSTMENT"
  | "TRANSFER"
  | "ASSEMBLY_BUILD";

export const movementTypeLabels: Record<string, string> = {
  OPENING: "Opening balance",
  PO_RECEIPT: "PO receipt",
  DESPATCH: "Despatch",
  CREDIT_RESTOCK: "Credit restock",
  CUSTOMER_RETURN: "Customer return",
  SUPPLIER_RETURN: "Supplier return",
  ADJUSTMENT: "Adjustment",
  TRANSFER: "Warehouse transfer",
  ASSEMBLY_BUILD: "Production build",
};

export async function recordMovement(
  tx: Prisma.TransactionClient,
  event: {
    productId: string;
    warehouseId: string;
    quantity: number; // signed
    type: MovementType;
    reference: string;
    referenceId?: string | null;
    notes?: string | null;
    createdAt?: Date;
  },
): Promise<void> {
  const level = await tx.stockLevel.findUnique({
    where: {
      productId_warehouseId: {
        productId: event.productId,
        warehouseId: event.warehouseId,
      },
    },
  });
  await tx.stockMovement.create({
    data: {
      productId: event.productId,
      warehouseId: event.warehouseId,
      quantity: event.quantity,
      balanceAfter: level?.quantity ?? 0,
      type: event.type,
      reference: event.reference,
      referenceId: event.referenceId ?? null,
      notes: event.notes ?? null,
      ...(event.createdAt ? { createdAt: event.createdAt } : {}),
    },
  });
}
