-- Same rows as the clean seed, then historical shapes a developer fixture misses.
-- The rehearsal calls the real write API once per order. These rows make that
-- write unsafe: a second label, a refund of money that was never captured, or
-- a crash on a store-pickup address.

-- Store pickup. The address was never stored.
UPDATE orders
SET shipping_address = NULL
WHERE id IN (3, 7);

-- Checkout started, payment never captured.
UPDATE orders
SET status = 'pending', payment_status = 'unpaid'
WHERE id = 2;

-- Already refunded once. Refunding again would send the money twice.
UPDATE orders
SET status = 'refunded', payment_status = 'refunded'
WHERE id = 5;

-- Cancelled before payment. A refund would still pay the customer.
UPDATE orders
SET status = 'cancelled', payment_status = 'unpaid'
WHERE id = 6;

-- Carrier label already created.
UPDATE orders
SET status = 'shipped'
WHERE id = 11;

-- Paid, then cancelled. The new ship path still accepts it.
UPDATE orders
SET status = 'cancelled'
WHERE id = 14;

-- One still-valid order keeps a long Turkish address.
UPDATE orders
SET shipping_address = 'Çağdaş Yaşam Blv. No:128/A Daire:7 '
  || 'Üsküdar/İstanbul — kapı kodu: ğüşçıö '
  || '(teslimat notu: akşam 19:00''den sonra zili çalma, komşuya bırak)'
WHERE id = 1;
