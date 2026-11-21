-- Shared schema for orders_clean and orders_prodlike.
-- shipping_address stays nullable: older store-pickup orders never stored an address.

CREATE TABLE customers (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  phone       TEXT
);

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0)
);

CREATE TABLE orders (
  id               SERIAL PRIMARY KEY,
  customer_id      INTEGER NOT NULL REFERENCES customers (id),
  product_id       INTEGER NOT NULL REFERENCES products (id),
  quantity         INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  shipping_address TEXT,
  -- pending: checkout açık. paid: tahsil edilmiş, henüz kargolanmamış.
  -- shipped / cancelled / refunded: geçmiş kayıtlarda da görülebilir.
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled', 'refunded')),
  payment_status   TEXT NOT NULL DEFAULT 'unpaid'
                   CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX orders_customer_id_idx ON orders (customer_id);
