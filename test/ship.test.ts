import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import pg from "pg";
import { createApp } from "../src/app.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString: databaseUrl });

test.after(async () => {
  await pool.end();
});

type StoredOrder = {
  id: number;
  customer_name: string;
  shipping_address: string | null;
  status: string;
  payment_status: string;
};

type WriteAction = "ship" | "cancel" | "refund";

type Rehearsal = {
  action: WriteAction;
  /** True only when this write is safe to run on a real order. */
  safe: boolean;
  condition: string;
};

// The safe outcome is a business rule. The API does not enforce it: ship
// crashes on NULL and otherwise always returns 200, cancel always cancels,
// refund always pays the customer again.
function rehearsalFor(order: StoredOrder): Rehearsal {
  if (order.payment_status === "refunded" || order.status === "refunded") {
    return {
      action: "refund",
      safe: false,
      condition: "payment was already refunded",
    };
  }
  if (order.status === "cancelled" && order.payment_status === "unpaid") {
    return {
      action: "refund",
      safe: false,
      condition: "payment was never captured",
    };
  }
  if (order.status === "cancelled") {
    return {
      action: "cancel",
      safe: false,
      condition: "order is already cancelled",
    };
  }
  if (order.status === "shipped") {
    return {
      action: "ship",
      safe: false,
      condition: "order is already shipped",
    };
  }
  if (order.shipping_address == null) {
    return {
      action: "ship",
      safe: false,
      condition: "shipping address is missing (NULL)",
    };
  }
  if (order.payment_status === "unpaid") {
    return {
      action: "ship",
      safe: false,
      condition: "payment was never captured",
    };
  }
  if (order.status === "paid" && order.payment_status === "paid") {
    return {
      action: "ship",
      safe: true,
      condition: "paid order with an address",
    };
  }
  return {
    action: "ship",
    safe: false,
    condition: "order is in an unexpected historical state",
  };
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address == null || typeof address === "string") {
        reject(new Error("expected a TCP port"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

test("rehearses ship, cancel, and refund on every stored order", async () => {
  const found = await pool.query<StoredOrder>(
    `SELECT o.id, c.name AS customer_name, o.shipping_address, o.status, o.payment_status
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     ORDER BY o.id`,
  );

  assert.equal(
    found.rows.length,
    15,
    "expected the 15 seeded orders; this test does not insert its own rows",
  );

  const server = createServer(createApp(pool));
  const baseUrl = await listen(server);
  const failures: string[] = [];

  try {
    for (const order of found.rows) {
      const plan = rehearsalFor(order);
      const response = await fetch(`${baseUrl}/orders/${order.id}/${plan.action}`, {
        method: "POST",
      });
      const body = await response.text();
      const accepted = response.status === 200;
      const blocked = response.status === 409;
      const ok = plan.safe ? accepted : blocked;
      if (!ok) {
        failures.push(
          `order ${order.id} (${order.customer_name}): ${plan.condition}. POST /${plan.action} returned HTTP ${response.status} ${body}`,
        );
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});
