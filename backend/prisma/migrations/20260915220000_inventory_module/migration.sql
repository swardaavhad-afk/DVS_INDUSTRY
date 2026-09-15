-- ── Inventory Module Migration ─────────────────────────────────────────────
-- Creates: Material, StockTransaction, ScrapRecord tables + StockTransactionType enum

-- Enum
CREATE TYPE "StockTransactionType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'SCRAP', 'RETURN');

-- Material
CREATE TABLE "Material" (
    "id"            SERIAL NOT NULL,
    "name"          TEXT NOT NULL,
    "code"          TEXT NOT NULL,
    "description"   TEXT,
    "unit"          TEXT NOT NULL,
    "category"      TEXT,
    "location"      TEXT,
    "currentStock"  DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minStockLevel" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "maxStockLevel" DECIMAL(12,3),
    "costPerUnit"   DECIMAL(12,2),
    "currency"      TEXT NOT NULL DEFAULT 'INR',
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "deletedAt"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Material_name_key" ON "Material"("name");
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");
CREATE INDEX "Material_code_idx"         ON "Material"("code");
CREATE INDEX "Material_isActive_idx"     ON "Material"("isActive");
CREATE INDEX "Material_category_idx"     ON "Material"("category");
CREATE INDEX "Material_currentStock_idx" ON "Material"("currentStock");

-- StockTransaction
CREATE TABLE "StockTransaction" (
    "id"              SERIAL NOT NULL,
    "materialId"      INTEGER NOT NULL,
    "type"            "StockTransactionType" NOT NULL,
    "quantity"        DECIMAL(12,3) NOT NULL,
    "balanceAfter"    DECIMAL(12,3) NOT NULL,
    "referenceNo"     TEXT,
    "reason"          TEXT,
    "performedById"   INTEGER,
    "performedByName" TEXT,
    "departmentId"    INTEGER,
    "departmentName"  TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockTransaction_materialId_idx"  ON "StockTransaction"("materialId");
CREATE INDEX "StockTransaction_type_idx"        ON "StockTransaction"("type");
CREATE INDEX "StockTransaction_createdAt_idx"   ON "StockTransaction"("createdAt");
CREATE INDEX "StockTransaction_departmentId_idx" ON "StockTransaction"("departmentId");
CREATE INDEX "StockTransaction_referenceNo_idx" ON "StockTransaction"("referenceNo");

ALTER TABLE "StockTransaction"
    ADD CONSTRAINT "StockTransaction_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ScrapRecord
CREATE TABLE "ScrapRecord" (
    "id"             SERIAL NOT NULL,
    "materialId"     INTEGER NOT NULL,
    "quantity"       DECIMAL(12,3) NOT NULL,
    "unit"           TEXT NOT NULL,
    "departmentId"   INTEGER,
    "departmentName" TEXT,
    "employeeId"     INTEGER,
    "employeeName"   TEXT,
    "reason"         TEXT,
    "recoveryValue"  DECIMAL(12,2),
    "recordedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScrapRecord_materialId_idx"  ON "ScrapRecord"("materialId");
CREATE INDEX "ScrapRecord_departmentId_idx" ON "ScrapRecord"("departmentId");
CREATE INDEX "ScrapRecord_recordedAt_idx"  ON "ScrapRecord"("recordedAt");

ALTER TABLE "ScrapRecord"
    ADD CONSTRAINT "ScrapRecord_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
