CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "github_id" bigint NOT NULL,
  "github_login" text NOT NULL,
  "email" text,
  "name" text,
  "avatar_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "users_github_id_unique" UNIQUE ("github_id"),
  CONSTRAINT "users_github_login_format" CHECK ("github_login" ~ '^[A-Za-z0-9-]{1,39}$')
);
--> statement-breakpoint
CREATE TABLE "github_credentials" (
  "user_id" uuid PRIMARY KEY REFERENCES "users" ("id") ON DELETE CASCADE,
  "access_token_ciphertext" text NOT NULL,
  "scopes" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
  "id" text PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");
