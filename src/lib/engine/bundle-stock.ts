// Derived (virtual) bundle availability. Pure functions only.
// A bundle's effective stock = min over components of floor(componentStock / qtyPerBundle).
// No assembly transaction, components are never reserved, so two bundles sharing
// a component intentionally both count it (standard virtual-bundle behaviour).

export interface BundleDefinition {
  bundleId: string;
  components: { componentId: string; quantity: number }[];
}

/** Effective stock for one bundle given total component stock on hand. */
export function bundleAvailability(
  components: { componentId: string; quantity: number }[],
  stockByProduct: Map<string, number>,
): number {
  if (components.length === 0) return 0;
  let min = Infinity;
  for (const c of components) {
    if (c.quantity <= 0) return 0;
    const available = Math.floor((stockByProduct.get(c.componentId) ?? 0) / c.quantity);
    min = Math.min(min, available);
  }
  return Number.isFinite(min) ? min : 0;
}

/**
 * Effective stock per sellable product:
 * STANDARD products → their physical stock; bundles → derived availability.
 */
export function computeEffectiveStock(
  products: { id: string; type: string }[],
  bundles: BundleDefinition[],
  stockByProduct: Map<string, number>,
): Map<string, number> {
  const bundleMap = new Map(bundles.map((b) => [b.bundleId, b.components]));
  const result = new Map<string, number>();
  for (const p of products) {
    if (p.type === "BUNDLE") {
      result.set(p.id, bundleAvailability(bundleMap.get(p.id) ?? [], stockByProduct));
    } else {
      result.set(p.id, stockByProduct.get(p.id) ?? 0);
    }
  }
  return result;
}
