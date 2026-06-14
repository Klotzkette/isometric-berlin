# Codex agent entry point

If you are Codex picking up this repo: read
[`../AGENTS.md`](../AGENTS.md) **completely** before doing anything.

`AGENTS.md` is the single source of truth. The rules apply equally
to Codex, Claude Code, Cursor, Gemini CLI, and Perplexity agents.

Short checklist before you start editing:

1. Confirm you are working on one of the eight numbered pipeline
   steps in `AGENTS.md §5`.
2. Confirm your task stays inside the Regierungsviertel polygon
   (`geo_data/regierungsviertel/bounds.geojson`) and the eight
   landmarks listed in `AGENTS.md §3`.
3. Confirm you are not using any Google API or any closed-data
   source (`AGENTS.md §4` and `§11`).
4. Use `uv` for Python and `bun` for the viewer. Nothing else.
5. After editing Python code:
   `uv run ruff format . && uv run ruff check . && uv run pytest`.
6. Commit message format: `step-<n>: <short imperative>`.

If a task seems to require breaking any of these rules, **stop and
ask the owner instead of guessing.**
