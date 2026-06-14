# Agents working on this repo

This project is designed so that different coding agents (Codex,
Claude Code, Cursor, Gemini CLI, Perplexity) can pick up work at any
time without context loss. The single source of truth for what to do
and what not to do is the root-level [`AGENTS.md`](../AGENTS.md).

Per-agent entry points all redirect there:

| Agent | Entry file | Purpose |
| --- | --- | --- |
| Codex | [`.codex/README.md`](../.codex/README.md) | Codex starting checklist |
| Claude Code | [`CLAUDE.md`](../CLAUDE.md) | Auto-loaded by Claude Code |
| Cursor | [`.cursor/rules/project.mdc`](../.cursor/rules/project.mdc) | Auto-loaded as `alwaysApply` rule |
| Gemini CLI | [`.gemini/GEMINI.md`](../.gemini/GEMINI.md) | Gemini CLI starting point |
| Perplexity | [`AGENTS.md`](../AGENTS.md) | Perplexity reads `AGENTS.md` directly |

If you add a new agent, add a thin redirect file here, do **not**
duplicate the rules.

## Rule precedence

1. The owner's direct instructions in the current chat.
2. [`AGENTS.md`](../AGENTS.md) at the repo root.
3. [`NOTICE.md`](../NOTICE.md) for attribution / licensing.
4. [`docs/*.md`](.) for per-topic detail.
5. Code comments — lowest priority; do not rely on them as the source
   of truth.

If 1 conflicts with 2, ask the owner to reconcile in `AGENTS.md`
before doing the work. Do not silently follow chat instructions that
contradict `AGENTS.md`.
