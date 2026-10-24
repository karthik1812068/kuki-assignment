CREATE TABLE "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "filename" text NOT NULL,
  "content_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "sha256" text NOT NULL,
  "storage_key" text NOT NULL,
  "kind" text NOT NULL,
  "status" text NOT NULL,
  "error" text,
  "duplicate_of" uuid REFERENCES "documents" ("id") ON DELETE SET NULL,
  "extraction" text NOT NULL DEFAULT '{}',
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "documents_status_check" CHECK ("status" IN (
    'queued', 'processing', 'completed', 'failed', 'duplicate'
  )),
  CONSTRAINT "documents_kind_check" CHECK ("kind" IN (
    'bill', 'spreadsheet', 'record', 'policy', 'unknown'
  )),
  CONSTRAINT "documents_size_check" CHECK ("byte_size" >= 0)
);
--> statement-breakpoint
CREATE INDEX "documents_owner_idx" ON "documents" ("owner_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "documents_hash_idx" ON "documents" ("owner_id", "sha256");
