/**
 * Step B — Testcontainers integration suite.
 * Spins a fresh Postgres container each run; does not use compose DBs.
 *
 * Covers the ~7 CRUD/order endpoints (customer CRUD + create order +
 * list orders by customer). For path-id endpoints: success / 400 / 404.
 * POST /customers and GET /customers (collection) have no missing-resource
 * 404; those cases assert the applicable client-error path instead.
 * POST /orders/:id/ship is covered lightly here (full clean-vs-clone stays
 * in test/ship.test.ts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { createApp } from "../../src/app.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const schemaSql = readFileSync(join(root, "db/sql/schema.sql"), "utf8");
const seedSql = readFileSync(join(root, "db/sql/seed.sql"), "utf8");

let container: StartedPostgreSqlContainer;
let pool: pg.Pool;
let server: Server;
let baseUrl: string;

function listen(httpServer: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", () => {
      const address = httpServer.address();
      if (address == null || typeof address === "string") {
        reject(new Error("expected a TCP port"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function jsonFetch(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

describe(
  "API integration (Testcontainers Postgres)",
  { timeout: 180_000 },
  () => {
    before(async () => {
      container = await new PostgreSqlContainer("postgres:16-alpine")
        .withDatabase("orders_test")
        .withUsername("orders")
        .withPassword("orders")
        .start();

      pool = new pg.Pool({ connectionString: container.getConnectionUri() });
      await pool.query(schemaSql);
      await pool.query(seedSql);

      server = createServer(createApp(pool));
      baseUrl = await listen(server);
    });

    after(async () => {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }
      if (pool) {
        await pool.end();
      }
      if (container) {
        await container.stop();
      }
    });

    // 1. POST /customers
    describe("POST /customers", () => {
      it("success → 201", async () => {
        const { status, body } = await jsonFetch("/customers", {
          method: "POST",
          body: JSON.stringify({
            name: "Test Müşteri",
            email: `test.customer.${Date.now()}@example.com`,
            phone: "0555 000 0001",
          }),
        });
        assert.equal(status, 201);
        const row = body as { id: number; name: string };
        assert.equal(row.name, "Test Müşteri");
        assert.ok(Number.isInteger(row.id));
      });

      it("bad input → 400 (missing name)", async () => {
        const { status, body } = await jsonFetch("/customers", {
          method: "POST",
          body: JSON.stringify({ email: "no-name@example.com" }),
        });
        assert.equal(status, 400);
        assert.deepEqual(body, { error: "name is required" });
      });

      it("bad input → 400 (missing email; create has no 404 path)", async () => {
        const { status, body } = await jsonFetch("/customers", {
          method: "POST",
          body: JSON.stringify({ name: "Adsız Email" }),
        });
        assert.equal(status, 400);
        assert.deepEqual(body, { error: "email is required" });
      });
    });

    // 2. GET /customers
    describe("GET /customers", () => {
      it("success → 200", async () => {
        const { status, body } = await jsonFetch("/customers");
        assert.equal(status, 200);
        assert.ok(Array.isArray(body));
        assert.ok((body as unknown[]).length >= 8);
      });

      it("bad input → 400 N/A (no path/query validation; still 200 list)", async () => {
        const { status, body } = await jsonFetch("/customers");
        assert.equal(status, 200);
        assert.ok(Array.isArray(body));
      });

      it("missing resource → 404 N/A (collection always 200 array)", async () => {
        const { status, body } = await jsonFetch("/customers");
        assert.equal(status, 200);
        assert.ok(Array.isArray(body));
        assert.ok((body as unknown[]).length > 0);
      });
    });

    // 3. GET /customers/:id
    describe("GET /customers/:id", () => {
      it("success → 200", async () => {
        const { status, body } = await jsonFetch("/customers/1");
        assert.equal(status, 200);
        assert.equal((body as { id: number }).id, 1);
        assert.equal((body as { name: string }).name, "Elif Demir");
      });

      it("bad input → 400", async () => {
        const { status, body } = await jsonFetch("/customers/not-an-id");
        assert.equal(status, 400);
        assert.deepEqual(body, { error: "invalid customer id" });
      });

      it("missing resource → 404", async () => {
        const { status, body } = await jsonFetch("/customers/999999");
        assert.equal(status, 404);
        assert.deepEqual(body, { error: "customer not found" });
      });
    });

    // 4. PUT /customers/:id
    describe("PUT /customers/:id", () => {
      it("success → 200", async () => {
        const { status, body } = await jsonFetch("/customers/2", {
          method: "PUT",
          body: JSON.stringify({
            name: "Mehmet Aksoy Güncel",
            email: "mehmet.aksoy@example.com",
            phone: "0532 111 0099",
          }),
        });
        assert.equal(status, 200);
        assert.equal((body as { name: string }).name, "Mehmet Aksoy Güncel");
      });

      it("bad input → 400", async () => {
        const { status, body } = await jsonFetch("/customers/2", {
          method: "PUT",
          body: JSON.stringify({ name: "", email: "x@example.com" }),
        });
        assert.equal(status, 400);
        assert.deepEqual(body, { error: "name is required" });
      });

      it("missing resource → 404", async () => {
        const { status, body } = await jsonFetch("/customers/999999", {
          method: "PUT",
          body: JSON.stringify({
            name: "Ghost",
            email: "ghost@example.com",
          }),
        });
        assert.equal(status, 404);
        assert.deepEqual(body, { error: "customer not found" });
      });
    });

    // 5. DELETE /customers/:id
    describe("DELETE /customers/:id", () => {
      it("success → 204", async () => {
        const created = await jsonFetch("/customers", {
          method: "POST",
          body: JSON.stringify({
            name: "Silinecek",
            email: `delete.me.${Date.now()}@example.com`,
          }),
        });
        assert.equal(created.status, 201);
        const id = (created.body as { id: number }).id;

        const { status, body } = await jsonFetch(`/customers/${id}`, {
          method: "DELETE",
        });
        assert.equal(status, 204);
        assert.equal(body, null);
      });

      it("bad input → 400", async () => {
        const { status, body } = await jsonFetch("/customers/abc", {
          method: "DELETE",
        });
        assert.equal(status, 400);
        assert.deepEqual(body, { error: "invalid customer id" });
      });

      it("missing resource → 404", async () => {
        const { status, body } = await jsonFetch("/customers/999999", {
          method: "DELETE",
        });
        assert.equal(status, 404);
        assert.deepEqual(body, { error: "customer not found" });
      });
    });

    // 6. POST /orders
    describe("POST /orders", () => {
      it("success → 201", async () => {
        const { status, body } = await jsonFetch("/orders", {
          method: "POST",
          body: JSON.stringify({
            customer_id: 1,
            product_id: 1,
            quantity: 2,
            shipping_address: "Bağdat Cad. No:1 Kadıköy/İstanbul",
          }),
        });
        assert.equal(status, 201);
        const row = body as { customer_id: number; quantity: number };
        assert.equal(row.customer_id, 1);
        assert.equal(row.quantity, 2);
      });

      it("bad input → 400", async () => {
        const { status, body } = await jsonFetch("/orders", {
          method: "POST",
          body: JSON.stringify({ product_id: 1, quantity: 1 }),
        });
        assert.equal(status, 400);
        assert.deepEqual(body, { error: "customer_id is required" });
      });

      it("missing resource → 404", async () => {
        const { status, body } = await jsonFetch("/orders", {
          method: "POST",
          body: JSON.stringify({
            customer_id: 999999,
            product_id: 1,
            quantity: 1,
            shipping_address: "X",
          }),
        });
        assert.equal(status, 404);
        assert.deepEqual(body, { error: "customer not found" });
      });
    });

    // 7. GET /customers/:id/orders
    describe("GET /customers/:id/orders", () => {
      it("success → 200", async () => {
        const { status, body } = await jsonFetch("/customers/1/orders");
        assert.equal(status, 200);
        assert.ok(Array.isArray(body));
        assert.ok((body as unknown[]).length >= 1);
        assert.equal((body as { customer_id: number }[])[0].customer_id, 1);
      });

      it("bad input → 400", async () => {
        const { status, body } = await jsonFetch("/customers/nope/orders");
        assert.equal(status, 400);
        assert.deepEqual(body, { error: "invalid customer id" });
      });

      it("missing resource → 404", async () => {
        const { status, body } = await jsonFetch("/customers/999999/orders");
        assert.equal(status, 404);
        assert.deepEqual(body, { error: "customer not found" });
      });
    });

    // Extra: ship (intentional trim fault stays; clean seed → success)
    describe("POST /orders/:id/ship", () => {
      it("success → 200 (seeded address present)", async () => {
        const { status, body } = await jsonFetch("/orders/1/ship", {
          method: "POST",
        });
        assert.equal(status, 200);
        const row = body as { orderId: number; label: string };
        assert.equal(row.orderId, 1);
        assert.ok(typeof row.label === "string" && row.label.length > 0);
      });

      it("bad input → 400", async () => {
        const { status, body } = await jsonFetch("/orders/xyz/ship", {
          method: "POST",
        });
        assert.equal(status, 400);
        assert.deepEqual(body, { error: "invalid order id" });
      });

      it("missing resource → 404", async () => {
        const { status, body } = await jsonFetch("/orders/999999/ship", {
          method: "POST",
        });
        assert.equal(status, 404);
        assert.deepEqual(body, { error: "order not found" });
      });
    });
  },
);
