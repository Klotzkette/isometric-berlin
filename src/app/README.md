# Isometric Berlin viewer

React + TypeScript + Vite + OpenSeadragon, managed with `bun`.

## Dev

```bash
bun install
bun run dev
```

The app expects DZI tiles under `public/dzi/regierungsviertel/` or a
remote URL (e.g. Cloudflare R2) configured via env. Scaffold only;
not wired up yet.

## Required attribution overlay

```
© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)
```

Must be visible in the viewer chrome at all times.
