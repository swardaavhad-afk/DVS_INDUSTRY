-- Orders Module Migration
-- Creates: Supplier, Client, ClientOrder, PurchaseOrder + status enums

-- ── Enums ─────────────────────────────────────────────────────────────────────
CREATE TYPE "ClientOrderStatus" AS ENUM (
  'PENDING', 'APPROVED', 'IN_PRODUCTION', 'DISPATCHED', 'DELIVERED', 'CANCELLED'
);

CREATE TYPE "PurchaseOrderStatus" AS ENUM (
  'PENDING', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'
);

-- ── Supplier ──────────────────────────────────────────────────────────────────
CREATE TABLE "Supplier" (
  "id"           SERIAL NOT NULL,
  "name"         TEXT NOT NULL,
  "code"         TEXT NOT NULL,
  "contactName"  TEXT,
  "email"        TEXT,
  "phone"        TEXT,
  "address"      TEXT,
  "city"         TEXT,
  "state"        TEXT,
  "country"      TEXT NOT NULL DEFAULT 'India',
  "gstin"        TEXT,
  "rating"       DECIMAL(3,1),
  "leadTimeDays" INTEGER,
  "reliability"  TEXT,
  "materials"    TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "deletedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");
CREATE INDEX "Supplier_code_idx"     ON "Supplier"("code");
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

-- ── Client ────────────────────────────────────────────────────────────────────
CREATE TABLE "Client" (
  "id"          SERIAL NOT NULL,
  "name"        TEXT NOT NULL,
  "code"        TEXT NOT NULL,
  "contactName" TEXT,
  "email"       TEXT,
  "phone"       TEXT,
  "address"     TEXT,
  "city"        TEXT,
  "state"       TEXT,
  "country"     TEXT NOT NULL DEFAULT 'India',
  "gstin"       TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "deletedAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Client_name_key" ON "Client"("name");
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");
CREATE INDEX "Client_code_idx"     ON "Client"("code");
CREATE INDEX "Client_isActive_idx" ON "Client"("isActive");

-- ── ClientOrder ───────────────────────────────────────────────────────────────
CREATE TABLE "ClientOrder" (
  "id"            SERIAL NOT NULL,
  "orderNumber"   TEXT NOT NULL,
  "clientId"      INTEGER NOT NULL,
  "product"       TEXT NOT NULL,
  "quantity"      INTEGER NOT NULL,
  "unit"          TEXT NOT NULL DEFAULT 'pcs',
  "value"         DECIMAL(14,2),
  "currency"      TEXT NOT NULL DEFAULT 'INR',
  "orderDate"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requiredDate"  TIMESTAMP(3),
  "dispatchDate"  TIMESTAMP(3),
  "deliveryDate"  TIMESTAMP(3),
  "status"        "ClientOrderStatus" NOT NULL DEFAULT 'PENDING',
  "notes"         TEXT,
  "dispatchNote"  TEXT,
  "challanNumber" TEXT,
  "invoiceNumber" TEXT,
  "createdById"   INTEGER,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientOrder_orderNumber_key" ON "ClientOrder"("orderNumber");
CREATE INDEX "ClientOrder_clientId_idx"    ON "ClientOrder"("clientId");
CREATE INDEX "ClientOrder_status_idx"      ON "ClientOrder"("status");
CREATE INDEX "ClientOrder_orderDate_idx"   ON "ClientOrder"("orderDate");
CREATE INDEX "ClientOrder_orderNumber_idx" ON "ClientOrder"("orderNumber");

ALTER TABLE "ClientOrder"
  ADD CONSTRAINT "ClientOrder_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── PurchaseOrder ─────────────────────────────────────────────────────────────
CREATE TABLE "PurchaseOrder" (
  "id"               SERIAL NOT NULL,
  "poNumber"         TEXT NOT NULL,
  "supplierId"       INTEGER NOT NULL,
  "material"         TEXT NOT NULL,
  "quantity"         TEXT NOT NULL,
  "unit"             TEXT,
  "totalCost"        DECIMAL(14,2),
  "currency"         TEXT NOT NULL DEFAULT 'INR',
  "orderDate"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedDelivery" TIMESTAMP(3),
  "actualDelivery"   TIMESTAMP(3),
  "status"           "PurchaseOrderStatus" NOT NULL DEFAULT 'PENDING',
  "notes"            TEXT,
  "createdById"      INTEGER,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");
CREATE INDEX "PurchaseOrder_status_idx"     ON "PurchaseOrder"("status");
CREATE INDEX "PurchaseOrder_orderDate_idx"  ON "PurchaseOrder"("orderDate");
CREATE INDEX "PurchaseOrder_poNumber_idx"   ON "PurchaseOrder"("poNumber");

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
