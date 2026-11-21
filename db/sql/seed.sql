-- Small clean demo seed. Every order is paid, unshipped, and has an address,
-- so ship / cancel / refund rehearsal succeeds against orders_clean.

INSERT INTO customers (id, name, email, phone) VALUES
  (1,  'Elif Demir',    'elif.demir@example.com',    '0532 111 0001'),
  (2,  'Mehmet Aksoy',  'mehmet.aksoy@example.com',  '0532 111 0002'),
  (3,  'Zerrin Koç',    'zerrin.koc@example.com',    '0532 111 0003'),
  (4,  'Burak Şahin',   'burak.sahin@example.com',   '0532 111 0004'),
  (5,  'Selin Aydın',   'selin.aydin@example.com',   '0532 111 0005'),
  (6,  'Emre Çetin',    'emre.cetin@example.com',    '0532 111 0006'),
  (7,  'Deniz Arslan',  'deniz.arslan@example.com',  '0532 111 0007'),
  (8,  'Hande Yıldız',  'hande.yildiz@example.com',  '0532 111 0008');

SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));

INSERT INTO products (id, name, price_cents) VALUES
  (1, 'Türk Kahvesi Seti',           34900),
  (2, 'Seramik Fincan',              12900),
  (3, 'Cezve (bakır)',               45900),
  (4, 'Lokum Kutusu (500g)',         18900),
  (5, 'Zeytinyağı (1L, soğuk sıkım)', 27500);

SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

INSERT INTO orders (id, customer_id, product_id, quantity, shipping_address, status, payment_status) VALUES
  (1,  1, 1, 1, 'İstiklal Cad. No:48 Beyoğlu/İstanbul',              'paid', 'paid'),
  (2,  2, 2, 2, 'Atatürk Blv. No:23 Çankaya/Ankara',                 'paid', 'paid'),
  (3,  3, 3, 1, 'Kıbrıs Şehitleri Cad. No:7 Konak/İzmir',            'paid', 'paid'),
  (4,  4, 4, 3, 'Hamamyolu Sok. No:15 Odunpazarı/Eskişehir',         'paid', 'paid'),
  (5,  5, 5, 1, 'Lara Cad. No:90 Muratpaşa/Antalya',                 'paid', 'paid'),
  (6,  6, 1, 2, 'Cemal Gürsel Cad. No:18 Nilüfer/Bursa',             'paid', 'paid'),
  (7,  7, 2, 1, 'Uzun Sok. No:4 Ortahisar/Trabzon',                  'paid', 'paid'),
  (8,  8, 3, 1, 'Atatürk Cad. No:61 Seyhan/Adana',                   'paid', 'paid'),
  (9,  1, 4, 1, 'Sivas Cad. No:9 Melikgazi/Kayseri',                 'paid', 'paid'),
  (10, 2, 5, 2, 'İstasyon Cad. No:27 Yenişehir/Mersin',              'paid', 'paid'),
  (11, 3, 1, 1, 'İnönü Cad. No:3 Battalgazi/Malatya',                'paid', 'paid'),
  (12, 4, 2, 1, 'Gazi Cad. No:44 İlkadım/Samsun',                    'paid', 'paid'),
  (13, 5, 3, 2, 'Ankara Cad. No:11 Selçuklu/Konya',                  'paid', 'paid'),
  (14, 6, 4, 1, 'Cumhuriyet Cad. No:8 Merkez/Edirne',                'paid', 'paid'),
  (15, 7, 5, 1, 'Diclekent Blv. No:20 Kayapınar/Diyarbakır',         'paid', 'paid');

SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders));
