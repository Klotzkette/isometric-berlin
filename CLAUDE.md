# Claude Code

This file exists so Claude Code picks it up automatically.

**All agent instructions live in [`AGENTS.md`](AGENTS.md).** Read that
file in full before touching anything. The same rules apply to Claude
Code, Codex, Cursor, Gemini CLI, and Perplexity agents.

Quick recap (do not treat as a substitute for `AGENTS.md`):

- Scope: Berlin **Regierungsviertel only**, v0.1.
- Data: **Berlin LoD2 (dl-de/zero-2-0) + OpenStreetMap (ODbL) only**.
  No Google APIs.
- Tooling: `uv` for Python, `bun` for the viewer. Nothing else.
- Always preserve the OSM + Geoportal Berlin attribution overlay.
- Final deliverable is a static OpenSeadragon viewer suitable for
  Perplexity hosting.

When in doubt: open `AGENTS.md`, find the relevant section number,
and follow it.
