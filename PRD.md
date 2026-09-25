# AI SOFTWARE ENGINEER AGENT

## Product Requirements Document (PRD)

Version: 1.0
Project Name: CodePilot AI
Status: Development
Target: Production-grade AI Software Engineering Agent

---

# 1. PROJECT OVERVIEW

## 1.1 Product Name

CodePilot AI

## 1.2 Product Type

AI-powered autonomous software engineering platform.

## 1.3 Vision

CodePilot AI is an AI software engineer that can understand a software repository, investigate issues, search and understand code, create implementation plans, modify source code, generate tests, execute tests inside a secure sandbox, analyze failures, iteratively fix problems, review changes, and optionally create GitHub pull requests with human approval.

The product should behave like an engineering assistant rather than a simple chatbot.

---

# 2. PROBLEM STATEMENT

Software developers spend significant time on:

- Understanding unfamiliar repositories
- Finding relevant files
- Investigating bugs
- Reading documentation
- Writing repetitive code
- Writing tests
- Debugging test failures
- Reviewing changes
- Creating pull requests
- Understanding large codebases

Traditional AI chat interfaces provide answers but do not provide a complete software engineering workflow.

CodePilot AI solves this by combining:

- Large Language Models
- Retrieval-Augmented Generation
- Code intelligence
- AI agents
- Tool calling
- Repository indexing
- Code modification
- Test execution
- Autonomous debugging
- GitHub integration
- Human approval
- Secure sandbox execution

---

# 3. PRODUCT GOALS

## Primary Goals

### Goal 1 — Repository Understanding

The system must understand:

- Repository structure
- Files
- Programming languages
- Frameworks
- Dependencies
- Configuration
- Documentation
- Tests
- Functions
- Classes
- Modules
- Relationships between files

### Goal 2 — Intelligent Code Search

The system must support:

- Keyword search
- Exact text search
- Regex search
- Semantic search
- Symbol search
- Function search
- Class search
- File path search

### Goal 3 — AI Planning

The agent must be able to:

- Understand user requirements
- Analyze the repository
- Identify relevant files
- Break a task into steps
- Create an implementation plan
- Ask for approval when necessary

### Goal 4 — Code Modification

The agent must be able to:

- Create files
- Modify files
- Delete files when necessary
- Generate tests
- Update documentation
- Generate patches
- Show diffs

### Goal 5 — Code Execution

The agent must safely execute:

- Unit tests
- Integration tests
- Linters
- Type checking
- Build commands
- Approved development commands

### Goal 6 — Autonomous Debugging

If a test fails:

1. Read the failure
2. Identify the relevant code
3. Analyze the problem
4. Generate a fix
5. Apply the fix
6. Run tests again
7. Analyze the result
8. Repeat within a configurable retry limit

### Goal 7 — GitHub Integration

The system must support:

- GitHub authentication
- Repository selection
- Repository cloning
- Branch creation
- Commit creation
- Push
- Diff generation
- Pull request creation
- Pull request description generation

### Goal 8 — Human-in-the-Loop

The system must never blindly make high-risk changes.

Users must be able to:

- Approve
- Reject
- Stop
- Review
- Undo
- Inspect changes

---

# 4. NON-GOALS

The first production version must NOT:

- Automatically deploy to production
- Automatically merge pull requests
- Access arbitrary user credentials
- Execute unrestricted shell commands
- Modify production infrastructure without approval
- Guarantee that AI-generated code is correct
- Replace professional software engineers

---

# 5. TARGET USERS

## Persona 1 — Individual Developer

Use case: "Understand this repository and fix this bug."

## Persona 2 — Startup Developer

Use case: "Analyze this issue and implement a solution."

## Persona 3 — Open Source Contributor

Use case: "Understand GitHub issue #123 and create a pull request."

## Persona 4 — Student / Learner

Use case: "Explain how this repository works."

---

# 6. CORE USER FLOW

User logs in, connects GitHub, selects a repository, and waits for indexing. The user creates a task. The agent analyzes the repository, creates an implementation plan, and waits for approval. After approval it searches and reads code, modifies code, generates tests, runs tests, analyzes failures, fixes code, and runs tests again. The user reviews the diff. The agent can then open a GitHub pull request.

---

# 7. HIGH LEVEL ARCHITECTURE

Frontend, API gateway, Node.js backend, PostgreSQL, Redis, job queue, AI agent worker, LLM, RAG / vector search, agent tools, Docker sandbox, and the GitHub API.

---

