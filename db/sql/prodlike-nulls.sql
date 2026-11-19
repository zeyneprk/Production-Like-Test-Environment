-- Same structure as clean seed. A few older store-pickup rows never
-- stored a shipping address (NULL). Also stretch one address with
-- Turkish characters / longer text for realism. Row count stays small.

UPDATE orders
SET shipping_address = NULL
WHERE id IN (3, 7, 11, 14);

UPDATE orders
SET shipping_address = 'Çağdaş Yaşam Blv. No:128/A Daire:7 '
  || 'Üsküdar/İstanbul — kapı kodu: ğüşçıö '
  || '(teslimat notu: akşam 19:00''den sonra zili çalma, komşuya bırak)'
WHERE id = 1;
