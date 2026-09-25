CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
ALTER TABLE "repositories"
  ADD COLUMN "indexing_status" text NOT NULL DEFAULT 'not_started',
  ADD COLUMN "indexing_error" text,
  ADD COLUMN "index_truncated" boolean NOT NULL DEFAULT false,
  ADD COLUMN "indexed_file_count" integer,
  ADD COLUMN "indexed_chunk_count" integer,
  ADD COLUMN "detected_languages" text,
  ADD COLUMN "detected_frameworks" text,
  ADD COLUMN "detected_package_managers" text,
  ADD COLUMN "detected_test_frameworks" text,
  ADD COLUMN "embedding_model" text,
  ADD CONSTRAINT "repositories_indexing_status_check" CHECK (
    "indexing_status" IN ('not_started', 'queued', 'running', 'completed', 'failed')
  );
--> statement-breakpoint
CREATE TABLE "repository_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "repository_id" uuid NOT NULL REFERENCES "repositories" ("id") ON DELETE CASCADE,
  "path" text NOT NULL,
  "language" text,
  "byte_size" integer NOT NULL,
  "line_count" integer NOT NULL,
  "content_sha256" text NOT NULL,
  CONSTRAINT "repository_files_path_unique" UNIQUE ("repository_id", "path"),
  CONSTRAINT "repository_files_byte_size_check" CHECK ("byte_size" >= 0),
  CONSTRAINT "repository_files_line_count_check" CHECK ("line_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "code_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "repository_id" uuid NOT NULL REFERENCES "repositories" ("id") ON DELETE CASCADE,
  "file_id" uuid NOT NULL REFERENCES "repository_files" ("id") ON DELETE CASCADE,
  "symbol" text,
  "language" text,
  "start_line" integer NOT NULL,
  "end_line" integer NOT NULL,
  "content" text NOT NULL,
  CONSTRAINT "code_chunks_lines_check" CHECK ("start_line" >= 1 AND "end_line" >= "start_line")
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chunk_id" uuid NOT NULL UNIQUE REFERENCES "code_chunks" ("id") ON DELETE CASCADE,
  "repository_id" uuid NOT NULL REFERENCES "repositories" ("id") ON DELETE CASCADE,
  "model" text NOT NULL,
  "dimensions" integer NOT NULL,
  "embedding" vector(256) NOT NULL,
  CONSTRAINT "embeddings_model_check" CHECK ("model" = 'local-hash-v1'),
  CONSTRAINT "embeddings_dimensions_check" CHECK ("dimensions" = 256)
);
--> statement-breakpoint
CREATE INDEX "repository_files_repository_idx" ON "repository_files" ("repository_id");
--> statement-breakpoint
CREATE INDEX "code_chunks_repository_idx" ON "code_chunks" ("repository_id");
--> statement-breakpoint
CREATE INDEX "embeddings_repository_idx" ON "embeddings" ("repository_id");