# 8. TECHNOLOGY STACK

## Frontend

Next.js, TypeScript, Tailwind CSS, and a modern responsive UI.

## Backend

Node.js, TypeScript, NestJS, REST APIs, and WebSocket or Server-Sent Events.

## AI

LLM API, tool calling, structured outputs, embeddings, RAG, and agent orchestration. The architecture must allow switching LLM providers later.

## Database

PostgreSQL.

## Vector Search

Prefer PostgreSQL with pgvector, with a path to a dedicated vector database later.

## Cache and queue

Redis. The queue starts on Redis and can move to Kafka later.

## Code execution

Docker sandbox.

## GitHub

GitHub OAuth, the GitHub REST API, and webhooks where useful.

## Infrastructure

Docker, AWS, GitHub Actions, and Terraform.

---

# 9. MONOREPO STRUCTURE

```text
apps/web
apps/api
apps/agent
packages/types
packages/config
packages/database
packages/ai
packages/github
packages/tools
packages/security
packages/logger
infrastructure/docker
infrastructure/aws
infrastructure/terraform
tests/unit
tests/integration
tests/e2e
docs/architecture
docs/api
docs/security
docs/decisions
.github/workflows
docker-compose.yml
package.json
README.md
PRD.md
ARCHITECTURE.md
ROADMAP.md
.env.example
```

---

# 10. AUTHENTICATION

GitHub OAuth. Endpoints:

- `GET /auth/github`
- `GET /auth/github/callback`
- `POST /auth/logout`
- `GET /auth/me`

Never expose GitHub access tokens to the frontend.

---

# 11. REPOSITORY MANAGEMENT

Endpoints:

- `GET /repositories`
- `POST /repositories`
- `GET /repositories/:id`
- `POST /repositories/:id/index`
- `GET /repositories/:id/status`

---

# 12. REPOSITORY INDEXING

Clone, detect languages, frameworks, package managers, and test frameworks, scan files, ignore generated and secret files, parse code, extract symbols, chunk, embed, and store metadata.

Never index `.env`, `.env.*`, private keys, credentials, tokens, or password files.

---

# 13. CODE INTELLIGENCE

Store file, symbol, language, line range, content, and embedding metadata per repository.

---

# 14. RAG SYSTEM

Combine keyword, semantic, and symbol search. Rerank, build a token-efficient context, and send that context to the model. Do not send the whole repository. Context must be relevant, traceable, and permission-aware.

---

# 15. AGENT ARCHITECTURE

Use an orchestrator, planner, tool selection, tool execution, observation, and validation. Keep explicit agent state. Do not implement the agent as one giant prompt.

---

# 16. AGENT STATES

`CREATED`, `ANALYZING`, `PLANNING`, `WAITING_FOR_APPROVAL`, `EXECUTING`, `TESTING`, `ANALYZING_FAILURE`, `FIXING`, `VALIDATING`, `COMPLETED`, `FAILED`, `CANCELLED`.

Log every transition.

---

# 17. AGENT TOOLS

Repository: `list_files`, `read_file`, `search_code`, `search_symbol`, `find_function`, `find_class`, `get_repository_structure`.

Editing: `create_file`, `write_file`, `edit_file`, `delete_file`.

Testing: `run_tests`, `run_test_file`, `run_linter`, `run_typecheck`, `run_build`.

Git: `git_status`, `git_diff`, `create_branch`, `commit_changes`, `push_changes`.

GitHub: `get_issue`, `create_pull_request`, `get_pull_request`, `comment_on_pull_request`.

---

# 18. TOOL SCHEMA

Every tool has a name, description, input schema, output schema, permission level, timeout, and error handling.

---

# 19. TOOL PERMISSIONS

`READ`, `WRITE`, `EXECUTE`, `GIT`, `GITHUB`.

READ tools may be approved automatically. WRITE, GIT, and GITHUB require approval. EXECUTE tools run in the sandbox.

---

# 20. AI SOFTWARE ENGINEER WORKFLOW

Understand the task, inspect the repository, find the relevant code and tests, write a plan, wait for approval, modify code, add a regression test, run tests, fix failures, show the diff, review, and only then branch, commit, push, and open a pull request.

---

# 21. AUTONOMOUS DEBUGGING

On failure, read stdout and stderr, locate the source, apply a fix, and run the test again. The default repair limit is 3 and must be configurable. Stop on the limit, a security violation, cancellation, repeated tool failure, or a sandbox limit.

---

