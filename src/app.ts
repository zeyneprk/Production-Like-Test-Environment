import express from "express";
import type { Pool } from "pg";
import { buildShippingLabel, type OrderRow } from "./ship.js";

type CustomerRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
};

type OrderListRow = {
  id: number;
  customer_id: number;
  product_id: number;
  quantity: number;
  shipping_address: string | null;
  status: string;
  created_at: Date;
};

export function createApp(pool: Pool): express.Express {
  const app = express();
  app.use(express.json());

  // --- customers -----------------------------------------------------------

  app.post("/customers", async (req, res) => {
    const { name, email, phone } = req.body ?? {};
    if (typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (typeof email !== "string" || email.trim() === "") {
      res.status(400).json({ error: "email is required" });
      return;
    }
    const phoneValue = phone == null ? null : String(phone);

    try {
      const inserted = await pool.query<CustomerRow>(
        `INSERT INTO customers (name, email, phone)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, phone`,
        [name.trim(), email.trim(), phoneValue],
      );
      res.status(201).json(inserted.rows[0]);
    } catch (err) {
      respondError(res, err);
    }
  });

  app.get("/customers", async (_req, res) => {
    try {
      const found = await pool.query<CustomerRow>(
        "SELECT id, name, email, phone FROM customers ORDER BY id",
      );
      res.status(200).json(found.rows);
    } catch (err) {
      respondError(res, err);
    }
  });

  app.get("/customers/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (id == null) {
      res.status(400).json({ error: "invalid customer id" });
      return;
    }
    try {
      const found = await pool.query<CustomerRow>(
        "SELECT id, name, email, phone FROM customers WHERE id = $1",
        [id],
      );
      const customer = found.rows[0];
      if (!customer) {
        res.status(404).json({ error: "customer not found" });
        return;
      }
      res.status(200).json(customer);
    } catch (err) {
      respondError(res, err);
    }
  });

  app.put("/customers/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (id == null) {
      res.status(400).json({ error: "invalid customer id" });
      return;
    }
    const { name, email, phone } = req.body ?? {};
    if (typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (typeof email !== "string" || email.trim() === "") {
      res.status(400).json({ error: "email is required" });
      return;
    }
    const phoneValue = phone == null ? null : String(phone);

    try {
      const updated = await pool.query<CustomerRow>(
        `UPDATE customers
         SET name = $2, email = $3, phone = $4
         WHERE id = $1
         RETURNING id, name, email, phone`,
        [id, name.trim(), email.trim(), phoneValue],
      );
      const customer = updated.rows[0];
      if (!customer) {
        res.status(404).json({ error: "customer not found" });
        return;
      }
      res.status(200).json(customer);
    } catch (err) {
      respondError(res, err);
    }
  });

  app.delete("/customers/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (id == null) {
      res.status(400).json({ error: "invalid customer id" });
      return;
    }
    try {
      const deleted = await pool.query(
        "DELETE FROM customers WHERE id = $1 RETURNING id",
        [id],
      );
      if (deleted.rowCount === 0) {
        res.status(404).json({ error: "customer not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      respondError(res, err);
    }
  });

  // --- orders --------------------------------------------------------------

  app.post("/orders", async (req, res) => {
    const { customer_id, product_id, quantity, shipping_address } = req.body ?? {};
    const customerId = Number(customer_id);
    const productId = Number(product_id);
    const qty = quantity == null ? 1 : Number(quantity);

    if (!Number.isInteger(customerId)) {
      res.status(400).json({ error: "customer_id is required" });
      return;
    }
    if (!Number.isInteger(productId)) {
      res.status(400).json({ error: "product_id is required" });
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      res.status(400).json({ error: "quantity must be a positive integer" });
      return;
    }

    // Explicit null keeps store-pickup / missing-address rows representable.
    let address: string | null = null;
    if (shipping_address != null) {
      if (typeof shipping_address !== "string") {
        res.status(400).json({ error: "shipping_address must be a string or null" });
        return;
      }
      address = shipping_address;
    }

    try {
      const customer = await pool.query(
        "SELECT id FROM customers WHERE id = $1",
        [customerId],
      );
      if (!customer.rows[0]) {
        res.status(404).json({ error: "customer not found" });
        return;
      }
      const product = await pool.query(
        "SELECT id FROM products WHERE id = $1",
        [productId],
      );
      if (!product.rows[0]) {
        res.status(404).json({ error: "product not found" });
        return;
      }

      const inserted = await pool.query<OrderListRow>(
        `INSERT INTO orders (customer_id, product_id, quantity, shipping_address)
         VALUES ($1, $2, $3, $4)
         RETURNING id, customer_id, product_id, quantity, shipping_address, status, created_at`,
        [customerId, productId, qty, address],
      );
      res.status(201).json(inserted.rows[0]);
    } catch (err) {
      respondError(res, err);
    }
  });

  app.get("/customers/:id/orders", async (req, res) => {
    const id = parseId(req.params.id);
    if (id == null) {
      res.status(400).json({ error: "invalid customer id" });
      return;
    }
    try {
      const customer = await pool.query(
        "SELECT id FROM customers WHERE id = $1",
        [id],
      );
      if (!customer.rows[0]) {
        res.status(404).json({ error: "customer not found" });
        return;
      }

      const found = await pool.query<OrderListRow>(
        `SELECT id, customer_id, product_id, quantity, shipping_address, status, created_at
         FROM orders
         WHERE customer_id = $1
         ORDER BY id`,
        [id],
      );
      res.status(200).json(found.rows);
    } catch (err) {
      respondError(res, err);
    }
  });

  // Intentional address fault: trim() with no null check → crash on NULL.
  app.post("/orders/:id/ship", async (req, res) => {
    const id = parseId(req.params.id);
    if (id == null) {
      res.status(400).json({ error: "invalid order id" });
      return;
    }

    try {
      const found = await pool.query<OrderRow>(
        `SELECT o.id, c.name AS customer_name, o.shipping_address
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         WHERE o.id = $1`,
        [id],
      );
      const order = found.rows[0];
      if (!order) {
        res.status(404).json({ error: "order not found" });
        return;
      }

      const label = buildShippingLabel(order);
      await pool.query(
        `UPDATE orders SET status = 'shipped' WHERE id = $1`,
        [order.id],
      );
      res.status(200).json({ orderId: order.id, label });
    } catch (err) {
      respondError(res, err);
    }
  });

  return app;
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

function respondError(res: express.Response, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).json({ error: message });
}
