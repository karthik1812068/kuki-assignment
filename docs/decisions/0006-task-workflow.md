# Task workflow

The agent runs in the worker, off the API request. Repository text stays in the untrusted section of a prompt.

Read tools may run during inspection. Writes, sandbox commands, git, and pull requests wait for an approval gate. The sandbox is a fixed `docker run` with no network, a read-only root, and no host environment. Git and Docker are argument lists, not a shell. If Docker is not available, the task stops instead of running the command on the API server.

A missing language model still produces a plan from repository search and does not invent edits. Repair stops after `AGENT_REPAIR_LIMIT` attempts, a repeated failure, or a missing model. Token cost is stored only when both prices are configured.

Validation can return to approval so a tested diff can be accepted before publish. That edge was added after the first state machine so a commit cannot skip the user.
