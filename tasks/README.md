# Task files for agents

This directory holds Markdown task files that the owner (or an agent
on the owner's behalf) drops in for a coding agent to execute.
Convention adopted from the upstream NYC project.

## Conventions

- One task per file: `tasks/<NN>-<slug>.md`, numbered in execution
  order (e.g. `tasks/01-bounds-editor.md`).
- Each task references the pipeline step from
  [`../AGENTS.md`](../AGENTS.md) §5 it belongs to.
- Agents may edit a task file to clarify scope or split it, but must
  not silently expand it. New steps go in new files.
- When a task is done, move it to `tasks/done/` rather than deleting,
  so we have a trail.

## Template

```md
# Task NN — <short title>

**Pipeline step:** <1–8> (see AGENTS.md §5)
**Status:** todo | in-progress | done
**Owner-set scope:** <one-paragraph what & why>

## Acceptance criteria

- [ ] …
- [ ] …

## Notes for agents

- Stay inside Regierungsviertel bounds.
- Open data only.
- Run `uv run ruff format . && uv run ruff check . && uv run pytest`
  before finishing.
```
