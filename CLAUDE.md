# Claude Code

This file exists so Claude Code picks it up automatically.

**All agent instructions live in [`AGENTS.md`](AGENTS.md).** Read that
file in full before touching anything. The same rules apply to Claude
Code, Codex, Cursor, Gemini CLI, and Perplexity agents.

Quick recap (do not treat as a substitute for `AGENTS.md`):

- Scope: the versioned central-Berlin polygon and presentation radius declared
  in `AGENTS.md`; never infer an older Regierungsviertel-only boundary here.
- Data: additive fusion of every permitted source listed in `AGENTS.md`.
  Google remains strictly opt-in and must never replace LoD2 or OSM.
- Tooling: `uv` for Python and `bun` for the viewer.
- Preserve every mandatory attribution and the source/approximation distinction.
- Final deliverables are the static hosted viewer and complete local packages.

When in doubt: open `AGENTS.md`, find the relevant section number,
and follow it.
