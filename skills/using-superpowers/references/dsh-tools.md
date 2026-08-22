# DeepSeek Harness (DSH) Tool Mapping

Fork-local reference (maestro-skills) — not part of upstream superpowers.
Maps the harness-agnostic actions named in these skills to DeepSeek
Harness's actual tools. DSH exposes tools through a code-runtime bridge:
shell work runs via the `bash` tool *inside* `run_code` (`await
tools.bash({ command, description })`).

| Action in skill text | DSH tool |
|---|---|
| Invoke / load a skill | `skill` with `{ name }` |
| Dispatch a fresh subagent per task | `subagent` (background by default; pass `run_in_background: false` only when the next step depends on its result) |
| Continue or redirect an existing subagent | `send_message` to its durable `subagent_id` |
| Fan out independent tasks concurrently | several independent tool calls in one assistant turn |
| Large multi-phase orchestration | `workflow` — only when the human explicitly asks for a workflow |
| Fresh-agent iterative loop | `ralph` — only when the human explicitly asks for Ralph |
| Seed a child with this conversation | `subagent_fork` |
| Create a todo / checklist item | `todo_write` (whole list every call) |
| Ask your human partner | `ask_user_question` |
| Present a plan for approval | `exit_plan_mode` (plan mode only) |
| Long-running objective across turns | goal tools: `create_goal`, `get_goal`, `update_goal` |
| Read a file / find files / search contents | `read`, `glob`, `grep` |
| Write / edit files | `write`, `edit` (read before edit) |
| Run shell commands, tests, git | `bash` via `run_code`; background jobs via `run_in_background: true`, collect with `job_output`, stop with `job_kill` |
| Search the web | `web_search` |
| Look at an image file | `read_image` |

## Session-shape notes

- Skills arrive as catalog summaries in a `<system-reminder>`; load one with
  the `skill` tool before acting on it. There is no session-start bootstrap
  injection on DSH: checking `<available_skills>` first is YOUR job, which is
  what this skill mandates anyway.
- Background subagents notify you when they settle; do not poll. Collect any
  still-relevant jobs before finishing a turn.
- "Announce" actions from these skills are plain prose in your reply; DSH has
  no separate announcement channel.

Upstream keeps this list per-harness on purpose; update it here when DSH's
tool surface changes, and keep upstream skill bodies untouched.
