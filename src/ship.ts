export type OrderRow = {
  id: number;
  customer_name: string;
  shipping_address: string;
};

export function buildShippingLabel(order: OrderRow): string {
  const address = order.shipping_address;
  const normalized = address.trim();
  return [`ORDER ${order.id}`, `TO ${order.customer_name}`, `ADDR ${normalized}`].join("\n");
}