-- CreateEnum
CREATE TYPE "AttendancePunchDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "AttendancePunchStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateTable
CREATE TABLE "AttendancePunch" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "sourceSystem" TEXT NOT NULL DEFAULT 'ESSL',
    "deviceId" TEXT NOT NULL,
    "externalEmployeeId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "direction" "AttendancePunchDirection" NOT NULL,
    "processingStatus" "AttendancePunchStatus" NOT NULL DEFAULT 'RECEIVED',
    "processedAt" TIMESTAMPTZ(3),
    "processingError" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendancePunch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePunch_sourceSystem_deviceId_externalEventId_key"
    ON "AttendancePunch"("sourceSystem", "deviceId", "externalEventId");

CREATE INDEX "AttendancePunch_employeeId_idx" ON "AttendancePunch"("employeeId");
CREATE INDEX "AttendancePunch_occurredAt_idx" ON "AttendancePunch"("occurredAt");
CREATE INDEX "AttendancePunch_employeeId_occurredAt_idx" ON "AttendancePunch"("employeeId", "occurredAt");
CREATE INDEX "AttendancePunch_externalEventId_idx" ON "AttendancePunch"("externalEventId");

-- AddForeignKey
ALTER TABLE "AttendancePunch"
    ADD CONSTRAINT "AttendancePunch_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