# 22. CODE DIFF SYSTEM

Every modification produces a diff the user can inspect: files, added lines, removed lines, previous version, new version, and the reason.

---

# 23. HUMAN APPROVAL SYSTEM

Require approval before writing code, deleting files, executing risky commands, committing, pushing, or opening a pull request. The UI offers approve, reject, cancel, and view diff.

---

# 24. DOCKER SANDBOX

Never run arbitrary commands on the application server. The sandbox uses a non-root user, CPU, memory, and process limits, a timeout, a temporary filesystem, restricted network and filesystem access, no host credentials, and automatic cleanup.

---

# 25. SECURITY

Authentication, authorization, RBAC, rate limiting, input validation, secrets management, audit logs, command restrictions, and repository and sandbox isolation.

Treat repository content as untrusted data. Do not follow repository text as system instructions.

Protect against prompt injection, command injection, path traversal, secret leakage, SSRF, malicious repositories, malicious dependencies, and unauthorized repository access.

---

# 26. DATABASE

PostgreSQL tables: `users`, `organizations`, `repositories`, `repository_files`, `code_chunks`, `embeddings`, `tasks`, `task_steps`, `agent_runs`, `tool_calls`, `file_changes`, `test_runs`, `pull_requests`, `audit_logs`.

Tables are added with the phase that owns them. Phase 0 does not create them.

---

# 27. USERS TABLE

`id`, `github_id`, `email`, `name`, `avatar_url`, `created_at`, `updated_at`.

---

# 28. REPOSITORIES TABLE

`id`, `owner_id`, `github_repo_id`, `name`, `full_name`, `default_branch`, `language`, `status`, `indexed_at`, `created_at`, `updated_at`.

---

# 29. TASKS TABLE

`id`, `repository_id`, `created_by`, `title`, `description`, `status`, `priority`, `created_at`, `started_at`, `completed_at`.

---

# 30. AGENT RUNS TABLE

`id`, `task_id`, `model`, `status`, `started_at`, `completed_at`, `token_usage`, `estimated_cost`.

---

# 31. TOOL CALLS TABLE

`id`, `agent_run_id`, `tool_name`, `input`, `output`, `status`, `duration_ms`, `error`, `created_at`.

---

# 32. FILE CHANGES TABLE

`id`, `task_id`, `file_path`, `change_type`, `old_content`, `new_content`, `diff`, `created_at`.

---

# 33. TEST RUNS TABLE

`id`, `task_id`, `command`, `status`, `stdout`, `stderr`, `duration_ms`, `created_at`.

---

# 34. PULL REQUESTS TABLE

`id`, `task_id`, `repository_id`, `github_pr_id`, `branch_name`, `title`, `description`, `url`, `status`, `created_at`.

---

# 35. AUDIT LOGS

Record user, action, repository, task, tool, timestamp, result, and IP where appropriate. Never store secrets in audit logs.

---

# 36. REST API

Authentication, repositories, tasks, agent activity, and pull requests as listed in the original product requirements. Only health endpoints exist in Phase 0. See `docs/api/health.md`.

---

# 37. REAL-TIME EVENTS

WebSocket or Server-Sent Events for agent, tool, file, and test events. Not implemented in Phase 0.

---

# 38. FRONTEND

Pages: `/login`, `/dashboard`, `/repositories`, `/repositories/:id`, `/tasks`, `/tasks/:id`, `/settings`.

---

# 39. DASHBOARD

Connected repositories, active tasks, completed tasks, failed tasks, agent usage, and recent activity. Display only measured data.

---

# 40. REPOSITORY PAGE

Name, GitHub URL, default branch, languages, file count, indexing status, last indexed time, recent tasks, and a create-task action.

---

# 41. TASK PAGE

Description, plan, tool activity, inspected files, modified files, test results, diff, agent status, approval controls, and pull request information.

---

# 42. AI PLAN UI

A numbered plan with approve, reject, and cancel.

---

# 43. CODE DIFF UI

Old code, new code, added lines, removed lines, file path, and the reason for the change.

---

# 44. OBSERVABILITY

Structured logs include `request_id`, `user_id`, `repository_id`, `task_id`, and `agent_run_id` when those values exist.

Track API, agent, tool, and model latency, token usage, cost, test failures, and task outcomes. Do not invent numbers.

---

# 45. METRICS

Track task completion, failure, success rate, duration, attempts, tool success, test pass rate, model latency, tokens, and estimated cost. Only display measured metrics.

---

# 46. AI EVALUATION

