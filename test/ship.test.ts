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

test("ships every order already in the database", async () => {
  const found = await pool.query<{
    id: number;
    customer_name: string;
    shipping_address: string | null;
  }>(
    `SELECT o.id, c.name AS customer_name, o.shipping_address
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
      const response = await fetch(`${baseUrl}/orders/${order.id}/ship`, { method: "POST" });
      const body = await response.text();
      if (response.status !== 200) {
        const reason =
          order.shipping_address == null
            ? "shipping address is missing (NULL)"
            : "unexpected failure";
        failures.push(
          `order ${order.id} (${order.customer_name}): ${reason}. HTTP ${response.status} ${body}`,
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
