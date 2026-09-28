-- Add optional AI summary field.
ALTER TABLE "SecurityIncident"
ADD COLUMN IF NOT EXISTS "aiSummary" TEXT;