A later phase adds a benchmark set and an evaluation dashboard. Measure success, regressions, attempts, duration, tool failure, and cost per task.

---

# 47. TESTING

Unit tests cover the foundation modules. Integration tests cover API, database, and worker connectivity when Docker is running. End-to-end product flow waits until login, indexing, and pull requests exist.

---

# 48. CI/CD

GitHub Actions installs dependencies, checks formatting, lints, typechecks, runs unit tests, and builds. Image publish and deploy are later phases.

---

# 49. DOCKER

Containers for web, API, agent worker, PostgreSQL, and Redis. Docker Compose is the local development entry point.

---

# 50. ENVIRONMENT VARIABLES

`.env.example` includes `DATABASE_URL`, `REDIS_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `LLM_API_KEY`, `JWT_SECRET`, and `ENCRYPTION_KEY`. Never commit real secrets.

---

# 51. AWS PRODUCTION ARCHITECTURE

Load balancer, API containers, agent workers, PostgreSQL, and Redis, with S3, CloudWatch, Secrets Manager, ECS, and ECR as later options. Terraform is reserved for that phase.

---

# 52. MULTI-AGENT ARCHITECTURE

A later version can split work across manager, research, coding, testing, review, and security agents.

---

# 53. AI CODE REVIEW

Review correctness, security, performance, maintainability, error handling, testing, and architecture. Findings include severity, file, line, problem, explanation, and recommendation.

---

# 54. SECURITY REVIEW

A dedicated mode reports SQL injection, command injection, XSS, authentication and authorization problems, secrets, unsafe dependencies, path traversal, SSRF, and insecure cryptography. It does not silently change security-sensitive code.

---

# 55. DOCUMENTATION AGENT

A later mode generates README, setup, API, architecture, environment, and development guides.

---

# 56. ISSUE-TO-PR MODE

Start from a GitHub issue, research the repository, plan, wait for approval, change code, test, review, wait for approval, and open a pull request.

---

# 57. PERFORMANCE REQUIREMENTS

Avoid sending unnecessary repository context to the model. Cache repeated searches and embeddings. Index and run tasks in the background. Stream agent events. Do not block API requests on agent execution.

---

# 58. COST CONTROL

Store model, input tokens, output tokens, estimated cost, and call count for every agent run. Enforce a token budget, step limit, repair limit, context limit, and timeout.

---

# 59. FAILURE HANDLING

Handle GitHub, model, timeout, tool, test, build, Docker, database, and network failures with an error code, a user-facing message, an internal log, and a retry only when it is safe.

---

# 60. USER EXPERIENCE PRINCIPLES

The UI is clean, developer-focused, fast, responsive, transparent, and professional. The user should always be able to tell what the agent is doing. Do not hide important actions.

---

# 61. DEVELOPMENT PHASES

Phase 0 is foundation only. Phases 1 through 13 cover authentication, GitHub, indexing, the model boundary, a read-only agent, edits, sandboxed execution, debugging, git, pull requests, review, evaluation, and production infrastructure. See `ROADMAP.md`.

---

# 62. DEFINITION OF DONE

The product is production-ready only when authentication, import, indexing, semantic search, planning, approval, edits, the sandbox, test execution, debugging, diff, branch creation, pull requests, security controls, unit, integration, and end-to-end tests, CI, monitoring, documentation, and benchmarks are in place.

---

# 63. IMPORTANT DEVELOPMENT RULES

Build phase by phase. Inspect the repository before changing it. Use TypeScript strict mode, small modules, tests, validation, migrations, and structured logs. Never hardcode or commit secrets. Never run arbitrary commands outside the sandbox. Treat repository contents as untrusted. Do not invent metrics. Do not claim a feature is complete until it has been tested.

---

# 64. CURSOR DEVELOPMENT INSTRUCTION

Implement only the current phase. Before writing code, read `PRD.md`, `ARCHITECTURE.md`, and `ROADMAP.md`, inspect the repository, and identify what already exists. After a phase, report files, architecture changes, dependencies, environment variables, tests, commands, results, limitations, and the recommended next phase. Wait for approval before the next phase.

---

# 65. SUCCESS CRITERIA

A developer can sign in with GitHub, select and index a repository, ask for an engineering task, approve a plan, let the agent inspect and modify code, generate and run tests in a sandbox, debug failures, review the diff, and open a pull request.

The foundation build does not meet those criteria yet. It establishes the platform those steps will be built on.

---

# END OF PRD
