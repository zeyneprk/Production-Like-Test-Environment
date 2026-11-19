export type OrderRow = {
  id: number;
  customer_name: string;
  // Typed as string because the ship path assumes an address always exists.
  // The column is nullable in SQL; NULL rows crash on .trim() at runtime.
  shipping_address: string;
};

export function buildShippingLabel(order: OrderRow): string {
  const address = order.shipping_address;
  // Store pickup used to be allowed, so older orders can have a NULL
  // shipping address. This path does not check for that and throws.
  const normalized = address.trim();
  return [`ORDER ${order.id}`, `TO ${order.customer_name}`, `ADDR ${normalized}`].join("\n");
}
