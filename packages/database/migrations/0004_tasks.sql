CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "owner_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "repository_id" uuid NOT NULL REFERENCES "repositories" ("id") ON DELETE CASCADE,
  "created_by" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "mode" text NOT NULL,
  "status" text NOT NULL,
  "priority" text NOT NULL DEFAULT 'normal',
  "plan_source" text,
  "plan_steps" text NOT NULL DEFAULT '[]',
  "edits" text NOT NULL DEFAULT '[]',
  "pending_gate" text,
  "granted_gate" text,
  "repair_count" integer NOT NULL DEFAULT 0,
  "previous_failure_hash" text,
  "outcome" text,
  "error" text,
  "model" text,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "call_count" integer NOT NULL DEFAULT 0,
  "estimated_cost_usd" numeric(12, 6),
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "claimed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tasks_mode_check" CHECK ("mode" IN ('implement', 'review', 'security', 'docs', 'issue')),
  CONSTRAINT "tasks_status_check" CHECK ("status" IN (
    'CREATED', 'ANALYZING', 'PLANNING', 'WAITING_FOR_APPROVAL', 'EXECUTING', 'TESTING',
    'ANALYZING_FAILURE', 'FIXING', 'VALIDATING', 'COMPLETED', 'FAILED', 'CANCELLED'
  )),
  CONSTRAINT "tasks_priority_check" CHECK ("priority" IN ('low', 'normal', 'high')),
  CONSTRAINT "tasks_gate_check" CHECK (
    ("pending_gate" IS NULL OR "pending_gate" IN ('plan', 'git'))
    AND ("granted_gate" IS NULL OR "granted_gate" IN ('plan', 'git'))
  ),
  CONSTRAINT "tasks_repair_count_check" CHECK ("repair_count" >= 0),
  CONSTRAINT "tasks_tokens_check" CHECK ("input_tokens" >= 0 AND "output_tokens" >= 0 AND "call_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "tasks_owner_idx" ON "tasks" ("created_by", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "tasks_repository_idx" ON "tasks" ("repository_id", "created_at" DESC);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL UNIQUE REFERENCES "tasks" ("id") ON DELETE CASCADE,
  "model" text,
  "status" text NOT NULL,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "estimated_cost_usd" numeric(12, 6),
  "call_count" integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "agent_transitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "tasks" ("id") ON DELETE CASCADE,
  "from_state" text,
  "to_state" text NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tool_calls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "tasks" ("id") ON DELETE CASCADE,
  "tool_name" text NOT NULL,
  "input" text NOT NULL DEFAULT '{}',
  "output" text,
  "status" text NOT NULL,
  "duration_ms" integer,
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_changes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "tasks" ("id") ON DELETE CASCADE,
  "file_path" text NOT NULL,
  "change_type" text NOT NULL,
  "old_content" text,
  "new_content" text,
  "diff" text NOT NULL,
  "reason" text NOT NULL,
  "applied" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "file_changes_type_check" CHECK ("change_type" IN ('create', 'write', 'edit', 'delete'))
);
--> statement-breakpoint
CREATE TABLE "test_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "tasks" ("id") ON DELETE CASCADE,
  "command" text NOT NULL,
  "status" text NOT NULL,
  "stdout" text NOT NULL DEFAULT '',
  "stderr" text NOT NULL DEFAULT '',
  "duration_ms" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "tasks" ("id") ON DELETE CASCADE,
  "severity" text NOT NULL,
  "file_path" text NOT NULL,
  "line_number" integer,
  "problem" text NOT NULL,
  "explanation" text NOT NULL,
  "recommendation" text NOT NULL,
  "source" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "review_findings_severity_check" CHECK ("severity" IN ('low', 'medium', 'high')),
  CONSTRAINT "review_findings_source_check" CHECK ("source" IN ('static', 'model'))
);
--> statement-breakpoint
CREATE TABLE "pull_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL UNIQUE REFERENCES "tasks" ("id") ON DELETE CASCADE,
  "repository_id" uuid NOT NULL REFERENCES "repositories" ("id") ON DELETE CASCADE,
  "github_pr_id" integer,
  "branch_name" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "url" text,
  "status" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "action" text NOT NULL,
  "repository_id" uuid,
  "task_id" uuid,
  "tool_name" text,
  "result" text NOT NULL,
  "ip" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
