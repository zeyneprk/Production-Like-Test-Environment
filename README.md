# Sipariş klonu — Aşama A + B (Step A + Step B)

Çalışan küçük bir **online sipariş API’si** + **klon simülasyonu** + **Testcontainers entegrasyon testleri**. Amaç: geliştirici kodu temiz veride yeşil geçer; production-benzeri (NULL adresli eski mağaza-teslim siparişleri) klona bağlanınca `POST /orders/:id/ship` kırılır. Aşama B, aynı API’yi her koşuda yeni bir PostgreSQL konteynerine karşı doğrular.

Bu depo **Aşama A + B**. GitHub Actions ve yüz binlerce satırlık seed **yok** (Aşama C+).

## Ne var?

| Parça | Açıklama |
| --- | --- |
| Tablolar | `customers`, `products`, `orders` (aynı şema: clean + prodlike) |
| `orders.shipping_address` | **Nullable** (eski store-pickup) |
| Hata | `buildShippingLabel` içinde `address.trim()` — NULL kontrolü yok → çöker |
| Clean seed | 8 müşteri, 5 ürün, 15 sipariş; **hepsinde adres dolu** |
| Prodlike seed | Aynı yapı; sipariş **3, 7, 11, 14** adresi `NULL` (+ bir uzun Türkçe adres) |
| Klon | `pg_dump orders_prodlike` → `pg_restore orders_clone` |
| Aşama B | Testcontainers: her `test:integration` koşusunda geçici Postgres |

### Raporla hizalama notu

Belgedeki ~7 uç nokta şu şekilde alındı: müşteri CRUD (5) + sipariş oluştur + müşteriye göre sipariş listele. Ek olarak kasıtlı hata için `POST /orders/:id/ship` duruyor. React arayüz bu kopyada yoktu; Aşama A/B’de UI eklenmedi (kanıt API + DB üzerinden).

## Portlar

| Servis | Host |
| --- | --- |
| Postgres | `localhost:5433` → konteyner `5432` (Windows’ta yerel 5432 çakışmasın diye) |
| API (clean) | `http://localhost:3000` → `orders_clean` |
| API (clone) | `http://localhost:3001` → `orders_clone` |

Kullanıcı / ship testleri host üzerinden: `postgres://orders:orders@127.0.0.1:5433/<db>`.

**Aşama B Testcontainers** compose portlarını kullanmaz; kendi geçici konteynerini açar.

## Başlatma (Aşama A — compose)

```bash
cd order-clone
docker compose down -v          # temiz volume ile init script’in çalışması için
docker compose up -d --build
npm install
bash scripts/clone-prodlike.sh  # Windows: .\scripts\clone-prodlike.ps1
docker compose restart api-clone
```

`DATABASE_URL` hangi DB’ye bağlanılacağını seçer.

```bash
# Clean (adresler dolu) — ship geçer
DATABASE_URL=postgres://orders:orders@127.0.0.1:5433/orders_clean npm start

# Clone (prodlike kopyası, NULL adresler) — ship NULL’da düşer
DATABASE_URL=postgres://orders:orders@127.0.0.1:5433/orders_clone npm start
```

Compose içindeki `api` varsayılan `orders_clean` (port 3000); `api-clone` → `orders_clone` (port 3001).

## Uç noktalar

```text
POST   /customers
GET    /customers
GET    /customers/:id
PUT    /customers/:id
DELETE /customers/:id
POST   /orders
GET    /customers/:id/orders
POST   /orders/:id/ship     ← kasıtlı trim() hatası
```

### Manuel kontrol (curl)

```bash
# Clean API
curl -s http://localhost:3000/customers | head
curl -s -X POST http://localhost:3000/orders/1/ship
# → 200 + label

# Clone API (klon script’inden sonra)
curl -s -X POST http://localhost:3001/orders/3/ship
# → 500 (Cannot read properties of null / trim)
```

Yeni müşteri / sipariş:

```bash
curl -s -X POST http://localhost:3000/customers \
  -H 'content-type: application/json' \
  -d '{"name":"Ayşe Yılmaz","email":"ayse@example.com","phone":"0532 000 0000"}'

curl -s -X POST http://localhost:3000/orders \
  -H 'content-type: application/json' \
  -d '{"customer_id":1,"product_id":1,"quantity":1,"shipping_address":"Bağdat Cad. No:1 Kadıköy/İstanbul"}'

curl -s http://localhost:3000/customers/1/orders
```

## Testler

### Aşama A — ship (clean geçer / clone düşer)

`test/ship.test.ts` sipariş eklemez; DB’deki 15 siparişe `POST /orders/:id/ship` çağırır. **Compose Postgres** gerekir (`DATABASE_URL`).

```bash
DATABASE_URL=postgres://orders:orders@127.0.0.1:5433/orders_clean npm test
# beklenen: pass

DATABASE_URL=postgres://orders:orders@127.0.0.1:5433/orders_clone npm test
# beklenen: fail — NULL shipping_address (ör. 3, 7, 11, 14)
```

### Aşama B — entegrasyon (Testcontainers)

`test/integration/api.test.ts` her koşuda **yeni bir PostgreSQL konteyneri** açar (`postgres:16-alpine`), şema + clean seed uygular ve ~7 uç nokta için başarı / 400 / 404 senaryolarını çalıştırır. Compose’taki `orders_clean` / `orders_clone` **kullanılmaz**.

**Gereksinim:** makinede çalışan **Docker** (Testcontainers Docker socket’e bağlanır). İlk koşuda `postgres:16-alpine` imajı çekilebilir.

```bash
npm install
npm run test:integration
```

Beklenen: tüm entegrasyon testleri geçer (geçici konteyner açılır ve kapanır).

## pg_dump / pg_restore

`scripts/clone-prodlike.sh` (ve `.ps1`) production-benzeri `orders_prodlike` veritabanını custom formatta dump eder, boş `orders_clone` açar ve restore eder. Ship testleri klona bağlanır; kaynak prodlike değiştirilmez.

```bash
bash scripts/clone-prodlike.sh
# veya: npm run clone-db
```
